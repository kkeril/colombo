import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadConfig } from "./config.js";
import { createCodexEnv } from "./codexRunner.js";
import { resolveAgentInstructionsPath } from "./prompt.js";
import { redactSensitive } from "./redact.js";
import type { AppConfig } from "./types.js";

export interface ImprovementReviewOptions {
  lookbackDays: number;
  maxJobs: number;
}

export interface FeedbackSummary {
  jobId: string;
  createdAt?: string;
  requesterUserId?: string;
  promptText?: string;
  finalMessage?: string;
  feedbackStatus?: string;
  feedbackRating?: string;
  clarification?: string;
  worklogTail?: string;
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseBooleanEnv(name: string): boolean {
  const value = process.env[name];
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

async function readJson(pathname: string): Promise<Record<string, unknown> | undefined> {
  const text = await fs.readFile(pathname, "utf8").catch(() => "");
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function readText(pathname: string, maxChars: number): Promise<string | undefined> {
  const text = await fs.readFile(pathname, "utf8").catch(() => "");
  if (!text) {
    return undefined;
  }

  const redacted = redactSensitive(text.trim());
  return redacted.length <= maxChars ? redacted : `${redacted.slice(0, maxChars - 1)}…`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function collectFeedbackSummaries(
  stateDir: string,
  options: ImprovementReviewOptions
): Promise<FeedbackSummary[]> {
  const jobsDir = path.join(stateDir, "jobs");
  const entries = await fs.readdir(jobsDir, { withFileTypes: true }).catch(() => []);
  const cutoff = Date.now() - options.lookbackDays * 24 * 60 * 60 * 1000;
  const summaries: FeedbackSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const jobDir = path.join(jobsDir, entry.name);
    const request = await readJson(path.join(jobDir, "request.json"));
    const feedback = await readJson(path.join(jobDir, "feedback.json"));
    const metadata = await readJson(path.join(jobDir, "metadata.json"));
    const createdAt = readString(request?.createdAt) ?? readString(feedback?.createdAt) ?? readString(metadata?.startedAt);

    if (createdAt && Date.parse(createdAt) < cutoff) {
      continue;
    }

    const clarification = feedback?.clarification && typeof feedback.clarification === "object"
      ? readString((feedback.clarification as Record<string, unknown>).text)
      : undefined;

    summaries.push({
      jobId: entry.name,
      createdAt,
      requesterUserId: readString(request?.requesterUserId) ?? readString(feedback?.requesterUserId),
      promptText: readString(request?.promptText),
      finalMessage: await readText(path.join(jobDir, "final.md"), 4000),
      feedbackStatus: readString(feedback?.status),
      feedbackRating: readString(feedback?.rating),
      clarification,
      worklogTail: await readText(path.join(jobDir, "worklog.jsonl"), 4000)
    });
  }

  return summaries
    .sort((left, right) => {
      const score = (item: FeedbackSummary): number => {
        if (item.feedbackRating === "negative") return 3;
        if (item.feedbackRating === "partial") return 2;
        if (item.feedbackStatus && item.feedbackStatus !== "positive") return 1;
        return 0;
      };
      const scoreDelta = score(right) - score(left);
      if (scoreDelta !== 0) return scoreDelta;
      return Date.parse(right.createdAt ?? "0") - Date.parse(left.createdAt ?? "0");
    })
    .slice(0, options.maxJobs);
}

export function buildImprovementReviewPrompt(summaries: FeedbackSummary[]): string {
  const serialized = JSON.stringify(summaries, null, 2);
  return `You are running Colombo's owner-review improvement process.

Goal:
Review recent Slack investigation jobs and feedback. Produce owner-reviewable suggestions that improve Colombo's company-specific setup.

Rules:
- Do not mutate production systems.
- Do not change product/source repositories.
- Do not expose secrets, raw credentials, customer data, or raw logs.
- Suggest changes only for Colombo setup files such as AGENTS.md, workspace/connected-systems/*.md, workspace/test-messages/*.md, or workspace/runbooks/*.md.
- Prefer small, explainable changes that improve tool routing, rights policy, redaction, runbooks, evidence expectations, source limitations, or Slack test messages.
- Every suggestion must cite the job id(s) or feedback pattern that caused it.
- If there is not enough feedback to justify a change, say so and suggest no change.
- Output Markdown only.

Output format:
# Colombo improvement suggestion

## Review scope
- Jobs reviewed:
- Weak-answer patterns:

## Suggested changes
For each suggested change include:
- Target file
- Change summary
- Why this helps
- Evidence from feedback/job ids
- Risk / owner review notes

## Proposed patch guidance
Describe the exact edits an owner-approved apply step should make. Do not include secrets.

## Suggested Slack regression tests
Add realistic @colombo test prompts that should pass after the improvement.

Recent job summaries:

${serialized}
`;
}

function codexBaseArgs(config: AppConfig, sandbox: "read-only" | "workspace-write", outputPath: string): string[] {
  return [
    "exec",
    "--ephemeral",
    "--json",
    "--sandbox",
    sandbox,
    "--skip-git-repo-check",
    "-C",
    config.colomboDir,
    "-c",
    'approval_policy="never"',
    "-c",
    `model_instructions_file=${JSON.stringify(resolveAgentInstructionsPath(config.colomboDir, config.agentInstructionsFile))}`,
    "-o",
    outputPath,
    "-"
  ];
}

async function runCodexCommand(config: AppConfig, args: string[], prompt: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(config.codexBin, args, {
      cwd: config.colomboDir,
      env: createCodexEnv(),
      stdio: ["pipe", "ignore", "pipe"]
    });
    const stderr: string[] = [];
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
    child.stderr.on("data", (chunk) => {
      stderr.push(redactSensitive(String(chunk)));
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`codex exited with ${code}: ${stderr.join("").slice(-4000)}`));
    });
  });
}

async function review(): Promise<void> {
  const config = loadConfig();
  const lookbackDays = parsePositiveIntEnv("colombo_improvement_lookback_days", 1);
  const maxJobs = parsePositiveIntEnv("colombo_improvement_max_jobs", 40);
  const summaries = await collectFeedbackSummaries(config.stateDir, { lookbackDays, maxJobs });
  const pendingDir = path.join(config.colomboDir, "workspace", "improvements", "pending");
  await fs.mkdir(pendingDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(pendingDir, `${stamp}.md`);
  const prompt = buildImprovementReviewPrompt(summaries);

  await runCodexCommand(config, codexBaseArgs(config, "read-only", outputPath), prompt);
  console.log(outputPath);
}

async function runGit(config: AppConfig, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: config.colomboDir,
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function applySuggestion(suggestionPath: string): Promise<void> {
  const config = loadConfig();
  const absoluteSuggestionPath = path.resolve(suggestionPath);
  const suggestion = await fs.readFile(absoluteSuggestionPath, "utf8");
  const appliedDir = path.join(config.colomboDir, "workspace", "improvements", "applied");
  await fs.mkdir(appliedDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(appliedDir, `${stamp}.apply-output.md`);
  const prompt = `Apply this owner-approved Colombo improvement suggestion.

Rules:
- Modify only Colombo setup files: AGENTS.md, workspace/connected-systems, workspace/runbooks, workspace/test-messages, and workspace/improvements.
- Do not mutate production systems.
- Do not edit application source code unless the suggestion explicitly concerns the improvement loop template itself.
- Do not add secrets or private customer data.
- Preserve the product model: MCP is the tool layer; connected systems are the actual sources of truth.
- Record a concise applied-change note under workspace/improvements/applied/.
- Run available local checks if you changed files that have tests.

Approved suggestion file: ${absoluteSuggestionPath}

Suggestion content:

${suggestion}
`;

  await runCodexCommand(config, codexBaseArgs(config, "workspace-write", outputPath), prompt);

  if (parseBooleanEnv("colombo_improvement_auto_commit")) {
    await runGit(config, ["add", "AGENTS.md", "workspace/connected-systems", "workspace/runbooks", "workspace/test-messages", "workspace/improvements"]);
    await runGit(config, ["commit", "-m", `Apply Colombo improvement ${stamp}`]);
    if (parseBooleanEnv("colombo_improvement_auto_push")) {
      await runGit(config, ["push", "origin", "main"]);
    }
  }

  console.log(outputPath);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "review") {
    await review();
    return;
  }
  if (command === "apply") {
    const suggestionPath = process.argv[3];
    if (!suggestionPath) {
      throw new Error("usage: npm run improvement:apply -- <pending-suggestion.md>");
    }
    await applySuggestion(suggestionPath);
    return;
  }

  throw new Error("usage: tsx src/improvement.ts review | apply <pending-suggestion.md>");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

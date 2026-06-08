import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { buildOpsPrompt, readAgentInstructions, resolveAgentInstructionsPath } from "./prompt.js";
import { parseCodexProgressLine } from "./progress.js";
import { redactSensitive } from "./redact.js";
import type { AppConfig, CodexProgressSignal, CodexResult, OpsRequest } from "./types.js";

const ENV_ALLOWLIST = new Set([
  "HOME",
  "PATH",
  "LANG",
  "LC_ALL",
  "SHELL",
  "TERM",
  "USER",
  "LOGNAME",
  "CODEX_HOME",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "TMPDIR",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY"
]);

export interface RunCodexOptions {
  onProgress?: (signal: CodexProgressSignal) => void | Promise<void>;
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function tomlStringArray(values: string[]): string {
  return `[${values.map(tomlString).join(",")}]`;
}

export function createCodexEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};

  for (const name of ENV_ALLOWLIST) {
    if (source[name]) {
      env[name] = source[name];
    }
  }

  return env;
}

export function buildCodexArgs(config: AppConfig, request: OpsRequest, finalPath: string): string[] {
  void request;
  const agentsPath = resolveAgentInstructionsPath(config.colomboDir);
  const args = [
    "exec",
    "--ephemeral",
    "--json",
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "-C",
    config.codexWorkdir,
    "-c",
    'approval_policy="never"',
    "-c",
    `model_instructions_file=${tomlString(agentsPath)}`
  ];

  for (const serverName of config.disabledMcpServerNames) {
    args.push("-c", `mcp_servers.${serverName}.enabled=false`);
  }

  const disabledServers = new Set(config.disabledMcpServerNames);
  for (const serverName of config.mcpServerNames) {
    if (disabledServers.has(serverName)) {
      continue;
    }

    const enabledTools = config.mcpEnabledTools[serverName];
    if (enabledTools?.length) {
      args.push("-c", `mcp_servers.${serverName}.enabled_tools=${tomlStringArray(enabledTools)}`);
      args.push("-c", `mcp_servers.${serverName}.default_tools_approval_mode="approve"`);
      continue;
    }

    if (config.allowAllMcpTools) {
      args.push("-c", `mcp_servers.${serverName}.default_tools_approval_mode="approve"`);
    }
  }

  args.push("-o", finalPath, "-");
  return args;
}

function trimLines(lines: string[], maxLines: number): string {
  return lines.slice(Math.max(0, lines.length - maxLines)).join("\n");
}

async function writeMetadata(
  jobDir: string,
  request: OpsRequest,
  result: CodexResult,
  jsonEventCount: number
): Promise<void> {
  const metadata = {
    jobId: request.jobId,
    userId: request.userId,
    channelId: request.channelId,
    messageTs: request.messageTs,
    threadTs: request.threadTs,
    status: result.status,
    exitCode: result.exitCode,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    jsonEventCount,
    error: result.error
  };

  await fs.writeFile(path.join(jobDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
}

export async function runCodex(
  config: AppConfig,
  request: OpsRequest,
  options: RunCodexOptions = {}
): Promise<CodexResult> {
  const startedAt = new Date().toISOString();
  const jobDir = path.join(config.stateDir, "jobs", request.jobId);
  const finalPath = path.join(jobDir, "final.md");
  await fs.mkdir(jobDir, { recursive: true });

  await readAgentInstructions(config.colomboDir, config.agentInstructionsFile);
  const prompt = buildOpsPrompt("", request);
  const args = buildCodexArgs(config, request, finalPath);

  const child = spawn(config.codexBin, args, {
    cwd: config.codexWorkdir,
    env: createCodexEnv(),
    stdio: ["pipe", "pipe", "pipe"]
  });
  child.stdin.on("error", () => {});
  child.stdin.end(prompt);

  let jsonEventCount = 0;
  const stderrLines: string[] = [];
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 5000).unref();
  }, config.jobTimeoutMs);

  const stdoutReader = createInterface({ input: child.stdout });
  stdoutReader.on("line", (line) => {
    jsonEventCount += 1;
    const progress = parseCodexProgressLine(line);
    void Promise.resolve(options.onProgress?.({ eventCount: jsonEventCount, ...progress })).catch(() => {});
  });

  const stderrReader = createInterface({ input: child.stderr });
  stderrReader.on("line", (line) => {
    stderrLines.push(redactSensitive(line));
  });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  }).finally(() => {
    clearTimeout(timeout);
    stdoutReader.close();
    stderrReader.close();
  });

  const finishedAt = new Date().toISOString();
  const finalMessage = redactSensitive(await fs.readFile(finalPath, "utf8").catch(() => ""));
  const status = timedOut ? "timed_out" : exitCode === 0 ? "completed" : "failed";
  const stderrTail = trimLines(stderrLines, 12);
  const result: CodexResult = {
    jobId: request.jobId,
    status,
    exitCode,
    finalMessage,
    startedAt,
    finishedAt,
    ...(status === "completed" ? {} : { error: stderrTail || `codex exited with ${exitCode}` })
  };

  await writeMetadata(jobDir, request, result, jsonEventCount);
  return result;
}

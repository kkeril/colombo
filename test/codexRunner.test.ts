import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildCodexArgs, createCodexEnv, runCodex } from "../src/codexRunner.js";
import type { AppConfig, CodexProgressSignal, OpsRequest } from "../src/types.js";

const config: AppConfig = {
  slackBotToken: "xoxb-secret",
  slackAppToken: "xapp-secret",
  allowedUserIds: new Set(["U1"]),
  codexBin: "/bin/codex",
  codexWorkdir: "/workspace",
  colomboDir: "/workspace/colombo",
  agentInstructionsFile: "AGENTS.md",
  stateDir: "/var/lib/colombo",
  mcpServerNames: ["grafana", "stripe"],
  disabledMcpServerNames: ["gitlab"],
  mcpEnabledTools: {
    grafana: ["query", "list_dashboards"],
    stripe: ["get_customer"]
  },
  allowAllMcpTools: false,
  maxConcurrentJobs: 1,
  maxQueueSize: 5,
  jobTimeoutMs: 1000,
  slackReaction: "eyes",
  slackThreadLimit: 20,
  finalResponseMaxChars: 3500,
  progressUpdatesEnabled: true,
  progressMinIntervalMs: 60000,
  progressHeartbeatMs: 120000,
  feedbackEnabled: true,
  feedbackClarificationWaitMs: 86400000
};

const request: OpsRequest = {
  jobId: "colombo-test",
  userId: "U1",
  channelId: "C1",
  messageTs: "1710000000.0001",
  threadTs: "1710000000.0001",
  promptText: "status api",
  threadMessages: []
};

test("buildCodexArgs uses configured workdir, AGENTS.md, and MCP enabled tools", () => {
  const args = buildCodexArgs(config, request, "/tmp/final.md");

  assert.deepEqual(args.slice(0, 3), ["exec", "--ephemeral", "--json"]);
  assert.equal(args.includes("--skip-git-repo-check"), true);
  assert.equal(args[args.indexOf("-C") + 1], "/workspace");
  assert.equal(args.includes('model_instructions_file="/workspace/colombo/AGENTS.md"'), true);
  assert.equal(args.includes("mcp_servers.gitlab.enabled=false"), true);
  assert.equal(args.includes('mcp_servers.grafana.enabled_tools=["query","list_dashboards"]'), true);
  assert.equal(args.includes('mcp_servers.stripe.enabled_tools=["get_customer"]'), true);
  assert.equal(args.includes('mcp_servers.grafana.default_tools_approval_mode="approve"'), true);
  assert.equal(args.includes('mcp_servers.stripe.default_tools_approval_mode="approve"'), true);
  assert.equal(args[args.indexOf("-o") + 1], "/tmp/final.md");
  assert.equal(args.at(-1), "-");
  assert.equal(args.some((arg) => arg.includes("status api")), false);
});

test("buildCodexArgs supports explicit all-tools MCP escape hatch", () => {
  const args = buildCodexArgs(
    {
      ...config,
      mcpEnabledTools: {},
      allowAllMcpTools: true
    },
    request,
    "/tmp/final.md"
  );

  assert.equal(args.includes('mcp_servers.grafana.enabled_tools=["query","list_dashboards"]'), false);
  assert.equal(args.includes('mcp_servers.grafana.default_tools_approval_mode="approve"'), true);
  assert.equal(args.includes('mcp_servers.stripe.default_tools_approval_mode="approve"'), true);
});

test("buildCodexArgs always passes canonical AGENTS.md path", () => {
  const args = buildCodexArgs(
    {
      ...config,
      agentInstructionsFile: "agents.md"
    },
    request,
    "/tmp/final.md"
  );

  assert.equal(args.includes('model_instructions_file="/workspace/colombo/AGENTS.md"'), true);
  assert.equal(args.some((arg) => arg.includes("/workspace/colombo/agents.md")), false);
});

test("createCodexEnv omits slack secrets", () => {
  const env = createCodexEnv({
    HOME: "/home/colombo",
    PATH: "/bin",
    slack_bot_token: "xoxb-secret",
    slack_app_token: "xapp-secret"
  });

  assert.equal(env.HOME, "/home/colombo");
  assert.equal(env.PATH, "/bin");
  assert.equal(env.slack_bot_token, undefined);
  assert.equal(env.slack_app_token, undefined);
  assert.equal(env.STRIPE_API_KEY, undefined);
});

test("runCodex emits safe progress signals from JSONL stream", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "colombo-test-"));
  const workdir = path.join(tmp, "workdir");
  const colomboDir = path.join(tmp, "colombo");
  const stateDir = path.join(tmp, "state");
  const fakeCodex = path.join(tmp, "fake-codex.cjs");
  await fs.mkdir(workdir, { recursive: true });
  await fs.mkdir(colomboDir, { recursive: true });
  await fs.writeFile(path.join(colomboDir, "AGENTS.md"), "test agent instructions\n");
  await fs.writeFile(
    fakeCodex,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const out = process.argv[process.argv.indexOf("-o") + 1];
let prompt = "";
process.stdin.on("data", (chunk) => { prompt += chunk; });
process.stdin.on("end", () => {
  if (!prompt.includes("status api")) process.exit(2);
  console.log(JSON.stringify({ type: "item.started", item: { type: "mcp_tool_call", server: "grafana", tool: "prometheus_query" } }));
  console.log(JSON.stringify({ type: "item.started", item: { type: "mcp_tool_call", server: "database", tool: "query" } }));
  console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "Progress update: Revenue issue appears isolated to one product area." } }));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, "*Summary:* API looks normal.\\n*Confidence:* high\\n");
});
`
  );
  await fs.chmod(fakeCodex, 0o755);

  const signals: CodexProgressSignal[] = [];
  const result = await runCodex(
    {
      ...config,
      codexBin: fakeCodex,
      codexWorkdir: workdir,
      colomboDir,
      stateDir
    },
    request,
    {
      onProgress: (signal) => {
        signals.push(signal);
      }
    }
  );

  assert.equal(result.status, "completed");
  assert.match(result.finalMessage, /\*Summary:\* API looks normal/);
  assert.deepEqual(
    signals.map((signal) => signal.activity).filter(Boolean),
    ["observability metrics", "database data", "finalizing summary"]
  );
  assert.equal(
    signals.map((signal) => signal.note).find(Boolean),
    "Revenue issue appears isolated to one product area."
  );
});

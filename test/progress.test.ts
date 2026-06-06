import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyCodexEventLine,
  formatFinishedProgress,
  formatHeartbeatProgress,
  formatQueuedProgress,
  formatStartedProgress,
  parseCodexProgressLine,
  SlackProgressReporter
} from "../src/progress.js";

test("classifyCodexEventLine maps JSONL events to safe categories", () => {
  assert.equal(
    classifyCodexEventLine(
      JSON.stringify({ type: "item.started", item: { type: "mcp_tool_call", server: "grafana", tool: "alerting_list" } })
    ),
    "alerts/incidents"
  );
  assert.equal(
    classifyCodexEventLine(
      JSON.stringify({ type: "item.started", item: { type: "mcp_tool_call", server: "clickhouse", query: "select secret" } })
    ),
    "database data"
  );
  assert.equal(
    classifyCodexEventLine(
      JSON.stringify({ type: "item.started", item: { type: "mcp_tool_call", server: "stripe", tool: "list_charges" } })
    ),
    "payment data"
  );
  assert.equal(
    classifyCodexEventLine(JSON.stringify({ type: "item.started", item: { type: "command_execution", command: "env" } })),
    "local read-only checks"
  );
});

test("progress messages are human-readable and omit raw event details", () => {
  const started = formatStartedProgress("colombo-20260604T220503z-ac61e929", "status api last 30m");
  const heartbeat = formatHeartbeatProgress("colombo-test", 120000, 42, [
    "observability metrics",
    "database data"
  ], "Revenue drop appears concentrated in checkout traffic.");
  const queued = formatQueuedProgress("colombo-test", 3, 2, "who paged me?");

  assert.match(started, /\*Colombo started investigating\*/);
  assert.match(started, /> status api last 30m/);
  assert.match(started, /\*Checking:\* relevant read-only MCP tools according to `AGENTS.md`/);
  assert.match(started, /\*Job:\* `ac61e929`/);
  assert.match(heartbeat, /\*Current read:\* Revenue drop appears concentrated in checkout traffic/);
  assert.match(heartbeat, /\*Next:\* validating this against the remaining evidence/);
  assert.doesNotMatch(heartbeat, /42 Codex events|grafana metrics|clickhouse data/);
  assert.doesNotMatch(heartbeat, /select|Authorization|secret/i);
  assert.match(queued, /\*Colombo queued this investigation\*/);
  assert.match(queued, /\*Queue:\* 3 active investigations, 2 queued jobs/);
});

test("finished progress replaces stale investigation status", () => {
  assert.equal(
    formatFinishedProgress("colombo-20260605T085841z-e1bc2d80", "completed", 705000),
    "*Colombo finished investigating* (11m 45s)\nFinal summary posted below.\n*Job:* `e1bc2d80`"
  );
  assert.equal(
    formatFinishedProgress("colombo-test", "timed_out", 900000),
    "*Colombo timed out* (15m)\nFailure summary posted below.\n*Job:* `test`"
  );
});

test("parseCodexProgressLine extracts sanitized preliminary notes", () => {
  const signal = parseCodexProgressLine(
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "agent_message",
        text: "Progress update: Revenue drop seems tied to <#C123> & checkout. token=abc123"
      }
    })
  );

  assert.equal(signal?.activity, "finalizing summary");
  assert.equal(signal?.note, "Revenue drop seems tied to &lt;#C123&gt; &amp; checkout.");
  assert.doesNotMatch(signal?.note ?? "", /abc123|<#C123>/);

  const ordinaryMessage = parseCodexProgressLine(
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "agent_message",
        text: "The final answer is ready."
      }
    })
  );
  assert.equal(ordinaryMessage?.activity, "finalizing summary");
  assert.equal(ordinaryMessage?.note, undefined);
});

test("started progress escapes slack control characters from user prompt", () => {
  const started = formatStartedProgress("colombo-test", "check <@U123> & <#C123>");

  assert.match(started, /&lt;@U123&gt; &amp; &lt;#C123&gt;/);
  assert.doesNotMatch(started, /<@U123>/);
});

test("SlackProgressReporter throttles non-final progress updates", async () => {
  let now = 0;
  const posts: string[] = [];
  const reporter = new SlackProgressReporter({
    enabled: true,
    minIntervalMs: 60000,
    heartbeatMs: 120000,
    jobId: "colombo-test",
    promptText: "status api",
    now: () => now,
    post: async (text) => {
      posts.push(text);
    }
  });

  await reporter.started();
  await reporter.heartbeatNow();
  now = 59999;
  await reporter.heartbeatNow();
  now = 60000;
  reporter.record({ eventCount: 12, activity: "observability metrics" });
  await reporter.heartbeatNow();
  await reporter.finished("completed");

  assert.equal(posts.length, 3);
  assert.match(posts[0], /started investigating/);
  assert.match(posts[1], /No preliminary finding yet/);
  assert.match(posts[2], /finished investigating/);
  assert.doesNotMatch(posts[1], /observability metrics|Codex events/);
});

test("queued update suppresses immediate started update", async () => {
  let now = 0;
  const posts: string[] = [];
  const reporter = new SlackProgressReporter({
    enabled: true,
    minIntervalMs: 60000,
    heartbeatMs: 120000,
    jobId: "colombo-test",
    promptText: "status api",
    now: () => now,
    post: async (text) => {
      posts.push(text);
    }
  });

  await reporter.queued(10, 1);
  await reporter.started();
  now = 60000;
  await reporter.started();

  assert.equal(posts.length, 2);
  assert.match(posts[0], /queued job/);
  assert.match(posts[1], /started investigating/);
});

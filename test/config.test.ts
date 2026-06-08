import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

test("loadConfig parses required slack inputs and defaults", () => {
  const config = loadConfig({
    slack_bot_token: "xoxb-test",
    slack_app_token: "xapp-test",
    slack_allowed_user_ids: "U1, U2"
  });

  assert.equal(config.slackBotToken, "xoxb-test");
  assert.equal(config.slackAppToken, "xapp-test");
  assert.equal(config.allowedUserIds.has("U1"), true);
  assert.equal(config.allowedUserIds.has("U2"), true);
  assert.equal(config.maxConcurrentJobs, 1);
  assert.equal(config.codexWorkdir, "/opt/colombo");
  assert.equal(config.colomboDir, "/opt/colombo");
  assert.equal(config.agentInstructionsFile, "AGENTS.md");
  assert.deepEqual(config.mcpServerNames, []);
  assert.deepEqual(config.mcpEnabledTools, {});
  assert.equal(config.allowAllMcpTools, false);
  assert.equal(config.progressUpdatesEnabled, true);
  assert.equal(config.progressMinIntervalMs, 60000);
  assert.equal(config.progressHeartbeatMs, 120000);
  assert.equal(config.feedbackEnabled, true);
  assert.equal(config.feedbackClarificationWaitMs, 86400000);
});

test("loadConfig rejects missing allowlist", () => {
  assert.throws(
    () =>
      loadConfig({
        slack_bot_token: "xoxb-test",
        slack_app_token: "xapp-test"
      }),
    /missing or invalid config/
  );
});

test("loadConfig parses progress settings", () => {
  const config = loadConfig({
    slack_bot_token: "xoxb-test",
    slack_app_token: "xapp-test",
    slack_allowed_user_ids: "U1",
    progress_updates_enabled: "false",
    progress_min_interval_ms: "61000",
    progress_heartbeat_ms: "121000"
  });

  assert.equal(config.progressUpdatesEnabled, false);
  assert.equal(config.progressMinIntervalMs, 61000);
  assert.equal(config.progressHeartbeatMs, 121000);
});

test("loadConfig parses feedback settings", () => {
  const config = loadConfig({
    slack_bot_token: "xoxb-test",
    slack_app_token: "xapp-test",
    slack_allowed_user_ids: "U1",
    feedback_enabled: "false",
    feedback_clarification_wait_ms: "123000"
  });

  assert.equal(config.feedbackEnabled, false);
  assert.equal(config.feedbackClarificationWaitMs, 123000);
});

test("loadConfig parses MCP server names", () => {
  const config = loadConfig({
    slack_bot_token: "xoxb-test",
    slack_app_token: "xapp-test",
    slack_allowed_user_ids: "U1",
    codex_mcp_server_names: "grafana, logs,github,grafana",
    codex_disabled_mcp_server_names: "logs",
    codex_mcp_enabled_tools: JSON.stringify({
      grafana: ["query", "list_dashboards", "query"],
      github: ["search_code", "get_file"]
    })
  });

  assert.deepEqual(config.mcpServerNames, ["grafana", "logs", "github"]);
  assert.deepEqual(config.disabledMcpServerNames, ["logs"]);
  assert.deepEqual(config.mcpEnabledTools, {
    grafana: ["query", "list_dashboards"],
    github: ["search_code", "get_file"]
  });
});

test("loadConfig rejects unsafe MCP server names", () => {
  assert.throws(
    () =>
      loadConfig({
        slack_bot_token: "xoxb-test",
        slack_app_token: "xapp-test",
        slack_allowed_user_ids: "U1",
        codex_mcp_server_names: "grafana;rm"
      }),
    /invalid MCP server name/
  );
});

test("loadConfig rejects invalid MCP enabled tools JSON", () => {
  assert.throws(
    () =>
      loadConfig({
        slack_bot_token: "xoxb-test",
        slack_app_token: "xapp-test",
        slack_allowed_user_ids: "U1",
        codex_mcp_server_names: "grafana",
        codex_mcp_enabled_tools: "{"
      }),
    /codex_mcp_enabled_tools must be valid JSON/
  );
});

test("loadConfig rejects unsafe MCP tool names", () => {
  assert.throws(
    () =>
      loadConfig({
        slack_bot_token: "xoxb-test",
        slack_app_token: "xapp-test",
        slack_allowed_user_ids: "U1",
        codex_mcp_server_names: "grafana",
        codex_mcp_enabled_tools: JSON.stringify({ grafana: ["query;rm"] })
      }),
    /invalid MCP tool name/
  );
});

test("loadConfig requires explicit enabled tools for active MCP servers", () => {
  assert.throws(
    () =>
      loadConfig({
        slack_bot_token: "xoxb-test",
        slack_app_token: "xapp-test",
        slack_allowed_user_ids: "U1",
        codex_mcp_server_names: "grafana"
      }),
    /explicit non-empty tool list/
  );
});

test("loadConfig allows explicit all-tools escape hatch", () => {
  const config = loadConfig({
    slack_bot_token: "xoxb-test",
    slack_app_token: "xapp-test",
    slack_allowed_user_ids: "U1",
    codex_mcp_server_names: "grafana",
    codex_allow_all_mcp_tools: "true"
  });

  assert.deepEqual(config.mcpServerNames, ["grafana"]);
  assert.equal(config.allowAllMcpTools, true);
  assert.deepEqual(config.mcpEnabledTools, {});
});

test("loadConfig rejects non-positive numeric values", () => {
  assert.throws(
    () =>
      loadConfig({
        slack_bot_token: "xoxb-test",
        slack_app_token: "xapp-test",
        slack_allowed_user_ids: "U1",
        max_queue_size: "0"
      }),
    /max_queue_size/
  );
});

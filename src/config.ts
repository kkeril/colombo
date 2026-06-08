import path from "node:path";
import { z } from "zod";
import type { AppConfig } from "./types.js";

const DEFAULTS = {
  codexBin: "codex",
  codexWorkdir: "/opt/colombo",
  colomboDir: "/opt/colombo",
  agentInstructionsFile: "AGENTS.md",
  stateDir: "/var/lib/colombo",
  maxConcurrentJobs: 1,
  maxQueueSize: 5,
  jobTimeoutMs: 900000,
  slackReaction: "eyes",
  slackThreadLimit: 20,
  finalResponseMaxChars: 3500,
  progressUpdatesEnabled: true,
  progressMinIntervalMs: 60000,
  progressHeartbeatMs: 120000,
  feedbackEnabled: true,
  feedbackClarificationWaitMs: 86400000
};

const envSchema = z.object({
  slack_bot_token: z.string().min(1),
  slack_app_token: z.string().min(1),
  slack_allowed_user_ids: z.string().min(1),
  codex_bin: z.string().min(1).optional(),
  codex_workdir: z.string().min(1).optional(),
  colombo_dir: z.string().min(1).optional(),
  agent_instructions_file: z.string().min(1).optional(),
  state_dir: z.string().min(1).optional(),
  codex_mcp_server_names: z.string().optional(),
  codex_disabled_mcp_server_names: z.string().optional(),
  codex_mcp_enabled_tools: z.string().optional(),
  codex_allow_all_mcp_tools: z.string().optional(),
  max_concurrent_jobs: z.string().optional(),
  max_queue_size: z.string().optional(),
  job_timeout_ms: z.string().optional(),
  slack_reaction: z.string().min(1).optional(),
  slack_thread_limit: z.string().optional(),
  final_response_max_chars: z.string().optional(),
  progress_updates_enabled: z.string().optional(),
  progress_min_interval_ms: z.string().optional(),
  progress_heartbeat_ms: z.string().optional(),
  feedback_enabled: z.string().optional(),
  feedback_clarification_wait_ms: z.string().optional()
});

const SAFE_CONFIG_NAME = /^[A-Za-z0-9_-]+$/;

function parsePositiveInt(value: string | undefined, fallback: number, name: string): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseUserIds(value: string): Set<string> {
  const ids = value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error("slack_allowed_user_ids must include at least one user id");
  }

  return new Set(ids);
}

function parseBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`${name} must be a boolean`);
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  for (const name of names) {
    if (!SAFE_CONFIG_NAME.test(name)) {
      throw new Error(`invalid MCP server name: ${name}`);
    }
  }

  return [...new Set(names)];
}

function parseMcpEnabledTools(value: string | undefined): Record<string, string[]> {
  if (!value) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`codex_mcp_enabled_tools must be valid JSON: ${String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("codex_mcp_enabled_tools must be a JSON object of server names to tool arrays");
  }

  const enabledTools: Record<string, string[]> = {};
  for (const [serverName, tools] of Object.entries(parsed)) {
    if (!SAFE_CONFIG_NAME.test(serverName)) {
      throw new Error(`invalid MCP server name: ${serverName}`);
    }
    if (!Array.isArray(tools) || tools.length === 0) {
      throw new Error(`codex_mcp_enabled_tools.${serverName} must be a non-empty array`);
    }

    const cleanedTools = tools.map((tool) => {
      if (typeof tool !== "string" || !tool.trim()) {
        throw new Error(`codex_mcp_enabled_tools.${serverName} must contain tool names`);
      }

      const name = tool.trim();
      if (!SAFE_CONFIG_NAME.test(name)) {
        throw new Error(`invalid MCP tool name for ${serverName}: ${name}`);
      }
      return name;
    });
    enabledTools[serverName] = [...new Set(cleanedTools)];
  }

  return enabledTools;
}

function validateMcpToolConfig(
  mcpServerNames: string[],
  disabledMcpServerNames: string[],
  mcpEnabledTools: Record<string, string[]>,
  allowAllMcpTools: boolean
): void {
  const configuredServers = new Set(mcpServerNames);
  const disabledServers = new Set(disabledMcpServerNames);
  const activeServers = mcpServerNames.filter((serverName) => !disabledServers.has(serverName));

  for (const serverName of Object.keys(mcpEnabledTools)) {
    if (!configuredServers.has(serverName)) {
      throw new Error(`codex_mcp_enabled_tools includes unconfigured MCP server: ${serverName}`);
    }
  }

  if (allowAllMcpTools) {
    return;
  }

  for (const serverName of activeServers) {
    if (!mcpEnabledTools[serverName]?.length) {
      throw new Error(
        `codex_mcp_enabled_tools must include an explicit non-empty tool list for MCP server ${serverName}`
      );
    }
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`missing or invalid config: ${details}`);
  }

  const values = parsed.data;
  const codexWorkdir = path.resolve(values.codex_workdir ?? DEFAULTS.codexWorkdir);
  const colomboDir = path.resolve(values.colombo_dir ?? DEFAULTS.colomboDir);
  const mcpServerNames = parseList(values.codex_mcp_server_names);
  const disabledMcpServerNames = parseList(values.codex_disabled_mcp_server_names);
  const mcpEnabledTools = parseMcpEnabledTools(values.codex_mcp_enabled_tools);
  const allowAllMcpTools = parseBoolean(
    values.codex_allow_all_mcp_tools,
    false,
    "codex_allow_all_mcp_tools"
  );
  validateMcpToolConfig(mcpServerNames, disabledMcpServerNames, mcpEnabledTools, allowAllMcpTools);

  return {
    slackBotToken: values.slack_bot_token,
    slackAppToken: values.slack_app_token,
    allowedUserIds: parseUserIds(values.slack_allowed_user_ids),
    codexBin: values.codex_bin ?? DEFAULTS.codexBin,
    codexWorkdir,
    colomboDir,
    agentInstructionsFile: values.agent_instructions_file ?? DEFAULTS.agentInstructionsFile,
    stateDir: path.resolve(values.state_dir ?? DEFAULTS.stateDir),
    mcpServerNames,
    disabledMcpServerNames,
    mcpEnabledTools,
    allowAllMcpTools,
    maxConcurrentJobs: parsePositiveInt(
      values.max_concurrent_jobs,
      DEFAULTS.maxConcurrentJobs,
      "max_concurrent_jobs"
    ),
    maxQueueSize: parsePositiveInt(values.max_queue_size, DEFAULTS.maxQueueSize, "max_queue_size"),
    jobTimeoutMs: parsePositiveInt(values.job_timeout_ms, DEFAULTS.jobTimeoutMs, "job_timeout_ms"),
    slackReaction: values.slack_reaction ?? DEFAULTS.slackReaction,
    slackThreadLimit: parsePositiveInt(
      values.slack_thread_limit,
      DEFAULTS.slackThreadLimit,
      "slack_thread_limit"
    ),
    finalResponseMaxChars: parsePositiveInt(
      values.final_response_max_chars,
      DEFAULTS.finalResponseMaxChars,
      "final_response_max_chars"
    ),
    progressUpdatesEnabled: parseBoolean(
      values.progress_updates_enabled,
      DEFAULTS.progressUpdatesEnabled,
      "progress_updates_enabled"
    ),
    progressMinIntervalMs: parsePositiveInt(
      values.progress_min_interval_ms,
      DEFAULTS.progressMinIntervalMs,
      "progress_min_interval_ms"
    ),
    progressHeartbeatMs: parsePositiveInt(
      values.progress_heartbeat_ms,
      DEFAULTS.progressHeartbeatMs,
      "progress_heartbeat_ms"
    ),
    feedbackEnabled: parseBoolean(
      values.feedback_enabled,
      DEFAULTS.feedbackEnabled,
      "feedback_enabled"
    ),
    feedbackClarificationWaitMs: parsePositiveInt(
      values.feedback_clarification_wait_ms,
      DEFAULTS.feedbackClarificationWaitMs,
      "feedback_clarification_wait_ms"
    )
  };
}

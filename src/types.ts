export type CodexRunStatus = "completed" | "failed" | "timed_out";

export interface AppConfig {
  slackBotToken: string;
  slackAppToken: string;
  allowedUserIds: Set<string>;
  codexBin: string;
  codexWorkdir: string;
  colomboDir: string;
  agentInstructionsFile: string;
  stateDir: string;
  mcpServerNames: string[];
  disabledMcpServerNames: string[];
  maxConcurrentJobs: number;
  maxQueueSize: number;
  jobTimeoutMs: number;
  slackReaction: string;
  slackThreadLimit: number;
  finalResponseMaxChars: number;
  progressUpdatesEnabled: boolean;
  progressMinIntervalMs: number;
  progressHeartbeatMs: number;
  feedbackEnabled: boolean;
  feedbackClarificationWaitMs: number;
}

export interface SlackThreadMessage {
  ts: string;
  text: string;
  user?: string;
  botId?: string;
}

export interface OpsRequest {
  jobId: string;
  userId: string;
  channelId: string;
  messageTs: string;
  threadTs: string;
  promptText: string;
  threadMessages: SlackThreadMessage[];
}

export interface CodexResult {
  jobId: string;
  status: CodexRunStatus;
  exitCode: number | null;
  finalMessage: string;
  startedAt: string;
  finishedAt: string;
  error?: string;
}

export type ProgressActivity =
  | "observability metrics"
  | "alerts/incidents"
  | "logs/traces"
  | "payment data"
  | "product analytics"
  | "database data"
  | "repository/code"
  | "docs/runbooks"
  | "local read-only checks"
  | "mcp data"
  | "finalizing summary";

export interface CodexProgressSignal {
  eventCount: number;
  activity?: ProgressActivity;
  note?: string;
}

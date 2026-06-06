import type { CodexProgressSignal, CodexRunStatus, ProgressActivity } from "./types.js";
import { redactSensitive } from "./redact.js";

export interface ProgressPost {
  text: string;
  forced?: boolean;
}

export interface SlackProgressReporterOptions {
  enabled: boolean;
  minIntervalMs: number;
  heartbeatMs: number;
  jobId: string;
  promptText: string;
  post: (text: string) => Promise<void>;
  now?: () => number;
}

const ACTIVITY_ORDER: ProgressActivity[] = [
  "alerts/incidents",
  "observability metrics",
  "logs/traces",
  "database data",
  "product analytics",
  "payment data",
  "repository/code",
  "docs/runbooks",
  "local read-only checks",
  "mcp data",
  "finalizing summary"
];

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

function cleanPrompt(text: string, maxLength = 120): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1)}...`;
}

function escapeSlackText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatPromptQuote(promptText: string): string {
  return `> ${escapeSlackText(cleanPrompt(promptText))}`;
}

function shortJobId(jobId: string): string {
  return jobId.split("-").at(-1) ?? jobId;
}

function sanitizeProgressNote(text: string, maxLength = 220): string | undefined {
  const redacted = redactSensitive(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/https?:\/\/\S+/g, "<link>")
    .replace(/\s+/g, " ")
    .trim();

  if (!/^progress update:\s*/i.test(redacted)) {
    return undefined;
  }

  const withoutLabels = redacted.replace(/^progress update:\s*/i, "");
  if (!withoutLabels || withoutLabels.length < 12) {
    return undefined;
  }

  const firstSentence = withoutLabels.match(/^(.+?[.!?])(?:\s|$)/)?.[1] ?? withoutLabels;
  const clipped = firstSentence.length > maxLength ? `${firstSentence.slice(0, maxLength - 1)}...` : firstSentence;
  return escapeSlackText(clipped.trim());
}

function readStringPath(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
  }
  return [];
}

export function formatQueuedProgress(
  jobId: string,
  active: number,
  waitingAhead: number,
  promptText = ""
): string {
  const investigations = active === 1 ? "investigation" : "investigations";
  const queued = waitingAhead === 1 ? "job" : "jobs";
  const request = promptText ? `${formatPromptQuote(promptText)}\n` : "";
  return [
    "*Colombo queued this investigation*",
    request.trimEnd(),
    `*Queue:* ${active} active ${investigations}, ${waitingAhead} queued ${queued}.`,
    `*Job:* \`${shortJobId(jobId)}\``
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatStartedProgress(jobId: string, promptText: string): string {
  return [
    "*Colombo started investigating*",
    formatPromptQuote(promptText),
    "*Checking:* relevant read-only MCP tools according to `AGENTS.md`.",
    `*Job:* \`${shortJobId(jobId)}\``
  ].join("\n");
}

export function formatHeartbeatProgress(
  jobId: string,
  elapsedMs: number,
  eventCount: number,
  activities: readonly ProgressActivity[],
  note?: string
): string {
  void eventCount;
  void activities;
  const finding = note ?? "No preliminary finding yet; still correlating evidence.";
  const next = note ? "validating this against the remaining evidence." : "I’ll post the conclusion when there is enough evidence.";
  return [
    `*Colombo is still investigating* (${formatElapsed(elapsedMs)})`,
    `*Current read:* ${finding}`,
    `*Next:* ${next}`,
    `*Job:* \`${shortJobId(jobId)}\``
  ].join("\n");
}

export function formatFinishedProgress(
  jobId: string,
  status: CodexRunStatus,
  elapsedMs: number
): string {
  if (status === "completed") {
    return [
      `*Colombo finished investigating* (${formatElapsed(elapsedMs)})`,
      "Final summary posted below.",
      `*Job:* \`${shortJobId(jobId)}\``
    ].join("\n");
  }

  const label = status === "timed_out" ? "timed out" : "failed";
  return [
    `*Colombo ${label}* (${formatElapsed(elapsedMs)})`,
    "Failure summary posted below.",
    `*Job:* \`${shortJobId(jobId)}\``
  ].join("\n");
}

function classifyRawEvent(raw: string): ProgressActivity | undefined {
  if (/alert|incident|pager|oncall/.test(raw)) {
    return "alerts/incidents";
  }
  if (/loki|log|trace|exception|sentry/.test(raw)) {
    return "logs/traces";
  }
  if (/grafana|prometheus|promql|metric|dashboard|panel|victoria|datadog|cloudwatch/.test(raw)) {
    return "observability metrics";
  }
  if (/stripe|paypal|paddle|charge|invoice|payment|refund|subscription/.test(raw)) {
    return "payment data";
  }
  if (/posthog|amplitude|segment|analytics|funnel|cohort|event/.test(raw)) {
    return "product analytics";
  }
  if (/postgres|mysql|clickhouse|bigquery|snowflake|database|sql|table|row/.test(raw)) {
    return "database data";
  }
  if (/github|gitlab|repo|repository|commit|pull request|branch|file_search|code/.test(raw)) {
    return "repository/code";
  }
  if (/docs|wiki|runbook|notion|confluence|markdown/.test(raw)) {
    return "docs/runbooks";
  }
  if (/mcp/.test(raw)) {
    return "mcp data";
  }
  return undefined;
}

export function parseCodexProgressLine(line: string): CodexProgressSignal | undefined {
  let event: unknown;
  try {
    event = JSON.parse(line);
  } catch {
    return undefined;
  }

  if (!event || typeof event !== "object") {
    return undefined;
  }

  const record = event as Record<string, unknown>;
  const raw = JSON.stringify(record).toLowerCase();
  const type = typeof record.type === "string" ? record.type : "";
  const item = record.item && typeof record.item === "object" ? (record.item as Record<string, unknown>) : {};
  const itemType = typeof item.type === "string" ? item.type : "";
  const eventCount = 0;
  let note: string | undefined;

  if (type.includes("agent_message") || itemType === "agent_message") {
    note = sanitizeProgressNote(readStringPath(item.text) ?? readStringPath(record.text) ?? "");
    return { eventCount, activity: "finalizing summary", note };
  }

  if (type.includes("reasoning") || itemType === "reasoning") {
    note = collectStrings(item.summary ?? item.text ?? record.summary ?? record.text)
      .map((candidate) => sanitizeProgressNote(candidate))
      .find(Boolean);
    return { eventCount, activity: note ? "finalizing summary" : undefined, note };
  }

  if (itemType === "command_execution") {
    return { eventCount, activity: "local read-only checks" };
  }

  const activity = classifyRawEvent(raw);
  return { eventCount, activity };
}

export function classifyCodexEventLine(line: string): ProgressActivity | undefined {
  return parseCodexProgressLine(line)?.activity;
}

export class ProgressState {
  private readonly activities = new Set<ProgressActivity>();
  private eventCount = 0;
  private latestNote: string | undefined;

  record(signal: CodexProgressSignal): void {
    this.eventCount = Math.max(this.eventCount, signal.eventCount);
    if (signal.activity) {
      this.activities.add(signal.activity);
    }
    if (signal.note) {
      this.latestNote = signal.note;
    }
  }

  getEventCount(): number {
    return this.eventCount;
  }

  getActivities(): ProgressActivity[] {
    return ACTIVITY_ORDER.filter((activity) => this.activities.has(activity));
  }

  getLatestNote(): string | undefined {
    return this.latestNote;
  }
}

export class SlackProgressReporter {
  private readonly state = new ProgressState();
  private readonly startedAt: number;
  private readonly now: () => number;
  private heartbeat: NodeJS.Timeout | undefined;
  private lastPostedAt: number | undefined;

  constructor(private readonly options: SlackProgressReporterOptions) {
    this.now = options.now ?? Date.now;
    this.startedAt = this.now();
  }

  record(signal: CodexProgressSignal): void {
    this.state.record(signal);
  }

  async queued(active: number, waiting: number): Promise<void> {
    await this.post(formatQueuedProgress(this.options.jobId, active, waiting, this.options.promptText), true);
  }

  async started(): Promise<void> {
    await this.post(formatStartedProgress(this.options.jobId, this.options.promptText));
  }

  startHeartbeat(): void {
    if (!this.options.enabled || this.heartbeat) {
      return;
    }

    this.heartbeat = setInterval(() => {
      void this.post(this.buildHeartbeat());
    }, this.options.heartbeatMs);
    this.heartbeat.unref();
  }

  stop(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
  }

  async heartbeatNow(): Promise<void> {
    await this.post(this.buildHeartbeat());
  }

  async finished(status: CodexRunStatus): Promise<void> {
    await this.post(formatFinishedProgress(this.options.jobId, status, this.now() - this.startedAt), true);
  }

  private buildHeartbeat(): string {
    return formatHeartbeatProgress(
      this.options.jobId,
      this.now() - this.startedAt,
      this.state.getEventCount(),
      this.state.getActivities(),
      this.state.getLatestNote()
    );
  }

  private async post(text: string, force = false): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const currentTime = this.now();
    if (!force && this.lastPostedAt !== undefined && currentTime - this.lastPostedAt < this.options.minIntervalMs) {
      return;
    }

    this.lastPostedAt = currentTime;
    await this.options.post(text);
  }
}

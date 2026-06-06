import fs from "node:fs/promises";
import path from "node:path";
import { redactSensitive } from "./redact.js";
import type { CodexProgressSignal, CodexResult, OpsRequest } from "./types.js";

export type FeedbackRating = "positive" | "partial" | "negative";
export type FeedbackStatus =
  | "awaiting_reaction"
  | "positive"
  | "pending_clarification"
  | "partial_with_clarification"
  | "negative_with_clarification"
  | "expired_no_clarification";

export interface FeedbackResultIndex {
  jobId: string;
  requesterUserId: string;
  channelId: string;
  threadTs: string;
  requestMessageTs: string;
  finalMessageTs: string;
}

export interface PendingFeedbackIndex extends FeedbackResultIndex {
  rating: Exclude<FeedbackRating, "positive">;
  reaction: string;
  reactionTs: string;
  expiresAt: string;
}

export interface PendingFeedback extends PendingFeedbackIndex {
  indexPath: string;
}

export interface FeedbackRecord extends FeedbackResultIndex {
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  rating?: FeedbackRating;
  reaction?: string;
  reactionUserId?: string;
  reactionTs?: string;
  expiresAt?: string;
  clarificationPromptTs?: string;
  clarification?: {
    text: string;
    messageTs: string;
    receivedAt: string;
  };
}

export const POSITIVE_FEEDBACK_REACTIONS = new Set(["+1", "thumbsup"]);
export const PARTIAL_FEEDBACK_REACTIONS = new Set(["thinking_face", "neutral_face"]);
export const NEGATIVE_FEEDBACK_REACTIONS = new Set(["poop", "hankey"]);

function safeKey(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

function jsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function jsonPretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sanitizeStoredText(text: string, maxLength = 8000): string {
  const redacted = redactSensitive(text).trim();
  if (redacted.length <= maxLength) {
    return redacted;
  }

  return `${redacted.slice(0, maxLength - 1)}...`;
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

export class FeedbackStore {
  constructor(
    private readonly stateDir: string,
    private readonly clarificationWaitMs: number,
    private readonly now: () => Date = () => new Date()
  ) {}

  private jobsDir(): string {
    return path.join(this.stateDir, "jobs");
  }

  private jobDir(jobId: string): string {
    return path.join(this.jobsDir(), jobId);
  }

  private feedbackPath(jobId: string): string {
    return path.join(this.jobDir(jobId), "feedback.json");
  }

  private requestPath(jobId: string): string {
    return path.join(this.jobDir(jobId), "request.json");
  }

  private worklogPath(jobId: string): string {
    return path.join(this.jobDir(jobId), "worklog.jsonl");
  }

  private indexDir(): string {
    return path.join(this.stateDir, "feedback-index");
  }

  private resultIndexDir(): string {
    return path.join(this.indexDir(), "result-messages");
  }

  private pendingIndexDir(): string {
    return path.join(this.indexDir(), "pending");
  }

  private resultIndexPath(channelId: string, finalMessageTs: string): string {
    return path.join(this.resultIndexDir(), `${safeKey(channelId)}_${safeKey(finalMessageTs)}.json`);
  }

  private pendingIndexPath(index: FeedbackResultIndex): string {
    return path.join(
      this.pendingIndexDir(),
      `${safeKey(index.channelId)}_${safeKey(index.threadTs)}_${safeKey(index.requesterUserId)}_${safeKey(index.finalMessageTs)}.json`
    );
  }

  private async ensureJobDir(jobId: string): Promise<void> {
    await fs.mkdir(this.jobDir(jobId), { recursive: true });
  }

  private async readFeedback(jobId: string): Promise<FeedbackRecord | undefined> {
    const text = await fs.readFile(this.feedbackPath(jobId), "utf8").catch(() => "");
    if (!text) {
      return undefined;
    }

    return JSON.parse(text) as FeedbackRecord;
  }

  async writeRequest(request: OpsRequest, createdAt = nowIso(this.now)): Promise<void> {
    await this.ensureJobDir(request.jobId);
    await fs.writeFile(
      this.requestPath(request.jobId),
      jsonPretty({
        jobId: request.jobId,
        requesterUserId: request.userId,
        channelId: request.channelId,
        messageTs: request.messageTs,
        threadTs: request.threadTs,
        promptText: sanitizeStoredText(request.promptText),
        createdAt
      })
    );
    await this.appendWorkLog(request.jobId, {
      type: "request_created",
      requesterUserId: request.userId,
      channelId: request.channelId,
      messageTs: request.messageTs,
      threadTs: request.threadTs
    });
  }

  async appendWorkLog(jobId: string, event: Record<string, unknown>): Promise<void> {
    await this.ensureJobDir(jobId);
    await fs.appendFile(
      this.worklogPath(jobId),
      jsonLine({
        at: nowIso(this.now),
        ...event
      })
    );
  }

  async appendProgressSignal(jobId: string, signal: CodexProgressSignal): Promise<void> {
    if (!signal.activity && !signal.note) {
      return;
    }

    await this.appendWorkLog(jobId, {
      type: "codex_progress",
      eventCount: signal.eventCount,
      ...(signal.activity ? { activity: signal.activity } : {}),
      ...(signal.note ? { note: sanitizeStoredText(signal.note, 1000) } : {})
    });
  }

  async registerFinalResult(
    request: OpsRequest,
    result: CodexResult,
    finalMessageTs: string
  ): Promise<void> {
    const createdAt = nowIso(this.now);
    const index: FeedbackResultIndex = {
      jobId: request.jobId,
      requesterUserId: request.userId,
      channelId: request.channelId,
      threadTs: request.threadTs,
      requestMessageTs: request.messageTs,
      finalMessageTs
    };
    const feedback: FeedbackRecord = {
      ...index,
      status: "awaiting_reaction",
      createdAt,
      updatedAt: createdAt
    };

    await this.ensureJobDir(request.jobId);
    await fs.mkdir(this.resultIndexDir(), { recursive: true });
    await fs.writeFile(this.feedbackPath(request.jobId), jsonPretty(feedback));
    await fs.writeFile(this.resultIndexPath(request.channelId, finalMessageTs), jsonPretty(index));
    await this.appendWorkLog(request.jobId, {
      type: "job_finished",
      status: result.status,
      exitCode: result.exitCode,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt
    });
    await this.appendWorkLog(request.jobId, {
      type: "feedback_requested",
      finalMessageTs
    });
  }

  async findResultIndex(channelId: string, finalMessageTs: string): Promise<FeedbackResultIndex | undefined> {
    const text = await fs.readFile(this.resultIndexPath(channelId, finalMessageTs), "utf8").catch(() => "");
    if (!text) {
      return undefined;
    }

    return JSON.parse(text) as FeedbackResultIndex;
  }

  async listAwaitingFeedbackResults(): Promise<FeedbackResultIndex[]> {
    const entries = await fs.readdir(this.resultIndexDir()).catch(() => []);
    const indexes: FeedbackResultIndex[] = [];

    for (const entry of entries) {
      const indexPath = path.join(this.resultIndexDir(), entry);
      const text = await fs.readFile(indexPath, "utf8").catch(() => "");
      if (!text) {
        continue;
      }

      const index = JSON.parse(text) as FeedbackResultIndex;
      const existing = await this.readFeedback(index.jobId);
      if (existing?.status === "awaiting_reaction") {
        indexes.push(index);
      }
    }

    return indexes.sort((left, right) => {
      return Number.parseFloat(left.requestMessageTs) - Number.parseFloat(right.requestMessageTs);
    });
  }

  async recordPositive(index: FeedbackResultIndex, reaction: string, reactionTs: string): Promise<FeedbackRecord> {
    const timestamp = nowIso(this.now);
    const existing = await this.readFeedback(index.jobId);
    const record: FeedbackRecord = {
      ...index,
      status: "positive",
      rating: "positive",
      reaction,
      reactionUserId: index.requesterUserId,
      reactionTs,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };

    await fs.writeFile(this.feedbackPath(index.jobId), jsonPretty(record));
    await this.removePendingForJob(index.jobId);
    await this.appendWorkLog(index.jobId, {
      type: "feedback_reaction",
      rating: "positive",
      reaction,
      reactionTs
    });
    return record;
  }

  async recordPartial(index: FeedbackResultIndex, reaction: string, reactionTs: string): Promise<FeedbackRecord> {
    return this.recordNeedsClarification(index, "partial", reaction, reactionTs);
  }

  async recordNegative(index: FeedbackResultIndex, reaction: string, reactionTs: string): Promise<FeedbackRecord> {
    return this.recordNeedsClarification(index, "negative", reaction, reactionTs);
  }

  private async recordNeedsClarification(
    index: FeedbackResultIndex,
    rating: Exclude<FeedbackRating, "positive">,
    reaction: string,
    reactionTs: string
  ): Promise<FeedbackRecord> {
    const timestamp = nowIso(this.now);
    const expiresAt = new Date(this.now().getTime() + this.clarificationWaitMs).toISOString();
    const existing = await this.readFeedback(index.jobId);
    const record: FeedbackRecord = {
      ...index,
      status: "pending_clarification",
      rating,
      reaction,
      reactionUserId: index.requesterUserId,
      reactionTs,
      expiresAt,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };
    const pending: PendingFeedbackIndex = {
      ...index,
      rating,
      reaction,
      reactionTs,
      expiresAt
    };

    await fs.mkdir(this.pendingIndexDir(), { recursive: true });
    await fs.writeFile(this.feedbackPath(index.jobId), jsonPretty(record));
    await fs.writeFile(this.pendingIndexPath(index), jsonPretty(pending));
    await this.appendWorkLog(index.jobId, {
      type: "feedback_reaction",
      rating,
      reaction,
      reactionTs,
      expiresAt
    });
    return record;
  }

  async recordClarificationPrompt(
    index: FeedbackResultIndex,
    clarificationPromptTs: string | undefined
  ): Promise<void> {
    const existing = await this.readFeedback(index.jobId);
    if (!existing || existing.status !== "pending_clarification") {
      return;
    }

    await fs.writeFile(
      this.feedbackPath(index.jobId),
      jsonPretty({
        ...existing,
        ...(clarificationPromptTs ? { clarificationPromptTs } : {}),
        updatedAt: nowIso(this.now)
      })
    );
    await this.appendWorkLog(index.jobId, {
      type: "feedback_clarification_requested",
      ...(clarificationPromptTs ? { clarificationPromptTs } : {})
    });
  }

  async findPendingClarification(
    channelId: string,
    threadTs: string,
    userId: string
  ): Promise<PendingFeedback | undefined> {
    await this.expirePendingFeedback();
    const entries = await fs.readdir(this.pendingIndexDir()).catch(() => []);
    const matches: PendingFeedback[] = [];

    for (const entry of entries) {
      const indexPath = path.join(this.pendingIndexDir(), entry);
      const text = await fs.readFile(indexPath, "utf8").catch(() => "");
      if (!text) {
        continue;
      }

      const pending = JSON.parse(text) as PendingFeedbackIndex;
      if (
        pending.channelId === channelId &&
        pending.threadTs === threadTs &&
        pending.requesterUserId === userId
      ) {
        matches.push({ ...pending, indexPath });
      }
    }

    return matches.sort((left, right) => Date.parse(right.reactionTs) - Date.parse(left.reactionTs))[0];
  }

  async listPendingClarifications(): Promise<PendingFeedback[]> {
    await this.expirePendingFeedback();
    const entries = await fs.readdir(this.pendingIndexDir()).catch(() => []);
    const pendingFeedback: PendingFeedback[] = [];

    for (const entry of entries) {
      const indexPath = path.join(this.pendingIndexDir(), entry);
      const text = await fs.readFile(indexPath, "utf8").catch(() => "");
      if (!text) {
        continue;
      }

      pendingFeedback.push({
        ...(JSON.parse(text) as PendingFeedbackIndex),
        indexPath
      });
    }

    return pendingFeedback.sort((left, right) => Date.parse(left.reactionTs) - Date.parse(right.reactionTs));
  }

  async recordClarification(
    pending: PendingFeedback,
    text: string,
    messageTs: string
  ): Promise<FeedbackRecord> {
    const timestamp = nowIso(this.now);
    const existing = await this.readFeedback(pending.jobId);
    const record: FeedbackRecord = {
      ...pending,
      status: pending.rating === "partial" ? "partial_with_clarification" : "negative_with_clarification",
      rating: pending.rating,
      reaction: pending.reaction,
      reactionUserId: pending.requesterUserId,
      reactionTs: pending.reactionTs,
      expiresAt: pending.expiresAt,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      clarificationPromptTs: existing?.clarificationPromptTs,
      clarification: {
        text: sanitizeStoredText(text),
        messageTs,
        receivedAt: timestamp
      }
    };

    delete (record as { indexPath?: string }).indexPath;
    await fs.writeFile(this.feedbackPath(pending.jobId), jsonPretty(record));
    await fs.unlink(pending.indexPath).catch(() => {});
    await this.appendWorkLog(pending.jobId, {
      type: "feedback_clarification_saved",
      messageTs
    });
    return record;
  }

  async expirePendingFeedback(): Promise<void> {
    const entries = await fs.readdir(this.pendingIndexDir()).catch(() => []);
    const currentTime = this.now().getTime();

    for (const entry of entries) {
      const indexPath = path.join(this.pendingIndexDir(), entry);
      const text = await fs.readFile(indexPath, "utf8").catch(() => "");
      if (!text) {
        continue;
      }

      const pending = JSON.parse(text) as PendingFeedbackIndex;
      if (Date.parse(pending.expiresAt) > currentTime) {
        continue;
      }

      const existing = await this.readFeedback(pending.jobId);
      if (existing?.status === "pending_clarification") {
        await fs.writeFile(
          this.feedbackPath(pending.jobId),
          jsonPretty({
            ...existing,
            status: "expired_no_clarification",
            updatedAt: nowIso(this.now)
          })
        );
        await this.appendWorkLog(pending.jobId, {
          type: "feedback_clarification_expired",
          expiresAt: pending.expiresAt
        });
      }

      await fs.unlink(indexPath).catch(() => {});
    }
  }

  private async removePendingForJob(jobId: string): Promise<void> {
    const entries = await fs.readdir(this.pendingIndexDir()).catch(() => []);
    for (const entry of entries) {
      const indexPath = path.join(this.pendingIndexDir(), entry);
      const text = await fs.readFile(indexPath, "utf8").catch(() => "");
      if (!text) {
        continue;
      }

      const pending = JSON.parse(text) as PendingFeedbackIndex;
      if (pending.jobId === jobId) {
        await fs.unlink(indexPath).catch(() => {});
      }
    }
  }
}

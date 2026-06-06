import { randomUUID } from "node:crypto";
import { App, LogLevel, SocketModeReceiver } from "@slack/bolt";
import { runCodex } from "./codexRunner.js";
import {
  FeedbackStore,
  type FeedbackResultIndex,
  type PendingFeedback,
  NEGATIVE_FEEDBACK_REACTIONS,
  PARTIAL_FEEDBACK_REACTIONS,
  POSITIVE_FEEDBACK_REACTIONS
} from "./feedback.js";
import { JobQueue, QueueFullError } from "./jobQueue.js";
import { logger } from "./logger.js";
import { stripBotMention } from "./prompt.js";
import { SlackProgressReporter } from "./progress.js";
import { formatFinalReply } from "./slackFormatting.js";
import type { AppConfig, OpsRequest, SlackThreadMessage } from "./types.js";

interface AppMentionEvent {
  type: "app_mention";
  user?: string;
  channel: string;
  text?: string;
  ts: string;
  thread_ts?: string;
}

interface ReactionAddedEvent {
  type: "reaction_added";
  user?: string;
  reaction?: string;
  item?: {
    type?: string;
    channel?: string;
    ts?: string;
  };
  event_ts?: string;
}

interface MessageEvent {
  type: "message";
  user?: string;
  channel?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  subtype?: string;
  bot_id?: string;
}

interface MessageWithReactions {
  ts?: string;
  user?: string;
  text?: string;
  subtype?: string;
  bot_id?: string;
  reactions?: Array<{
    name?: string;
    users?: string[];
  }>;
}

export interface SlackClient {
  chat: {
    postEphemeral(args: { channel: string; user: string; text: string; mrkdwn: boolean }): Promise<unknown>;
    postMessage(args: {
      channel: string;
      thread_ts: string;
      text: string;
      mrkdwn: boolean;
      unfurl_links: boolean;
      unfurl_media: boolean;
    }): Promise<unknown>;
    update(args: {
      channel: string;
      ts: string;
      text: string;
      mrkdwn: boolean;
    }): Promise<unknown>;
  };
  conversations: {
    replies(args: { channel: string; ts: string; limit: number }): Promise<{ messages?: unknown[] }>;
  };
  reactions: {
    add(args: { channel: string; timestamp: string; name: string }): Promise<unknown>;
  };
}

function createJobId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "z");
  return `colombo-${stamp}-${randomUUID().slice(0, 8)}`;
}

function normalizeSlackMessages(messages: unknown[]): SlackThreadMessage[] {
  return messages.flatMap((message) => {
    if (!message || typeof message !== "object") {
      return [];
    }

    const item = message as Record<string, unknown>;
    const ts = typeof item.ts === "string" ? item.ts : "";
    const text = typeof item.text === "string" ? item.text : "";
    if (!ts || !text) {
      return [];
    }

    return [
      {
        ts,
        text,
        user: typeof item.user === "string" ? item.user : undefined,
        botId: typeof item.bot_id === "string" ? item.bot_id : undefined
      }
    ];
  });
}

async function postEphemeral(
  client: SlackClient,
  channel: string,
  user: string,
  text: string
): Promise<void> {
  await client.chat
    .postEphemeral({
      channel,
      user,
      text,
      mrkdwn: true
    })
    .catch((error: unknown) => {
      logger.warn("failed to post ephemeral slack response", { error: String(error), channel, user });
    });
}

async function fetchThreadContext(
  client: SlackClient,
  channel: string,
  threadTs: string,
  limit: number
): Promise<SlackThreadMessage[]> {
  const response = await client.conversations.replies({
    channel,
    ts: threadTs,
    limit
  });

  return normalizeSlackMessages(response.messages ?? []);
}

async function addReaction(
  client: SlackClient,
  channel: string,
  timestamp: string,
  reaction: string
): Promise<void> {
  await client.reactions
    .add({
      channel,
      timestamp,
      name: reaction
    })
    .catch((error: unknown) => {
      logger.warn("failed to add slack reaction", { error: String(error), channel, timestamp });
    });
}

async function postThreadReply(
  client: SlackClient,
  channel: string,
  threadTs: string,
  text: string
): Promise<string | undefined> {
  const response = await client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text,
    mrkdwn: true,
    unfurl_links: false,
    unfurl_media: false
  });

  return readSlackMessageTs(response);
}

function readSlackMessageTs(response: unknown): string | undefined {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const ts = (response as Record<string, unknown>).ts;
  return typeof ts === "string" && ts ? ts : undefined;
}

function slackTimestampToIso(timestamp: string | undefined): string {
  const seconds = Number.parseFloat(timestamp ?? "");
  if (!Number.isFinite(seconds)) {
    return new Date().toISOString();
  }

  return new Date(seconds * 1000).toISOString();
}

function findRequesterFeedbackReaction(
  messages: unknown[],
  index: FeedbackResultIndex
): string | undefined {
  const finalMessage = messages.find((message): message is MessageWithReactions => {
    return Boolean(message && typeof message === "object" && (message as MessageWithReactions).ts === index.finalMessageTs);
  });
  if (!finalMessage?.reactions) {
    return undefined;
  }

  const supportedReactions = new Set([
    ...NEGATIVE_FEEDBACK_REACTIONS,
    ...PARTIAL_FEEDBACK_REACTIONS,
    ...POSITIVE_FEEDBACK_REACTIONS
  ]);
  const requesterReaction = finalMessage.reactions.find((reaction) => {
    return Boolean(
      reaction.name &&
        supportedReactions.has(reaction.name) &&
        reaction.users?.includes(index.requesterUserId)
    );
  });

  return requesterReaction?.name;
}

function findRequesterClarification(
  messages: unknown[],
  pending: PendingFeedback
): MessageWithReactions | undefined {
  const afterReactionSeconds = Date.parse(pending.reactionTs) / 1000;

  return messages.find((message): message is MessageWithReactions => {
    if (!message || typeof message !== "object") {
      return false;
    }

    const item = message as MessageWithReactions;
    const messageSeconds = Number.parseFloat(item.ts ?? "");
    return Boolean(
      item.user === pending.requesterUserId &&
        item.text &&
        !item.subtype &&
        !item.bot_id &&
        Number.isFinite(messageSeconds) &&
        messageSeconds > afterReactionSeconds
    );
  });
}

async function safeFeedbackWrite(
  description: string,
  jobId: string,
  operation: Promise<unknown>
): Promise<void> {
  await operation.catch((error: unknown) => {
    logger.warn(description, { jobId, error: String(error) });
  });
}

export class SlackProgressMessage {
  private messageTs: string | undefined;

  constructor(
    private readonly client: SlackClient,
    private readonly channel: string,
    private readonly threadTs: string,
    private readonly jobId: string
  ) {}

  async post(text: string): Promise<void> {
    if (!this.messageTs) {
      await this.postFirstStatus(text);
      return;
    }

    await this.updateStatus(text);
  }

  private async postFirstStatus(text: string): Promise<void> {
    try {
      this.messageTs = await postThreadReply(this.client, this.channel, this.threadTs, text);
      if (!this.messageTs) {
        logger.warn("slack progress reply did not include message timestamp", { jobId: this.jobId });
      }
    } catch (error) {
      logger.warn("failed to post colombo progress reply", { jobId: this.jobId, error: String(error) });
    }
  }

  private async updateStatus(text: string): Promise<void> {
    try {
      await this.client.chat.update({
        channel: this.channel,
        ts: this.messageTs!,
        text,
        mrkdwn: true
      });
    } catch (error) {
      logger.warn("failed to update colombo progress reply", { jobId: this.jobId, error: String(error) });
    }
  }
}

export async function handleFeedbackReaction(
  feedbackStore: FeedbackStore,
  client: SlackClient,
  event: ReactionAddedEvent
): Promise<void> {
  const user = event.user;
  const reaction = event.reaction;
  const item = event.item;
  if (!user || !reaction || item?.type !== "message" || !item.channel || !item.ts) {
    return;
  }

  if (
    !POSITIVE_FEEDBACK_REACTIONS.has(reaction) &&
    !PARTIAL_FEEDBACK_REACTIONS.has(reaction) &&
    !NEGATIVE_FEEDBACK_REACTIONS.has(reaction)
  ) {
    return;
  }

  const index = await feedbackStore.findResultIndex(item.channel, item.ts);
  if (!index || index.requesterUserId !== user) {
    return;
  }

  const reactionTs = slackTimestampToIso(event.event_ts);
  if (POSITIVE_FEEDBACK_REACTIONS.has(reaction)) {
    await recordFeedbackReaction(feedbackStore, client, index, reaction, reactionTs);
    return;
  }

  await recordFeedbackReaction(feedbackStore, client, index, reaction, reactionTs);
}

async function recordFeedbackReaction(
  feedbackStore: FeedbackStore,
  client: SlackClient,
  index: FeedbackResultIndex,
  reaction: string,
  reactionTs: string
): Promise<void> {
  if (POSITIVE_FEEDBACK_REACTIONS.has(reaction)) {
    await feedbackStore.recordPositive(index, reaction, reactionTs);
    return;
  }

  if (PARTIAL_FEEDBACK_REACTIONS.has(reaction)) {
    await feedbackStore.recordPartial(index, reaction, reactionTs);
  } else {
    await feedbackStore.recordNegative(index, reaction, reactionTs);
  }

  const promptTs = await postThreadReply(
    client,
    index.channelId,
    index.threadTs,
    `<@${index.requesterUserId}> *What was missing, wrong, or incomplete in this result?*
I’ll save it for Colombo improvement review.`
  );
  await feedbackStore.recordClarificationPrompt(index, promptTs);
}

export async function reconcileFeedbackReactions(
  feedbackStore: FeedbackStore,
  client: SlackClient,
  threadLimit = 100
): Promise<number> {
  const indexes = await feedbackStore.listAwaitingFeedbackResults();
  let reconciled = 0;

  for (const index of indexes) {
    const response = await client.conversations.replies({
      channel: index.channelId,
      ts: index.threadTs,
      limit: threadLimit
    });
    const reaction = findRequesterFeedbackReaction(response.messages ?? [], index);
    if (!reaction) {
      continue;
    }

    await recordFeedbackReaction(feedbackStore, client, index, reaction, new Date().toISOString());
    reconciled += 1;
  }

  return reconciled;
}

export async function reconcileFeedbackClarifications(
  feedbackStore: FeedbackStore,
  client: SlackClient,
  threadLimit = 100
): Promise<number> {
  const pendingFeedback = await feedbackStore.listPendingClarifications();
  let reconciled = 0;

  for (const pending of pendingFeedback) {
    const response = await client.conversations.replies({
      channel: pending.channelId,
      ts: pending.threadTs,
      limit: threadLimit
    });
    const clarification = findRequesterClarification(response.messages ?? [], pending);
    if (!clarification?.text || !clarification.ts) {
      continue;
    }

    await feedbackStore.recordClarification(pending, clarification.text, clarification.ts);
    await postThreadReply(
      client,
      pending.channelId,
      pending.threadTs,
      `<@${pending.requesterUserId}> *Saved* your feedback for colombo improvement review.`
    );
    reconciled += 1;
  }

  return reconciled;
}

async function reconcileFeedback(
  feedbackStore: FeedbackStore,
  client: SlackClient
): Promise<void> {
  await reconcileFeedbackReactions(feedbackStore, client);
  await reconcileFeedbackClarifications(feedbackStore, client);
}

export async function handleFeedbackMessage(
  feedbackStore: FeedbackStore,
  client: SlackClient,
  event: MessageEvent
): Promise<void> {
  if (event.subtype || event.bot_id || !event.user || !event.channel || !event.ts || !event.text) {
    return;
  }
  if (!event.thread_ts || event.thread_ts === event.ts) {
    return;
  }

  const pending = await feedbackStore.findPendingClarification(event.channel, event.thread_ts, event.user);
  if (!pending) {
    return;
  }

  await feedbackStore.recordClarification(pending, event.text, event.ts);
  await postThreadReply(
    client,
    pending.channelId,
    pending.threadTs,
    `<@${pending.requesterUserId}> *Saved* your feedback for colombo improvement review.`
  );
}

function startQueuedJob(
  config: AppConfig,
  queue: JobQueue,
  client: SlackClient,
  feedbackStore: FeedbackStore,
  event: AppMentionEvent,
  promptText: string
): void {
  const threadTs = event.thread_ts ?? event.ts;
  const jobId = createJobId();
  const activeBeforeEnqueue = queue.active;
  const waitingBeforeEnqueue = queue.waiting;
  const willQueue = activeBeforeEnqueue >= config.maxConcurrentJobs;
  const progressMessage = new SlackProgressMessage(client, event.channel, threadTs, jobId);
  const progress = new SlackProgressReporter({
    enabled: config.progressUpdatesEnabled,
    minIntervalMs: config.progressMinIntervalMs,
    heartbeatMs: config.progressHeartbeatMs,
    jobId,
    promptText,
    post: (text) => progressMessage.post(text)
  });

  try {
    const jobPromise = queue
      .enqueue(async () => {
        logger.info("starting colombo job", {
          jobId,
          userId: event.user,
          channelId: event.channel,
          active: queue.active,
          waiting: queue.waiting
        });
        await progress.started();
        progress.startHeartbeat();

        let threadMessages: SlackThreadMessage[] = [];
        try {
          threadMessages = await fetchThreadContext(
            client,
            event.channel,
            threadTs,
            config.slackThreadLimit
          );
        } catch (error) {
          logger.warn("failed to fetch slack thread context", {
            jobId,
            error: String(error),
            channel: event.channel,
            threadTs
          });
        }

        const request: OpsRequest = {
          jobId,
          userId: event.user ?? "unknown",
          channelId: event.channel,
          messageTs: event.ts,
          threadTs,
          promptText,
          threadMessages
        };
        if (config.feedbackEnabled) {
          await safeFeedbackWrite(
            "failed to write colombo feedback request context",
            jobId,
            feedbackStore.writeRequest(request)
          );
          await safeFeedbackWrite(
            "failed to append colombo feedback worklog",
            jobId,
            feedbackStore.appendWorkLog(jobId, {
              type: "job_started",
              active: queue.active,
              waiting: queue.waiting
            })
          );
        }

        const result = await runCodex(config, request, {
          onProgress: (signal) => {
            progress.record(signal);
            if (config.feedbackEnabled) {
              return feedbackStore.appendProgressSignal(jobId, signal);
            }
          }
        });
        progress.stop();
        const finalMessageTs = await postThreadReply(
          client,
          event.channel,
          threadTs,
          formatFinalReply(
            result,
            config.finalResponseMaxChars,
            config.feedbackEnabled ? request.userId : undefined
          )
        );
        if (config.feedbackEnabled && finalMessageTs) {
          await safeFeedbackWrite(
            "failed to register colombo feedback final result",
            jobId,
            feedbackStore.registerFinalResult(request, result, finalMessageTs)
          );
        }
        await progress.finished(result.status);
        logger.info("finished colombo job", { jobId, status: result.status, exitCode: result.exitCode });
      })
      .catch(async (error: unknown) => {
        progress.stop();
        logger.error("colombo job failed", { jobId, error: String(error) });
        await progress.finished("failed");
        await postThreadReply(
          client,
          event.channel,
          threadTs,
          [
            "*Summary:* Colombo failed before producing an investigation summary.",
            "*Scope:* Colombo",
            "*Window:* not completed",
            "",
            "*Findings:*",
            "- The job failed before Codex returned a final result.",
            "",
            "*Suggested next step:*",
            "- Check the colombo systemd logs on the VPS.",
            "",
            "*Confidence:* low",
            "",
            `*Job:* \`${jobId}\``
          ].join("\n")
        ).catch((postError: unknown) => {
          logger.error("failed to post colombo failure reply", { jobId, error: String(postError) });
        });
      });
    if (willQueue) {
      void progress.queued(activeBeforeEnqueue, waitingBeforeEnqueue);
    }
    void jobPromise;
  } catch (error) {
    if (error instanceof QueueFullError) {
      void postThreadReply(
        client,
        event.channel,
        threadTs,
        "*Colombo is busy* and the queue is full. Please try again in a few minutes."
      );
      return;
    }

    throw error;
  }
}

export function createSlackApp(config: AppConfig): App {
  const receiver = new SocketModeReceiver({
    appToken: config.slackAppToken,
    logLevel: LogLevel.WARN
  });
  const app = new App({
    token: config.slackBotToken,
    receiver,
    logLevel: LogLevel.WARN
  });
  const queue = new JobQueue(config.maxConcurrentJobs, config.maxQueueSize);
  const feedbackStore = new FeedbackStore(
    config.stateDir,
    config.feedbackClarificationWaitMs
  );
  if (config.feedbackEnabled) {
    void feedbackStore.expirePendingFeedback().catch((error: unknown) => {
      logger.warn("failed to expire pending colombo feedback", { error: String(error) });
    });
    void reconcileFeedback(feedbackStore, app.client as unknown as SlackClient).catch((error: unknown) => {
      logger.warn("failed to reconcile colombo feedback", { error: String(error) });
    });
    const feedbackExpiry = setInterval(() => {
      void feedbackStore.expirePendingFeedback().catch((error: unknown) => {
        logger.warn("failed to expire pending colombo feedback", { error: String(error) });
      });
    }, Math.min(config.feedbackClarificationWaitMs, 60 * 60 * 1000));
    feedbackExpiry.unref();
    const feedbackReactions = setInterval(() => {
      void reconcileFeedback(feedbackStore, app.client as unknown as SlackClient).catch((error: unknown) => {
        logger.warn("failed to reconcile colombo feedback", { error: String(error) });
      });
    }, 60 * 1000);
    feedbackReactions.unref();
  }

  app.event("app_mention", async ({ event, client }) => {
    const mention = event as AppMentionEvent;
    const user = mention.user;
    logger.info("received slack app mention", {
      userId: user ?? "unknown",
      channelId: mention.channel,
      messageTs: mention.ts,
      threadTs: mention.thread_ts ?? mention.ts
    });

    if (!user || !config.allowedUserIds.has(user)) {
      logger.warn("rejected slack app mention from non-allowlisted user", {
        userId: user ?? "unknown",
        channelId: mention.channel,
        messageTs: mention.ts
      });
      if (user) {
        await postEphemeral(client, mention.channel, user, "*Colombo is restricted* to allowlisted users.");
      }
      return;
    }

    const promptText = stripBotMention(mention.text ?? "");
    if (!promptText) {
      await postEphemeral(client, mention.channel, user, "Tell *Colombo* what to investigate.");
      return;
    }

    await addReaction(client, mention.channel, mention.ts, config.slackReaction);
    startQueuedJob(config, queue, client, feedbackStore, mention, promptText);
  });

  app.event("reaction_added", async ({ event, client }) => {
    if (!config.feedbackEnabled) {
      return;
    }

    await handleFeedbackReaction(feedbackStore, client, event as ReactionAddedEvent).catch((error: unknown) => {
      logger.warn("failed to handle colombo feedback reaction", { error: String(error) });
    });
  });

  app.event("message", async ({ event, client }) => {
    if (!config.feedbackEnabled) {
      return;
    }

    await handleFeedbackMessage(feedbackStore, client, event as MessageEvent).catch((error: unknown) => {
      logger.warn("failed to handle colombo feedback message", { error: String(error) });
    });
  });

  return app;
}

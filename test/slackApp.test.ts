import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FeedbackStore } from "../src/feedback.js";
import {
  handleFeedbackMessage,
  handleFeedbackReaction,
  reconcileFeedbackClarifications,
  reconcileFeedbackReactions,
  SlackProgressMessage,
  type SlackClient
} from "../src/slackApp.js";
import type { CodexResult, OpsRequest } from "../src/types.js";

test("SlackProgressMessage updates one threaded status message", async () => {
  const posted: unknown[] = [];
  const updated: unknown[] = [];
  const client: SlackClient = {
    chat: {
      postEphemeral: async () => ({}),
      postMessage: async (args) => {
        posted.push(args);
        return { ts: "1700000000.000100" };
      },
      update: async (args) => {
        updated.push(args);
        return {};
      }
    },
    conversations: {
      replies: async () => ({ messages: [] })
    },
    reactions: {
      add: async () => ({})
    }
  };

  const message = new SlackProgressMessage(client, "C1", "1700000000.000001", "colombo-test");

  await message.post("queued");
  await message.post("started");
  await message.post("still working");

  assert.equal(posted.length, 1);
  assert.equal(updated.length, 2);
  assert.deepEqual(posted[0], {
    channel: "C1",
    thread_ts: "1700000000.000001",
    text: "queued",
    mrkdwn: true,
    unfurl_links: false,
    unfurl_media: false
  });
  assert.deepEqual(updated[0], {
    channel: "C1",
    ts: "1700000000.000100",
    text: "started",
    mrkdwn: true
  });
  assert.deepEqual(updated[1], {
    channel: "C1",
    ts: "1700000000.000100",
    text: "still working",
    mrkdwn: true
  });
});

test("feedback reaction flow asks for details and saves same-user clarification", async () => {
  const posted: Array<{ channel: string; thread_ts: string; text: string }> = [];
  const client: SlackClient = {
    chat: {
      postEphemeral: async () => ({}),
      postMessage: async (args) => {
        posted.push(args);
        return { ts: `1700000000.00010${posted.length}` };
      },
      update: async () => ({})
    },
    conversations: {
      replies: async () => ({ messages: [] })
    },
    reactions: {
      add: async () => ({})
    }
  };
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "colombo-feedback-"));
  const store = new FeedbackStore(stateDir, 86400000, () => new Date("2026-06-05T00:00:00.000Z"));
  const request: OpsRequest = {
    jobId: "colombo-test",
    userId: "U1",
    channelId: "C1",
    messageTs: "1700000000.000001",
    threadTs: "1700000000.000001",
    promptText: "status api",
    threadMessages: []
  };
  const result: CodexResult = {
    jobId: "colombo-test",
    status: "completed",
    exitCode: 0,
    finalMessage: "*Summary:* API looks normal.",
    startedAt: "2026-06-05T00:00:00.000Z",
    finishedAt: "2026-06-05T00:01:00.000Z"
  };
  await store.writeRequest(request);
  await store.registerFinalResult(request, result, "1700000001.000001");

  await handleFeedbackReaction(store, client, {
    type: "reaction_added",
    user: "U1",
    reaction: "poop",
    item: { type: "message", channel: "C1", ts: "1700000001.000001" },
    event_ts: "1780650000.000001"
  });

  assert.equal(posted.length, 1);
  assert.equal(posted[0].channel, "C1");
  assert.equal(posted[0].thread_ts, "1700000000.000001");
  assert.match(posted[0].text, /<@U1> \*What was missing, wrong, or incomplete/);

  await handleFeedbackMessage(store, client, {
    type: "message",
    user: "U1",
    channel: "C1",
    text: "It missed the actual failing endpoint.",
    ts: "1700000002.000001",
    thread_ts: "1700000000.000001"
  });

  assert.equal(posted.length, 2);
  assert.match(posted[1].text, /\*Saved\* your feedback/);
  const feedback = JSON.parse(
    await fs.readFile(path.join(stateDir, "jobs", "colombo-test", "feedback.json"), "utf8")
  ) as { status: string; clarification?: { text: string } };
  assert.equal(feedback.status, "negative_with_clarification");
  assert.equal(feedback.clarification?.text, "It missed the actual failing endpoint.");
});

test("positive feedback reaction is recorded silently", async () => {
  const posted: unknown[] = [];
  const client: SlackClient = {
    chat: {
      postEphemeral: async () => ({}),
      postMessage: async (args) => {
        posted.push(args);
        return { ts: "1700000000.000100" };
      },
      update: async () => ({})
    },
    conversations: {
      replies: async () => ({ messages: [] })
    },
    reactions: {
      add: async () => ({})
    }
  };
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "colombo-feedback-"));
  const store = new FeedbackStore(stateDir, 86400000, () => new Date("2026-06-05T00:00:00.000Z"));
  const request: OpsRequest = {
    jobId: "colombo-test",
    userId: "U1",
    channelId: "C1",
    messageTs: "1700000000.000001",
    threadTs: "1700000000.000001",
    promptText: "status api",
    threadMessages: []
  };
  const result: CodexResult = {
    jobId: "colombo-test",
    status: "completed",
    exitCode: 0,
    finalMessage: "*Summary:* API looks normal.",
    startedAt: "2026-06-05T00:00:00.000Z",
    finishedAt: "2026-06-05T00:01:00.000Z"
  };
  await store.writeRequest(request);
  await store.registerFinalResult(request, result, "1700000001.000001");

  await handleFeedbackReaction(store, client, {
    type: "reaction_added",
    user: "U1",
    reaction: "+1",
    item: { type: "message", channel: "C1", ts: "1700000001.000001" },
    event_ts: "1780650000.000001"
  });

  assert.equal(posted.length, 0);
  const feedback = JSON.parse(
    await fs.readFile(path.join(stateDir, "jobs", "colombo-test", "feedback.json"), "utf8")
  ) as { status: string; rating?: string };
  assert.equal(feedback.status, "positive");
  assert.equal(feedback.rating, "positive");
});

test("feedback reconciliation catches missed negative reaction events", async () => {
  const posted: Array<{ channel: string; thread_ts: string; text: string }> = [];
  const client: SlackClient = {
    chat: {
      postEphemeral: async () => ({}),
      postMessage: async (args) => {
        posted.push(args);
        return { ts: `1700000000.00010${posted.length}` };
      },
      update: async () => ({})
    },
    conversations: {
      replies: async () => ({
        messages: [
          {
            ts: "1700000001.000001",
            reactions: [{ name: "hankey", users: ["U1"], count: 1 }]
          }
        ]
      })
    },
    reactions: {
      add: async () => ({})
    }
  };
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "colombo-feedback-"));
  const store = new FeedbackStore(stateDir, 86400000, () => new Date("2026-06-05T00:00:00.000Z"));
  const request: OpsRequest = {
    jobId: "colombo-test",
    userId: "U1",
    channelId: "C1",
    messageTs: "1700000000.000001",
    threadTs: "1700000000.000001",
    promptText: "status api",
    threadMessages: []
  };
  const result: CodexResult = {
    jobId: "colombo-test",
    status: "completed",
    exitCode: 0,
    finalMessage: "*Summary:* API looks normal.",
    startedAt: "2026-06-05T00:00:00.000Z",
    finishedAt: "2026-06-05T00:01:00.000Z"
  };
  await store.writeRequest(request);
  await store.registerFinalResult(request, result, "1700000001.000001");

  const count = await reconcileFeedbackReactions(store, client);

  assert.equal(count, 1);
  assert.equal(posted.length, 1);
  assert.match(posted[0].text, /<@U1> \*What was missing, wrong, or incomplete/);
  const feedback = JSON.parse(
    await fs.readFile(path.join(stateDir, "jobs", "colombo-test", "feedback.json"), "utf8")
  ) as { status: string; rating?: string; reaction?: string };
  assert.equal(feedback.status, "pending_clarification");
  assert.equal(feedback.rating, "negative");
  assert.equal(feedback.reaction, "hankey");
});

test("feedback clarification reconciliation saves missed thread replies", async () => {
  const posted: Array<{ channel: string; thread_ts: string; text: string }> = [];
  const client: SlackClient = {
    chat: {
      postEphemeral: async () => ({}),
      postMessage: async (args) => {
        posted.push(args);
        return { ts: `1700000000.00020${posted.length}` };
      },
      update: async () => ({})
    },
    conversations: {
      replies: async () => ({
        messages: [
          {
            ts: "1700000002.000001",
            user: "U1",
            text: "It missed disputes by country."
          }
        ]
      })
    },
    reactions: {
      add: async () => ({})
    }
  };
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "colombo-feedback-"));
  const store = new FeedbackStore(stateDir, 86400000, () => new Date("2026-06-05T00:00:00.000Z"));
  const request: OpsRequest = {
    jobId: "colombo-test",
    userId: "U1",
    channelId: "C1",
    messageTs: "1700000000.000001",
    threadTs: "1700000000.000001",
    promptText: "status api",
    threadMessages: []
  };
  const result: CodexResult = {
    jobId: "colombo-test",
    status: "completed",
    exitCode: 0,
    finalMessage: "*Summary:* API looks normal.",
    startedAt: "2026-06-05T00:00:00.000Z",
    finishedAt: "2026-06-05T00:01:00.000Z"
  };
  await store.writeRequest(request);
  await store.registerFinalResult(request, result, "1700000001.000001");
  const index = await store.findResultIndex("C1", "1700000001.000001");
  assert.ok(index);
  await store.recordNegative(index, "hankey", "2023-11-14T22:13:21.000Z");

  const count = await reconcileFeedbackClarifications(store, client);

  assert.equal(count, 1);
  assert.equal(posted.length, 1);
  assert.match(posted[0].text, /\*Saved\* your feedback/);
  const feedback = JSON.parse(
    await fs.readFile(path.join(stateDir, "jobs", "colombo-test", "feedback.json"), "utf8")
  ) as { status: string; clarification?: { text: string; messageTs: string } };
  assert.equal(feedback.status, "negative_with_clarification");
  assert.deepEqual(feedback.clarification, {
    text: "It missed disputes by country.",
    messageTs: "1700000002.000001",
    receivedAt: "2026-06-05T00:00:00.000Z"
  });
});

test("feedback handlers ignore wrong users, unsupported reactions, and bot messages", async () => {
  const posted: unknown[] = [];
  const client: SlackClient = {
    chat: {
      postEphemeral: async () => ({}),
      postMessage: async (args) => {
        posted.push(args);
        return { ts: "1700000000.000100" };
      },
      update: async () => ({})
    },
    conversations: {
      replies: async () => ({ messages: [] })
    },
    reactions: {
      add: async () => ({})
    }
  };
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "colombo-feedback-"));
  const store = new FeedbackStore(stateDir, 86400000, () => new Date("2026-06-05T00:00:00.000Z"));
  const request: OpsRequest = {
    jobId: "colombo-test",
    userId: "U1",
    channelId: "C1",
    messageTs: "1700000000.000001",
    threadTs: "1700000000.000001",
    promptText: "status api",
    threadMessages: []
  };
  const result: CodexResult = {
    jobId: "colombo-test",
    status: "completed",
    exitCode: 0,
    finalMessage: "*Summary:* API looks normal.",
    startedAt: "2026-06-05T00:00:00.000Z",
    finishedAt: "2026-06-05T00:01:00.000Z"
  };
  await store.writeRequest(request);
  await store.registerFinalResult(request, result, "1700000001.000001");

  await handleFeedbackReaction(store, client, {
    type: "reaction_added",
    user: "U2",
    reaction: "poop",
    item: { type: "message", channel: "C1", ts: "1700000001.000001" }
  });
  await handleFeedbackReaction(store, client, {
    type: "reaction_added",
    user: "U1",
    reaction: "eyes",
    item: { type: "message", channel: "C1", ts: "1700000001.000001" }
  });
  await handleFeedbackMessage(store, client, {
    type: "message",
    user: "U1",
    channel: "C1",
    text: "bot text",
    ts: "1700000002.000001",
    thread_ts: "1700000000.000001",
    bot_id: "B1"
  });

  assert.equal(posted.length, 0);
});

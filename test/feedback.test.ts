import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FeedbackStore } from "../src/feedback.js";
import type { CodexResult, OpsRequest } from "../src/types.js";

const request: OpsRequest = {
  jobId: "colombo-test",
  userId: "U1",
  channelId: "C1",
  messageTs: "1700000000.000001",
  threadTs: "1700000000.000001",
  promptText: "status api token=secret123",
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

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
}

test("FeedbackStore writes request, worklog, feedback, and index files", async () => {
  let now = new Date("2026-06-05T00:00:00.000Z");
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "colombo-feedback-"));
  const store = new FeedbackStore(stateDir, 86400000, () => now);

  await store.writeRequest(request);
  await store.appendProgressSignal("colombo-test", {
    eventCount: 3,
    activity: "observability metrics",
    note: "Progress update: API latency looks normal."
  });
  await store.registerFinalResult(request, result, "1700000001.000001");

  const jobDir = path.join(stateDir, "jobs", "colombo-test");
  const requestJson = await readJson(path.join(jobDir, "request.json"));
  const feedbackJson = await readJson(path.join(jobDir, "feedback.json"));
  const worklog = await fs.readFile(path.join(jobDir, "worklog.jsonl"), "utf8");
  const index = await readJson(
    path.join(stateDir, "feedback-index", "result-messages", "C1_1700000001.000001.json")
  );

  assert.equal(requestJson.promptText, "status api token=<hidden>");
  assert.equal(feedbackJson.status, "awaiting_reaction");
  assert.equal(index.jobId, "colombo-test");
  assert.match(worklog, /request_created/);
  assert.match(worklog, /codex_progress/);
  assert.match(worklog, /feedback_requested/);

  now = new Date("2026-06-05T00:02:00.000Z");
  const resultIndex = await store.findResultIndex("C1", "1700000001.000001");
  assert.ok(resultIndex);
  await store.recordPositive(resultIndex, "+1", now.toISOString());

  const positiveFeedback = await readJson(path.join(jobDir, "feedback.json"));
  assert.equal(positiveFeedback.status, "positive");
  assert.equal(positiveFeedback.rating, "positive");
});

test("FeedbackStore records clarification and expires stale pending feedback", async () => {
  let now = new Date("2026-06-05T00:00:00.000Z");
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "colombo-feedback-"));
  const store = new FeedbackStore(stateDir, 1000, () => now);
  await store.writeRequest(request);
  await store.registerFinalResult(request, result, "1700000001.000001");
  const resultIndex = await store.findResultIndex("C1", "1700000001.000001");
  assert.ok(resultIndex);

  await store.recordNegative(resultIndex, "poop", now.toISOString());
  const pending = await store.findPendingClarification("C1", "1700000000.000001", "U1");
  assert.ok(pending);
  await store.recordClarification(pending, "Too vague; api_key=abc123", "1700000002.000001");

  const feedback = await readJson(path.join(stateDir, "jobs", "colombo-test", "feedback.json"));
  assert.equal(feedback.status, "negative_with_clarification");
  assert.deepEqual(feedback.clarification, {
    text: "Too vague; api_key=<hidden>",
    messageTs: "1700000002.000001",
    receivedAt: "2026-06-05T00:00:00.000Z"
  });

  const secondRequest = { ...request, jobId: "colombo-expire" };
  const secondResult = { ...result, jobId: "colombo-expire" };
  await store.writeRequest(secondRequest);
  await store.registerFinalResult(secondRequest, secondResult, "1700000003.000001");
  const secondIndex = await store.findResultIndex("C1", "1700000003.000001");
  assert.ok(secondIndex);
  await store.recordNegative(secondIndex, "hankey", now.toISOString());
  now = new Date("2026-06-05T00:00:02.000Z");
  await store.expirePendingFeedback();

  const expired = await readJson(path.join(stateDir, "jobs", "colombo-expire", "feedback.json"));
  assert.equal(expired.status, "expired_no_clarification");
});

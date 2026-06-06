import test from "node:test";
import assert from "node:assert/strict";
import { formatFinalReply } from "../src/slackFormatting.js";
import type { CodexResult } from "../src/types.js";

const baseResult: CodexResult = {
  jobId: "colombo-test",
  status: "completed",
  exitCode: 0,
  finalMessage: "*Summary:* API looks normal.\n*Confidence:* high",
  startedAt: "2026-06-04T00:00:00.000Z",
  finishedAt: "2026-06-04T00:01:00.000Z"
};

test("formatFinalReply appends job id", () => {
  const reply = formatFinalReply(baseResult, 1000);
  assert.match(reply, /\*Summary:\* API looks normal/);
  assert.match(reply, /\*Job:\* `colombo-test`/);
});

test("formatFinalReply includes direct feedback prompt for requester", () => {
  const reply = formatFinalReply(baseResult, 1000, "U1");

  assert.match(reply, /\*Feedback:\* <@U1> react with :\+1: if this met expectations, :thinking_face: if it partly helped, or :poop: if it missed\./);
});

test("formatFinalReply builds failure message", () => {
  const reply = formatFinalReply(
    {
      ...baseResult,
      status: "failed",
      exitCode: 1,
      finalMessage: "",
      error: "boom"
    },
    1000
  );

  assert.match(reply, /\*Summary:\* Colombo could not complete/);
  assert.match(reply, /boom/);
  assert.match(reply, /Elapsed: 1m/);
  assert.doesNotMatch(reply, /\*Status:\*/);
});

test("formatFinalReply truncates long messages", () => {
  const reply = formatFinalReply({ ...baseResult, finalMessage: "x".repeat(500) }, 120);
  assert.equal(reply.length, 120);
  assert.match(reply, /truncated/);
});

test("formatFinalReply preserves feedback prompt when body is truncated", () => {
  const reply = formatFinalReply({ ...baseResult, finalMessage: "x".repeat(500) }, 220, "U1");

  assert.equal(reply.length, 220);
  assert.match(reply, /truncated/);
  assert.match(reply, /\*Job:\* `colombo-test`/);
  assert.match(reply, /\*Feedback:\* <@U1> react with :\+1:/);
});

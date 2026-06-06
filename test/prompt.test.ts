import test from "node:test";
import assert from "node:assert/strict";
import { buildOpsPrompt, stripBotMention } from "../src/prompt.js";
import type { OpsRequest } from "../src/types.js";

const request: OpsRequest = {
  jobId: "colombo-test",
  userId: "U1",
  channelId: "C1",
  messageTs: "1710000000.0001",
  threadTs: "1710000000.0001",
  promptText: "status api last 30m",
  threadMessages: [
    {
      ts: "1710000000.0001",
      user: "U1",
      text: "<@UBOT> status api last 30m"
    }
  ]
};

test("stripBotMention removes slack mention tokens", () => {
  assert.equal(stripBotMention("<@UBOT> status api last 30m"), "status api last 30m");
  assert.equal(stripBotMention("<@U1> <@U2> check errors"), "check errors");
});

test("buildOpsPrompt includes metadata and thread context", () => {
  const prompt = buildOpsPrompt("agent rules", request);

  assert.match(prompt, /agent rules/);
  assert.match(prompt, /job id: colombo-test/);
  assert.match(prompt, /status api last 30m/);
  assert.match(prompt, /thread context/);
  assert.match(prompt, /untrusted/);
});

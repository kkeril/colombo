import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildOpsPrompt,
  ensureAgentInstructionsFile,
  readAgentInstructions,
  resolveAgentInstructionsPath,
  stripBotMention
} from "../src/prompt.js";
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

test("readAgentInstructions renames lowercase agents.md to canonical AGENTS.md", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "colombo-agents-"));
  await fs.writeFile(path.join(tmp, "agents.md"), "legacy lowercase instructions");

  assert.equal(await readAgentInstructions(tmp), "legacy lowercase instructions");
  assert.equal(await fs.readFile(path.join(tmp, "AGENTS.md"), "utf8"), "legacy lowercase instructions");
  assert.deepEqual(await fs.readdir(tmp), ["AGENTS.md"]);
});

test("ensureAgentInstructionsFile renames configured candidate to AGENTS.md", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "colombo-agents-"));
  await fs.mkdir(path.join(tmp, "docs"));
  await fs.writeFile(path.join(tmp, "docs", "instructions.md"), "candidate instructions");

  const resolved = await ensureAgentInstructionsFile(tmp, "docs/instructions.md");

  assert.equal(resolved, resolveAgentInstructionsPath(tmp));
  assert.equal(await fs.readFile(path.join(tmp, "AGENTS.md"), "utf8"), "candidate instructions");
  await assert.rejects(() => fs.access(path.join(tmp, "docs", "instructions.md")), /ENOENT/);
});

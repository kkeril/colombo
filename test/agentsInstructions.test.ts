import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const agentsPath = new URL("../AGENTS.md", import.meta.url);

test("AGENTS.md defines Colombo product concept, MCP model, and answer contract", async () => {
  const instructions = await fs.readFile(agentsPath, "utf8");

  assert.match(instructions, /self-hosted, read-only operational investigation agent for Slack/);
  assert.match(instructions, /not a generic company-knowledge chatbot/);
  assert.match(instructions, /MCP is the access layer/);
  assert.match(instructions, /MCP is not itself a source of truth/);
  assert.match(instructions, /Connected systems are the real systems of record/);
  assert.match(instructions, /## Product description/);
  assert.match(instructions, /the first onboarding question must ask for the company or product website/);
  assert.match(instructions, /\*Summary:\* one short sentence/);
  assert.match(instructions, /\*Evidence checked:\*/);
  assert.match(instructions, /\*Not checked \/ limitations:\*/);
});

test("AGENTS.md contains rights policy, MCP policy, runbooks, and improvement rules", async () => {
  const instructions = await fs.readFile(agentsPath, "utf8");

  assert.match(instructions, /Read-only only/);
  assert.match(instructions, /Do not deploy, restart, scale/);
  assert.match(instructions, /Do not reveal secrets, tokens, passwords/);
  assert.match(instructions, /Use only read, query, list, search, or get style tools/);
  assert.match(instructions, /Do not claim root cause from a single weak signal/);
  assert.match(instructions, /Runbook: investigate live operational degradation/);
  assert.match(instructions, /Runbook: investigate business or product metric movement/);
  assert.match(instructions, /Runbook: investigate customer\/user case/);
  assert.match(instructions, /Runbook: answer code behavior question/);
  assert.match(instructions, /Owner approval is required before applying any setup changes/);
});

test("repo-scoped Colombo skills exist and encode onboarding/source/improvement flow", async () => {
  const onboarding = await fs.readFile(new URL("../.agents/skills/colombo-onboarding/SKILL.md", import.meta.url), "utf8");
  const addSource = await fs.readFile(new URL("../.agents/skills/colombo-add-new-source/SKILL.md", import.meta.url), "utf8");
  const improvement = await fs.readFile(new URL("../.agents/skills/colombo-improvement-review/SKILL.md", import.meta.url), "utf8");

  assert.match(onboarding, /name: colombo-onboarding/);
  assert.match(onboarding, /What is your company or product website/);
  assert.match(onboarding, /fetch the public website, draft a concise product\/company summary/);
  assert.match(onboarding, /GitHub repository\/code must be the first connected source/);
  assert.match(onboarding, /First-session principles/);
  assert.match(onboarding, /Explain before asking/);
  assert.match(onboarding, /Show value early/);
  assert.match(onboarding, /Do the work when possible/);
  assert.match(onboarding, /Before asking for product repo access, explain/);
  assert.match(onboarding, /\$colombo-add-new-source` owns all data-source logic/);
  assert.match(onboarding, /Do not ask for Slack, Docker, or runtime launch details until Colombo has produced a useful demo answer/);
  assert.match(onboarding, /minimal runtime Codex config/);

  assert.match(addSource, /name: colombo-add-new-source/);
  assert.match(addSource, /MCP is the tool\/access layer/);
  assert.match(addSource, /Source setup principles/);
  assert.match(addSource, /GitHub\/GitLab code access is the first source/);
  assert.match(addSource, /read-only GitHub\/GitLab MCP access/);
  assert.doesNotMatch(addSource, /clone the private repo/i);
  assert.doesNotMatch(addSource, /send me the path/i);
  assert.match(addSource, /GitHub or GitLab repository\/code is the mandatory first source/);
  assert.match(addSource, /Detect third-party integrations from code and filter them before asking the owner/);
  assert.match(addSource, /Do not suggest low-value implementation dependencies/);
  assert.match(addSource, /Fetch a narrow safe sample/);
  assert.match(addSource, /Generate one realistic operational question from the source sample and answer it/);
  assert.match(addSource, /Dynamic Slack test message rules/);

  assert.match(improvement, /name: colombo-improvement-review/);
  assert.match(improvement, /Do not apply improvements without owner approval/);
  assert.match(improvement, /Weak-answer patterns/);
});

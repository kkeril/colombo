import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const agentsPath = new URL("../AGENTS.md", import.meta.url);
const readmePath = new URL("../README.md", import.meta.url);
const packagePath = new URL("../package.json", import.meta.url);
const canonicalDescription =
  "Answer any operational question in Slack in minutes with a read-only Codex agent connected to your MCP tools.";

test("AGENTS.md defines Colombo product concept, MCP model, and answer contract", async () => {
  const instructions = await fs.readFile(agentsPath, "utf8");

  assert.match(instructions, /self-hosted, read-only operational investigation agent for Slack/);
  assert.match(instructions, /not a generic company-knowledge chatbot/);
  assert.match(instructions, /MCP is the access layer/);
  assert.match(instructions, /MCP is not itself a source of truth/);
  assert.match(instructions, /Connected systems are the real systems of record/);
  assert.match(instructions, /## Product description/);
  assert.match(instructions, /answer as Lieutenant Colombo/);
  assert.match(instructions, /Start with a human welcome that frames what happens next at a high level/);
  assert.match(instructions, /one total setup timing estimate/);
  assert.match(instructions, /Explain that the website is needed to draft Colombo's product context before asking/);
  assert.match(instructions, /The first actual question must ask for the company or product website/);
  assert.match(instructions, /Every owner ask must be specific/);
  assert.match(instructions, /prepare the MCP config\/template and env placeholders before asking the owner to fill exact values/);
  assert.match(instructions, /explain the next step before asking/);
  assert.match(instructions, /Always use this exact filename/);
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
  assert.match(instructions, /codex_mcp_enabled_tools/);
  assert.match(instructions, /MCP server credentials must also be read-only/);
  assert.match(instructions, /Do not claim root cause from a single weak signal/);
  assert.match(instructions, /Runbook: investigate live operational degradation/);
  assert.match(instructions, /Runbook: investigate business or product metric movement/);
  assert.match(instructions, /Runbook: investigate customer\/user case/);
  assert.match(instructions, /Runbook: answer code behavior question/);
  assert.match(instructions, /Owner approval is required before applying any setup changes/);
  assert.match(instructions, /:\+1:` met expectations and `:poop:` missed/);
});

test("repo-scoped Colombo skills exist and encode onboarding/source/improvement flow", async () => {
  const onboarding = await fs.readFile(new URL("../.agents/skills/colombo-onboarding/SKILL.md", import.meta.url), "utf8");
  const addSource = await fs.readFile(new URL("../.agents/skills/colombo-add-new-source/SKILL.md", import.meta.url), "utf8");
  const improvement = await fs.readFile(new URL("../.agents/skills/colombo-improvement-review/SKILL.md", import.meta.url), "utf8");

  assert.match(onboarding, /name: colombo-onboarding/);
  assert.match(onboarding, /What is your company or product website/);
  assert.match(onboarding, /fetch the public website, draft a concise product\/company summary/);
  assert.match(onboarding, /Which GitHub or GitLab repo contains the code for this product/);
  assert.match(onboarding, /After you reply, I'll use or install the relevant read-only GitHub\/GitLab MCP connector/);
  assert.match(onboarding, /put the credentials in `\/etc\/colombo\.env` or the runtime Codex config/);
  assert.match(onboarding, /If the owner declines repo access/);
  assert.match(onboarding, /Where does your operational data live today/);
  assert.match(onboarding, /Grafana\/Datadog\/Sentry/);
  assert.match(onboarding, /Supabase\/Postgres/);
  assert.match(onboarding, /PostHog\/Amplitude\/GA/);
  assert.match(onboarding, /First-session principles/);
  assert.match(onboarding, /Answer as Lieutenant Colombo/);
  assert.match(onboarding, /Explain the next step before asking/);
  assert.match(onboarding, /Be specific about your ask/);
  assert.match(onboarding, /exact action, exact file or UI location, exact values needed, and what to reply with/);
  assert.match(onboarding, /Hi, welcome to Colombo setup\. Here’s what happens next/);
  assert.doesNotMatch(onboarding, /path from product context to a running Slack agent/);
  assert.doesNotMatch(onboarding, /Just one thing before we start/);
  assert.match(onboarding, /We’ll do four things/);
  assert.match(onboarding, /Learn your product from the public website/);
  assert.match(onboarding, /Connect one read-only source, starting with the product repo/);
  assert.match(onboarding, /Set up the Slack app and Docker so Colombo can run 24\/7/);
  assert.match(onboarding, /This usually takes about 20-30 minutes once access is ready/);
  assert.match(onboarding, /I’ll use the website to draft Colombo’s product context first/);
  assert.doesNotMatch(onboarding, /about 2 minutes/);
  assert.doesNotMatch(onboarding, /10-20 minutes depending on access/);
  assert.match(onboarding, /The first actual question must be/);
  assert.match(onboarding, /Show value early/);
  assert.match(onboarding, /Do the work when possible/);
  assert.match(onboarding, /Ask for GitHub\/GitLab first in outcome language/);
  assert.match(onboarding, /After the owner names a fallback tool such as PostHog, immediately invoke `\$colombo-add-new-source`/);
  assert.match(onboarding, /Do not ask for project names, links, tokens, or credentials in onboarding/);
  assert.match(onboarding, /if the owner says `PostHog`, invoke it for `PostHog`/);
  assert.match(onboarding, /If the owner declines new access entirely, inspect already configured MCP sources/);
  assert.match(onboarding, /\$colombo-add-new-source` owns all data-source logic/);
  assert.match(onboarding, /Do not ask for Slack, Docker, or runtime launch details until Colombo has produced a useful demo answer/);
  assert.match(onboarding, /minimal runtime Codex config/);
  assert.match(onboarding, /codex_mcp_enabled_tools/);
  assert.match(onboarding, /Always use the exact filename `AGENTS.md`/);
  assert.match(onboarding, /Slack channel\/visibility policy the owner wants documented in `AGENTS.md`/);

  assert.match(addSource, /name: colombo-add-new-source/);
  assert.match(addSource, /MCP is the tool\/access layer/);
  assert.match(addSource, /Source setup principles/);
  assert.match(addSource, /GitHub\/GitLab code access is the preferred first source when the owner allows it/);
  assert.match(addSource, /read-only GitHub\/GitLab MCP access/);
  assert.match(addSource, /owner-approved read-only tools into `codex_mcp_enabled_tools`/);
  assert.match(addSource, /Be specific about your ask/);
  assert.match(addSource, /Before asking the owner for missing credentials or project values, do the machine work first/);
  assert.match(addSource, /add exact placeholder keys to `\/etc\/colombo\.env` or the connector-specific env file/);
  assert.match(addSource, /fill these values, save the file, and reply `done`/);
  assert.match(addSource, /do not ask "Which PostHog project\?" as the first follow-up/);
  assert.match(addSource, /Prepare the PostHog connector\/template first/);
  assert.doesNotMatch(addSource, /Please configure the PostHog MCP with the project URL or project ID/);
  assert.doesNotMatch(addSource, /clone the private repo/i);
  assert.doesNotMatch(addSource, /send me the path/i);
  assert.match(addSource, /Use this section when onboarding starts with GitHub\/GitLab/);
  assert.match(addSource, /Detect third-party integrations from code and filter them before asking the owner/);
  assert.match(addSource, /Do not suggest low-value implementation dependencies/);
  assert.match(addSource, /Fetch a narrow safe sample/);
  assert.match(addSource, /Generate one realistic operational question from the source sample and answer it/);
  assert.match(addSource, /Dynamic Slack test message rules/);
  assert.match(addSource, /which exact MCP tools are approved for runtime/);

  assert.match(improvement, /name: colombo-improvement-review/);
  assert.match(improvement, /Do not apply improvements without owner approval/);
  assert.match(improvement, /Weak-answer patterns/);
});

test("README and package metadata use the canonical public description", async () => {
  const readme = await fs.readFile(readmePath, "utf8");
  const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8")) as {
    name: string;
    private: boolean;
    description: string;
  };

  assert.equal(packageJson.name, "colombo");
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.description, canonicalDescription);
  assert.match(readme, new RegExp(canonicalDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readme, /How to set up/);
  assert.match(readme, /Onboarding starts with a human welcome that frames what happens next, a short bullet plan, and one setup timing estimate/);
  assert.match(readme, /explains why it needs the product website/);
  assert.match(readme, /prepares the MCP config and env placeholders first/);
  assert.match(readme, /reply `done`/);
  assert.match(readme, /Publishing \/ release hygiene/);
  assert.match(readme, /slack-app-manifest\.example\.yaml/);
});

---
name: colombo-onboarding
description: Use when setting up a new private Colombo workspace. Interviews the owner, writes the product description into AGENTS.md first, configures Slack/Codex/MCP expectations, and invokes colombo-add-new-source for each connected system.
---

# Colombo onboarding skill

Use this skill to turn a freshly cloned Colombo repo into a private company workspace.

## Required behavior

- Ask one question at a time.
- Do not ask for secrets. Ask the owner to place secrets in their local Codex/MCP config or `/etc/colombo.env`.
- Treat MCP as the access layer, not the source of truth.
- Treat connected systems as the actual sources: Grafana, Loki, Stripe, PostHog, Amplitude, GitHub, databases, docs, customer systems, deploy systems, etc.
- Write durable company-specific behavior mostly into `AGENTS.md`.
- Keep large supporting cards in `workspace/connected-systems/` only when needed, and summarize their operational rules in `AGENTS.md`.

## First question

The first question must be:

```text
Describe your product/company in enough detail for Colombo to investigate it: what the product does, who uses it, the most important services/workflows, and the operational questions you want Colombo to answer.
```

After the owner answers, update the `## Product description` section in `AGENTS.md` immediately. Do not continue onboarding until this is done.

## Onboarding flow

1. Confirm the repo is the owner's private Colombo workspace.
2. Ask the first product-description question and update `AGENTS.md`.
3. Ask which teams will use Colombo first: founders/operators, developers, DevOps/SRE, support, or another group.
4. Ask which Slack workspace/channel(s) should use Colombo and which Slack users should be allowlisted.
5. Ask which Codex authentication mode the owner wants to use:
   - user/account authentication
   - API token authentication
6. Ask where Colombo will run on the VPS and update the README/setup notes only if the owner wants non-default paths.
7. Ask which connected system to add first.
8. Invoke `$colombo-add-new-source` for that connected system. If the skill is not automatically loaded, read `.agents/skills/colombo-add-new-source/SKILL.md` and follow it.
9. Repeat `$colombo-add-new-source` until the owner says there are no more initial systems.
10. Generate a short launch checklist in the final response:
    - env file values still needed
    - MCP servers still needed
    - Slack app scopes/events to verify
    - generated test messages to run
    - local checks to run

## Files this skill may update

- `AGENTS.md`
- `env.example` only for generic template defaults, not private secrets
- `workspace/connected-systems/*.md`
- `workspace/test-messages/*.md`
- `workspace/runbooks/*.md`
- `workspace/README.md`

## Done criteria

- `AGENTS.md` contains the company product description.
- At least one connected system is documented or the owner explicitly chose to stop before adding systems.
- Every added connected system has MCP server name, use cases, limitations, cross-check rules, sensitive-data rules, and generated Slack test messages.
- No secrets or private credentials are written to git-tracked files.

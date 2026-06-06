---
name: colombo-onboarding
description: Use when setting up a new private Colombo workspace. Interviews the owner, writes the product description into AGENTS.md first, configures Slack/Codex/MCP expectations, and invokes colombo-add-new-source for each connected system.
---

# Colombo onboarding skill

Use this skill to turn a freshly cloned Colombo repo into a private company workspace on the VPS where Colombo will run.

## Required behavior

- Ask one question at a time.
- Do not ask for secrets. Ask the owner to place secrets in their local Codex/MCP config or `/etc/colombo.env`.
- Treat the default setup model as VPS-first: the owner SSHes to the VPS, clones Colombo there, runs Codex from that checkout, and runs Colombo 24/7 with Docker Compose.
- Explain the two Codex roles when useful: setup Codex runs during onboarding with workspace/deployment permissions; runtime Codex is launched by Colombo for Slack investigations with read-only sandboxing.
- Confirm Docker and Docker Compose are available on the VPS. If they are missing, guide the owner to install them before launch and include that in the final checklist.
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
6. Confirm Codex is installed and authenticated on this VPS, and that its MCP server config is present or will be placed under `/etc/colombo/codex` for Docker runtime.
7. Confirm Docker and Docker Compose are installed on this VPS. If either is missing, provide the owner with the install step for their OS and pause deployment-specific commands until it is available.
8. Ask where Colombo should live on the VPS. Default to `/opt/colombo`; update setup notes only if the owner chooses a non-default path.
9. Ask which connected system to add first.
10. Invoke `$colombo-add-new-source` for that connected system. If the skill is not automatically loaded, read `.agents/skills/colombo-add-new-source/SKILL.md` and follow it.
11. Repeat `$colombo-add-new-source` until the owner says there are no more initial systems.
12. Generate a short launch checklist in the final response:
    - env file values still needed
    - Codex config location for Docker runtime, usually `/etc/colombo/codex`
    - MCP servers still needed
    - Slack app scopes/events to verify
    - Docker paths to create: `/etc/colombo.env`, `/etc/colombo/codex`, `/var/lib/colombo`
    - Codex config copy/permission commands when relevant: `sudo rsync -a ~/.codex/ /etc/colombo/codex/` and `sudo chown -R 1000:1000 /opt/colombo /etc/colombo/codex /var/lib/colombo`
    - Docker commands to run: `docker compose build`, `docker compose up -d`, `docker compose logs -f colombo`
    - generated test messages to run
    - local checks to run

## Files this skill may update

- `AGENTS.md`
- `env.example` only for generic template defaults, not private secrets
- `compose.yaml` and Docker setup notes only for generic template defaults, not private secrets
- `workspace/connected-systems/*.md`
- `workspace/test-messages/*.md`
- `workspace/runbooks/*.md`
- `workspace/README.md`

## Done criteria

- `AGENTS.md` contains the company product description.
- At least one connected system is documented or the owner explicitly chose to stop before adding systems.
- Every added connected system has MCP server name, use cases, limitations, cross-check rules, sensitive-data rules, and generated Slack test messages.
- Docker launch requirements are clear: `/etc/colombo.env`, `/etc/colombo/codex`, `/var/lib/colombo`, and `docker compose up -d`.
- No secrets or private credentials are written to git-tracked files.

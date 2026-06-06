# Colombo

Colombo is a self-hosted, MCP-native operational investigation agent for Slack.

It listens for `@colombo` mentions, starts a fresh `codex exec` investigation, lets Codex use the MCP tools configured in the owner workspace, and replies in the original Slack thread with an evidence-backed answer.

Colombo is not a generic company-knowledge bot. It is designed to inspect the systems where operational reality lives: metrics, logs, traces, commits, deploys, repositories, analytics, payments, databases, docs, runbooks, customer state, and any other system exposed through MCP.

The reusable public repo contains the product code and templates. After cloning it, your clone becomes a private Colombo workspace. That private workspace should contain company-specific `AGENTS.md` instructions, connected-system descriptions, runbooks, generated Slack test messages, feedback history, and approved calibration changes.

## Core model

```text
Slack user asks a question
        ↓
Colombo starts a read-only Codex investigation
        ↓
Codex follows AGENTS.md
        ↓
Codex calls configured MCP tools
        ↓
MCP tools inspect real systems
        ↓
Colombo replies in Slack with findings, evidence, limitations, and next step
```

MCP is the tool/access layer. Grafana, Loki, Stripe, PostHog, Amplitude, GitHub, databases, docs, and internal systems are the connected systems of record.

## What is included

- Slack mention-based investigations.
- Read-only Codex execution.
- Generic MCP server allowlisting through environment config.
- `AGENTS.md` operating manual template with product description, rights policy, tool policy, runbooks, connected-system rules, response contract, and improvement rules.
- Repo-scoped Codex skills under `.agents/skills/`:
  - `$colombo-onboarding`
  - `$colombo-add-new-source`
  - `$colombo-improvement-review`
- Dynamic feedback capture after answers: yes, partly, or no.
- Local improvement review CLI that reads feedback and writes owner-reviewable suggestions.
- Systemd unit templates for the Slack service and nightly improvement review.

## Setup

1. Clone the repo into the private workspace that will run Colombo.

   ```bash
   git clone <your-fork-or-template-url> colombo
   cd colombo
   npm install
   npm run build
   ```

2. Run onboarding in Codex from the repository root.

   ```text
   $colombo-onboarding
   ```

   The first onboarding question should be your product description. The onboarding skill writes that description into `AGENTS.md`, then calls `$colombo-add-new-source` for every connected system you want Colombo to inspect.

3. Configure Codex and MCP servers for your environment.

   Colombo does not hard-code MCP server names. Add the MCP servers to your Codex configuration, then list the server names in `codex_mcp_server_names` in `/etc/colombo.env`.

4. Create `/etc/colombo.env` from `env.example` and fill Slack tokens, allowlisted Slack users, Codex paths, and MCP server names.

   Never commit real tokens, API keys, customer data, or private system details to the public repo.

5. Install the systemd unit.

   ```bash
   sudo cp deploy/colombo.service /etc/systemd/system/colombo.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now colombo
   ```

6. Watch logs.

   ```bash
   journalctl -u colombo -f
   ```

## Slack app requirements

- Socket mode enabled.
- App-level token with `connections:write`.
- Bot scopes: `app_mentions:read`, `chat:write`, `reactions:write`, `reactions:read`, `channels:history`, and `groups:history`.
- Bot event subscriptions: `app_mention`, `reaction_added`, `message.channels`, and `message.groups`.
- Invite the bot to every channel where it should answer.

## Feedback and improvement loop

Colombo asks for feedback after each final answer:

- 👍 yes, this met expectations
- 🤔 partly
- 💩 no

Negative or partial feedback asks the requester what was missing. Feedback is stored under `state_dir/jobs/<job-id>/`.

Run a local review:

```bash
npm run improvement:review
```

This creates a pending suggestion in `workspace/improvements/pending/`. Review it as the owner. To apply an approved suggestion through Codex:

```bash
npm run improvement:apply -- workspace/improvements/pending/<file>.md
```

The apply step edits Colombo setup files only. It does not mutate production systems. Set `colombo_improvement_auto_commit=true` and optionally `colombo_improvement_auto_push=true` if your private workspace should commit/push approved setup changes automatically.

A systemd timer template is included for nightly review:

```bash
sudo cp deploy/colombo-improvement-review.service /etc/systemd/system/
sudo cp deploy/colombo-improvement-review.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now colombo-improvement-review.timer
```

## Repository layout

```text
AGENTS.md                         company operating manual template
.agents/skills/                   repo-scoped Codex skills
src/                              Slack bridge and improvement CLI
workspace/connected-systems/       connected-system cards generated during onboarding
workspace/test-messages/           generated Slack test prompts
workspace/improvements/            pending/applied improvement suggestions
deploy/                            systemd templates
```

## Local checks

```bash
npm test
npm run typecheck
npm run build
```

## Open-source hygiene

Before publishing your template fork, verify that these are not present:

- Real credentials.
- Company-specific system names.
- Internal database/table names.
- Private repository URLs.
- Customer records.
- Feedback history from a real workspace.
- Generated private `workspace/connected-systems/*.md` files.

Keep private calibration changes in the private workspace, not in the reusable public template.

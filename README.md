# Colombo

Ask operational questions in Slack. Get an evidence-backed investigation instead of another thread of guesses.

Colombo is for Slack teams where the answer usually lives across dashboards, logs, repos, docs, payments, analytics, databases, and the one person who remembers how everything fits together.

Mention `@colombo`, ask the question in normal language, and Colombo starts a fresh read-only Codex investigation using the MCP tools configured in your workspace. It replies in the same Slack thread with what changed, who is affected, what evidence was checked, what is still unknown, and one safe next step.

## Why this exists

Operational questions get slow when every answer requires the same manual loop:

- ask who owns the area
- search Slack for old context
- open metrics, logs, traces, dashboards, repos, runbooks, and customer systems
- compare timelines by hand
- paste a partial read back into Slack

Colombo turns that loop into a repeatable Slack workflow. It does not replace the systems of record. It gives Codex a read-only way to inspect those systems, follow your company-specific investigation rules, and write the answer where the question was asked.

Built from real internal use with MCP access to Supabase, ClickHouse, Grafana, Intercom, Stripe, GitHub, and PostHog. The goal is to stop waiting for the right person to connect product, code, incident, and customer context.

## Who it is for

Colombo is useful for teams that already live in Slack and have operational context spread across tools.

### Founders and operators

Use it to understand product and business movement without asking engineering to pull every number.

```text
@colombo did the new minimum purchase amount change conversion, revenue, or repeat usage this week?
```

### Developers

Use it to find where behavior lives, what changed recently, and what needs to be read before editing code.

```text
@colombo where is residential proxy rotation implemented, and what should I check before changing TTL behavior?
```

### DevOps and SRE

Use it to investigate alerts, anomalies, latency, provider issues, deploy impact, and blast radius.

```text
@colombo success rate dropped for German mobile proxies in the last 2 hours. Check metrics, logs, provider split, and recent deploys.
```

### Support

Use it to assemble safe customer-facing facts from customer state, usage, payments, and errors.

```text
@colombo customer 18492 says proxies stopped working after payment. Check purchase status, usage, recent errors, and whether this looks provider-related.
```

## What it does

Colombo listens for Slack mentions and runs a fresh `codex exec` job for each request.

That job:

- reads your local `AGENTS.md` operating manual
- receives the Slack question and thread context
- can use only the MCP servers you allowlist
- runs with Codex sandbox set to `read-only`
- stores job metadata and feedback under your local state directory
- writes one Slack-thread answer with findings, evidence, limitations, and next step

The answer format is intentionally operational:

```text
Summary: direct read
Scope: affected service, customer, segment, or component
Window: time range checked
Findings: concrete facts
Evidence checked: systems and signals inspected
Likely cause / interpretation: supported hypothesis or unknown
Not checked / limitations: what is still missing
Suggested next step: one safe human action
Confidence: high | medium | low
```

## Quick demo

A Slack user asks:

```text
@colombo checkout errors are up after the last deploy. Is this affecting everyone or only Stripe card payments?
```

Colombo can investigate across the systems you configured, for example:

- metrics for checkout error rate and payment-provider split
- logs or traces around the first error spike
- deploy history before the metric moved
- Stripe events for failed payments
- repository code paths for checkout handling

Then it replies in the original thread with the current read and explicitly says what it did not check.

The internal setup this came from connects systems like Supabase, ClickHouse, Grafana, Intercom, Stripe, GitHub, and PostHog through MCP. Your setup can use a different set of MCP servers as long as Codex can access them read-only.

## Installation

Clone the repo into the private workspace that will run Colombo:

```bash
git clone https://github.com/kkeril/colombo.git
cd colombo
npm install
npm run build
```

Run the onboarding skill from the repository root:

```text
$colombo-onboarding
```

The onboarding flow asks for your product description first, then helps describe the connected systems Colombo is allowed to inspect.

## Quick start

Create `/etc/colombo.env` from the example file:

```bash
sudo cp env.example /etc/colombo.env
sudo editor /etc/colombo.env
```

Fill in:

- Slack bot token and app-level token
- Slack user allowlist
- Codex executable and workspace paths
- MCP server names that Codex may use during investigations
- state directory and queue limits

Build and run locally:

```bash
npm run build
npm start
```

Or install the included systemd service:

```bash
sudo cp deploy/colombo.service /etc/systemd/system/colombo.service
sudo systemctl daemon-reload
sudo systemctl enable --now colombo
```

Watch service logs:

```bash
journalctl -u colombo -f
```

## Slack app setup

Colombo uses Slack Socket Mode.

Required app settings:

- Socket Mode enabled
- app-level token with `connections:write`
- bot scopes: `app_mentions:read`, `chat:write`, `reactions:write`, `reactions:read`, `channels:history`, `groups:history`
- bot events: `app_mention`, `reaction_added`, `message.channels`, `message.groups`
- invite the bot to every channel where it should answer

## Configuration

Colombo is configured through environment variables. See `env.example` for the full list.

Important values:

- `slack_allowed_user_ids`: Slack users allowed to ask Colombo questions
- `codex_workdir`: workspace where Codex runs investigations
- `colombo_dir`: Colombo install directory
- `agent_instructions_file`: usually `AGENTS.md`
- `codex_mcp_server_names`: comma-separated MCP server names to allow
- `codex_disabled_mcp_server_names`: comma-separated MCP server names to disable
- `max_concurrent_jobs`: concurrent Slack investigations, default `1`
- `job_timeout_ms`: per-investigation timeout, default `900000`
- `final_response_max_chars`: max Slack answer length, default `3500`
- `feedback_enabled`: whether Colombo asks for answer feedback

MCP server definitions and credentials live in your Codex configuration, not in Colombo's repo.

## Common use cases

- Investigate a production metric drop or spike.
- Check whether an alert maps to real customer impact.
- Explain what changed around a deploy.
- Find the code path behind product behavior.
- Assemble support-safe facts about a customer issue.
- Compare analytics movement with payment-provider truth.
- Generate realistic Slack test prompts for each connected system.
- Review weak answers and suggest owner-approved setup improvements.

## Why not just use ChatGPT or a Slack bot?

Generic chatbots answer from conversation context or indexed docs. Colombo is built for live operational investigation.

The important differences:

- Colombo runs a fresh Codex investigation for each Slack request.
- It uses MCP tools to inspect real systems of record.
- It follows your repo-local `AGENTS.md` rights policy, runbooks, redaction rules, and answer contract.
- It is read-only during investigations.
- It stores feedback so weak answers can become owner-reviewed setup improvements.

## Why not just use dashboards?

Dashboards show signals. They usually do not connect the signal to Slack context, deploys, logs, customer state, code paths, provider state, payments, and the limits of the evidence.

Colombo is useful when the question is not "what does this chart say?" but "what is happening, what changed, who is affected, and what should a human do next?"

## Private workspace model

The public repo is the reusable product.

Your cloned repo becomes a private Colombo workspace. That private workspace can contain:

- company-specific `AGENTS.md` instructions
- connected-system cards in `workspace/connected-systems/`
- generated test messages in `workspace/test-messages/`
- longer runbooks in `workspace/runbooks/`
- owner-reviewed improvement suggestions in `workspace/improvements/`

Do not publish private connected-system cards, customer data, feedback history, credentials, or internal runbooks.

## Feedback and improvement loop

After each answer, Colombo can ask whether the answer met expectations:

- `:+1:` yes
- `:thinking_face:` or `:neutral_face:` partly
- `:poop:` no

Partial or negative feedback asks the requester what was missing. Colombo stores the job, answer, feedback, and safe worklog context under `state_dir/jobs/<job-id>/`.

Run a local improvement review:

```bash
npm run improvement:review
```

This creates an owner-reviewable suggestion in `workspace/improvements/pending/`.

Apply an approved suggestion:

```bash
npm run improvement:apply -- workspace/improvements/pending/<file>.md
```

The apply step is scoped to Colombo setup files. It must not mutate production systems or source repositories.

Nightly review templates are included:

```bash
sudo cp deploy/colombo-improvement-review.service /etc/systemd/system/
sudo cp deploy/colombo-improvement-review.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now colombo-improvement-review.timer
```

## Repository layout

```text
AGENTS.md                         operating manual template
.agents/skills/                   repo-scoped Codex onboarding and improvement skills
src/                              Slack bridge and improvement CLI
workspace/connected-systems/       connected-system cards generated during onboarding
workspace/test-messages/           generated Slack test prompts
workspace/improvements/            pending and applied improvement suggestions
workspace/runbooks/                longer private runbooks
deploy/                            systemd templates
env.example                        environment variable template
```

## Limitations

- Colombo is self-hosted. There is no hosted SaaS version in this repo.
- It depends on your MCP coverage. If a system is not exposed through MCP or local read-only access, Colombo cannot inspect it.
- It should not be treated as an incident commander. It investigates and summarizes; humans still decide and act.
- It does not prove root cause from one signal. The operating manual tells it to cross-check important conclusions.
- It is read-only for Slack investigations. It must not deploy, restart services, write database rows, change alerts, or mutate production systems.
- Slack answers should avoid raw logs, secrets, personal data, payment metadata, and long query output.

## Local checks

```bash
npm test
npm run typecheck
npm run build
```

## Open-source hygiene

Before publishing a template fork, verify that these are not present:

- real credentials
- company-specific system names
- internal database or table names
- private repository URLs
- customer records
- feedback history from a real workspace
- generated private `workspace/connected-systems/*.md` files

Keep private calibration changes in the private workspace, not in the reusable public template.

## Contributing

Issues and pull requests are welcome when they improve the reusable Colombo product or template.

Good contributions include:

- clearer onboarding steps
- safer defaults
- better Slack formatting
- more robust feedback handling
- better tests around config, queueing, prompt construction, redaction, and Slack behavior
- deployment improvements that keep the self-hosted model simple

Do not contribute private company instructions, credentials, customer data, real feedback history, or private connected-system cards.

## License

MIT. See `LICENSE`.

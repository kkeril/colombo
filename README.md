<p align="center">
  <img src="colombo_icon.jpeg" alt="Colombo icon" width="160">
</p>

# 🕵️ Colombo

Ask operational questions in Slack. Colombo runs a read-only Codex investigation through your MCP-connected tools and replies with evidence instead of guesses.

Colombo is a Codex-based Slack agent for teams whose answers are scattered across Grafana, Amplitude, Metabase, Intercom, ClickHouse, Jira, Linear, Supabase, Stripe, GitHub, PostHog, databases, docs, runbooks, and the person who remembers how everything fits together.

You self-host it on a VPS. Colombo runs 24/7 in Docker, listens for `@colombo`, starts Codex for each question, and answers in the same Slack thread with what changed, who is affected, what was checked, what is unknown, and one safe next step.

## Why this exists

Operational questions get slow when every answer means asking around, opening five tools, comparing timelines by hand, and pasting a partial read back into Slack.

Colombo makes that loop repeatable. It does not replace your systems of record; it gives Codex a read-only path to inspect them with your company-specific rules.

Built from real internal use with MCP access to Supabase, ClickHouse, Grafana, Intercom, Stripe, GitHub, and PostHog.

## Who it is for

### Founders and operators

Understand product and business movement without asking engineering to pull every number.

```text
@colombo did the new minimum purchase amount change conversion, revenue, or repeat usage this week?
```

### Developers

Find where behavior lives and what to read before changing code.

```text
@colombo where is residential proxy rotation implemented, and what should I check before changing TTL behavior?
```

### DevOps and SRE

Investigate alerts, latency, provider issues, deploy impact, and blast radius.

```text
@colombo success rate dropped for German mobile proxies in the last 2 hours. Check metrics, logs, provider split, and recent deploys.
```

### Support

Assemble safe customer-facing facts from customer state, usage, payments, and errors.

```text
@colombo customer 18492 says proxies stopped working after payment. Check purchase status, usage, recent errors, and whether this looks provider-related.
```

## Get started

You need:

- Slack workspace where users will mention Colombo.
- VPS with Docker and Docker Compose.
- Codex installed and authenticated on that VPS.
- MCP servers configured in the VPS Codex environment for the tools Colombo should inspect.

SSH into the VPS and clone Colombo there:

```bash
ssh user@your-vps
sudo mkdir -p /opt/colombo
sudo chown -R "$USER":"$USER" /opt/colombo
git clone https://github.com/kkeril/colombo.git /opt/colombo
cd /opt/colombo
```

Open Codex from the VPS checkout and run onboarding:

```bash
codex
```

```text
$colombo-onboarding
```

Answer the questions one by one. Onboarding writes your product context into `AGENTS.md`, documents connected systems, guides Slack/Codex/MCP setup, generates test prompts, and prepares Docker launch steps.

Do not paste secrets into chat or tracked files. Put Slack tokens in `/etc/colombo.env`; put Codex and MCP credentials in the VPS Codex config mounted into the container.

If you are an LLM agent setting up Colombo, run `$colombo-onboarding` from the repo root and follow that skill. Do not duplicate setup logic from this README.

## Docker runtime

The container mounts:

- `/opt/colombo`: private Colombo workspace
- `/etc/colombo.env`: Slack tokens, allowlist, path defaults, queue limits, MCP allowlist
- `/etc/colombo/codex`: Codex auth and MCP config
- `/var/lib/colombo`: job state, feedback, final answers, cache/data

Launch after onboarding tells you the env/config are ready:

```bash
sudo mkdir -p /etc/colombo/codex /var/lib/colombo
[ -f /etc/colombo.env ] || sudo cp env.example /etc/colombo.env
sudo editor /etc/colombo.env
sudo rsync -a ~/.codex/ /etc/colombo/codex/
sudo chown -R 1000:1000 /opt/colombo /etc/colombo/codex /var/lib/colombo
docker compose build
docker compose up -d
docker compose logs -f colombo
```

MCP server commands in the Codex config must work from inside the container, or point to remote/network-accessible MCP servers. The image runs as UID `1000`.

## What it does

For each `@colombo` mention, Colombo:

- reads your private `AGENTS.md`
- includes the Slack question and thread context
- allows only configured MCP servers
- runs Codex with `--sandbox read-only`
- stores job metadata and feedback under `/var/lib/colombo`
- replies in Slack with findings, evidence, limitations, and next step

## Quick demo

```text
@colombo checkout errors are up after the last deploy. Is this affecting everyone or only Stripe card payments?
```

Colombo can check metrics, logs/traces, deploy history, Stripe events, and checkout code paths, then reply with the current read and what it did not check.

## Why not just use X?

Generic chatbots answer from conversation context or indexed docs. Dashboards show signals. Colombo is for live operational investigation across tools, code, customer state, deploys, payments, and runbooks.

It follows your repo-local `AGENTS.md`, uses MCP tools as evidence, stays read-only during investigations, and stores feedback so weak answers can become owner-reviewed setup improvements.

## Private workspace

The public repo is the reusable product. Your VPS checkout becomes the private workspace.

Private workspace files may include company-specific `AGENTS.md` instructions, connected-system cards, generated test prompts, longer runbooks, and owner-reviewed improvement suggestions. Do not publish those files if they contain internal system details, customer data, credentials, or feedback history.

## Feedback loop

After each answer, Colombo can ask whether it met expectations:

- `:+1:` yes
- `:thinking_face:` or `:neutral_face:` partly
- `:poop:` no

Run improvement review from the VPS checkout:

```bash
docker compose run --rm colombo node dist/src/improvement.js review
```

Apply an approved suggestion:

```bash
docker compose run --rm colombo node dist/src/improvement.js apply /opt/colombo/workspace/improvements/pending/<file>.md
```

The apply step is scoped to Colombo setup files only.

## Repository layout

```text
AGENTS.md                         operating manual template
Dockerfile                        Colombo app and Codex runtime image
compose.yaml                      Docker runtime for the VPS
.agents/skills/                   repo-scoped onboarding and improvement skills
src/                              Slack bridge and improvement CLI
workspace/                        private connected-system docs, test prompts, runbooks, improvements
deploy/                           legacy systemd templates
env.example                       environment variable template
```

## Limitations

- Self-hosted only; no hosted SaaS version in this repo.
- Colombo can inspect only systems exposed through MCP or local read-only access.
- Runtime MCP commands must work from inside Docker unless they are remote MCP servers.
- Colombo investigates and summarizes; humans still decide and act.
- Runtime investigations are read-only and must not mutate production systems.
- Slack answers should avoid raw logs, secrets, personal data, payment metadata, and long query output.

## Local checks

```bash
npm test
npm run typecheck
npm run build
docker compose config
docker compose build
```

## Open-source hygiene

Before publishing a template fork, remove real credentials, company-specific system names, internal database names, private repo URLs, customer records, feedback history, private connected-system cards, and private Codex/MCP config.

## Contributing

Issues and pull requests are welcome when they improve the reusable Colombo product or template. Do not contribute private company instructions, credentials, customer data, real feedback history, or private connected-system cards.

## License

MIT. See `LICENSE`.

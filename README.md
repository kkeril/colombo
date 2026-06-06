<p align="center">
  <img src="colombo_icon.jpeg" alt="Colombo icon" width="160">
</p>

# 🕵️ Colombo

Answer any operational question in 10 minutes with a Codex-based Slack agent that has read-only MCP access to your tools.

Colombo is a self-hosted Slack agent for teams whose answers are scattered across multiple tools and a teammate who remembers context.

Mention `@colombo` in Slack. Colombo starts a read-only Codex investigation through MCP tools and replies in the same thread with evidence, unknowns, and one safe next step.

![Real Colombo request](colombo_request.png)

## Who it is for

Colombo is for small teams where work often stops until the right colleague replies: the person who knows the code, infra, funnel, payments, support history, or customer state.

It fits teams already using Codex and MCP, because Colombo depends on the same idea: give Codex read-only access to the tools where the evidence lives.

### Founders and operators: answer product and business questions

```text
@colombo did the new minimum purchase amount change conversion, revenue, or repeat usage this week?
```

### Developers: check whether code changes caused issues

```text
@colombo check logs and metrics for service ABC. Are there any issues after the last commit?
```

### DevOps and SRE: investigate alerts and anomalies

```text
In a thread under a real alert:
@colombo what happened here, and what is the root cause?
```

### Customer support: investigate user cases

```text
@colombo user 18492 paid but still sees the free plan. Why?
```

## Why this exists

Important work slips while developers context-switch between customer and product support, and the questions keep growing like a snowball. Each simple "why?" can take 20+ minutes across logs, payments, analytics, code, and Slack history.

[Kirill](https://github.com/kkeril) built Colombo after watching this happen inside his own team: support asked fair questions, developers were drowning in interrupts, and the answer was usually already inside company tools. Colombo turns the handoff into a Slack-native, read-only Codex investigation through MCP, so the team gets an evidence-backed first read before interrupting the right person.

## What it does

Colombo turns a Slack mention into a fresh, read-only Codex run.

```text
`@colombo` mention with question + thread context
  ↓
Colombo records a job and starts `codex exec --sandbox read-only`
  ↓
Codex reads AGENTS.md and uses only allowlisted MCP servers
  ↓
MCP tools inspect real systems; Codex connects the evidence and writes the answer
  ↓
Colombo posts an evidence-backed reply in the same Slack thread
```

```text
@colombo user 18492 paid but still sees the free plan. Why?
```

Depending on the question, Colombo can compare metrics, inspect logs, check payment and account state, look at product events, read recent commits, and find relevant code paths through your MCP-connected tools.

It replies with the short answer, evidence checked, what is still unknown, and one safe next step.

## How to setup

### Prerequisites

You need:

- Slack workspace where Colombo will answer
- VPS or private server where Colombo will run
- Codex installed and authenticated on that VPS
- Access to the tools you want Colombo to inspect

### Installation

SSH into the VPS and launch Codex there:

```bash
ssh user@your-vps
codex
```

Paste this prompt into Codex:

```text
Set up Colombo on this VPS.

Clone https://github.com/kkeril/colombo into /opt/colombo, then run the repo onboarding skill $colombo-onboarding from the Colombo repo root.
```

Answer the onboarding questions one by one. Onboarding will configure the private Colombo checkout, document connected systems, generate test prompts, and prepare the launch commands.

## Features

### Onboarding skill

`$colombo-onboarding` simplifies setup by asking the right questions at the right time: VPS setup, Docker/runtime path, `AGENTS.md` rules, Slack, Codex, and MCP-connected tools.

### Add new source skill

`$colombo-add-new-source` guides setup for a new MCP-connected source: the real system, MCP server/tools, what data to review, what the source is reliable for, what it cannot prove, sensitive-data rules, cross-checks, and example requests. It then suggests the `AGENTS.md` and source-doc updates Colombo needs to use that source safely.

### Feedback loop

It is hard to write the right agent instructions on the first try, especially when "helpful" depends on your tools, team habits, and support cases.

Colombo reduces that setup pain by asking the requester for feedback after each answer with a simple reaction: `:+1:` or `:poop:`. On `:poop:`, it asks one follow-up question to understand what exactly was wrong.

Every night, a separate Codex review runs over recent feedback and suggests a plan to fix it. Colombo sends the plan to the bot owner by DM and waits for `:check_mark:` approval before execution.

## Why not just vibecode it myself?

You can. If the idea already feels obvious, you probably should: the Slack bridge, Codex call, and MCP allowlist are straightforward.

Colombo is open source to save you a few hours of glue work and setup. The main reusable parts are the onboarding, source, and feedback skills: they ask the right questions, write or adjust `AGENTS.md`, document connected systems, generate test prompts, and prepare the runtime path.

## Contributing

Contributions are welcome when they improve the reusable Colombo product: onboarding, Slack behavior, read-only safety, feedback review, tests, runtime defaults, or docs.

Do not contribute private company setup: secrets, customer data, feedback history, internal tool names, connected-system cards, private runbooks, or Codex/MCP config.

Before opening a PR, run:

```bash
npm test
npm run typecheck
npm run build
```

## License

MIT. See `LICENSE`.

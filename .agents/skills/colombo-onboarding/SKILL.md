---
name: colombo-onboarding
description: Use when setting up a new private Colombo workspace. Runs a low-friction, website-first setup that gets to a GitHub-backed demo answer before Slack/Docker launch details, and delegates all source setup to colombo-add-new-source.
---

# Colombo onboarding skill

Use this skill to turn a freshly cloned Colombo repo into a private company workspace on the VPS where Colombo will run.

The setup experience must feel like a guided product activation, not an interview. The owner should do only the actions that cannot be inferred or safely performed by Codex.

## First-session principles

Use these principles whenever the next onboarding step is unclear:

- Explain before asking: every required owner action must say what is happening, why it matters, and what Colombo will do next.
- Show value early: get to a real code-backed demo answer before Slack, Docker, or launch details.
- Ask less, infer more: inspect the website, repo, configs, manifests, and MCP capabilities before asking the owner.
- One user action at a time: do not dump checklists unless producing the final launch checklist.
- Do the work when possible: if MCP access lets Colombo discover, read, clone, or inspect something, use it instead of asking the owner to do manual work.
- Be clear about blockers: when access is missing, ask for the smallest enabling action and explain the payoff.
- Filter choices: suggest only relevant next sources, never every detected dependency.
- Keep trust: stay read-only, do not write secrets to tracked files, and do not broadly copy the owner's Codex config.

## Required behavior

- Ask one question at a time.
- Do not ask for secrets. Ask the owner to place secrets in their local Codex/MCP config or `/etc/colombo.env`.
- Treat the default setup model as VPS-first: the owner SSHes to the VPS, clones Colombo there, runs Codex from that checkout, and runs Colombo 24/7 with Docker Compose.
- Explain the two Codex roles when useful: setup Codex runs during onboarding with workspace/deployment permissions; runtime Codex is launched by Colombo for Slack investigations with read-only sandboxing.
- Verify Codex is installed and authenticated on the VPS before source setup. If Codex is missing or unauthenticated, give the smallest install/auth step and pause.
- Do not ask for Slack, Docker, or runtime launch details until Colombo has produced a useful demo answer from the first connected source.
- Do not copy the owner's full Codex config into the container. Build or update a minimal runtime Codex config under `/etc/colombo/codex` with only Colombo-approved MCP servers.
- Confirm Docker and Docker Compose before launch, not before first value. If they are missing, guide the owner to install them and include that in the final checklist.
- Treat MCP as the access layer, not the source of truth.
- Treat connected systems as the actual sources: Grafana, Loki, Stripe, PostHog, Amplitude, GitHub, databases, docs, customer systems, deploy systems, etc.
- GitHub repository/code must be the first connected source. It lets Colombo inspect the actual product implementation and identify relevant next sources.
- Before asking for product repo access, explain that the first source Colombo needs is the product's GitHub or GitLab repository, because code reveals the real services, integrations, SDKs, config names, jobs, and third-party providers worth connecting next.
- `$colombo-add-new-source` owns all data-source logic. Onboarding must not duplicate MCP discovery, source sampling, reliability rules, integration detection, demo questions, demo answers, connected-system docs, or test-message generation.
- Write durable company-specific behavior mostly into `AGENTS.md`.
- Keep large supporting cards in `workspace/connected-systems/` only when needed, and summarize their operational rules in `AGENTS.md`.

## First question

The first question must be:

```text
What is your company or product website?
```

After the owner answers, fetch the public website, draft a concise product/company summary, and ask the owner to approve or correct it. After approval, update the `## Product description` section in `AGENTS.md` immediately. Do not continue onboarding until this is done.

## Onboarding flow

1. Confirm the repo is the owner's private Colombo workspace.
2. Verify `codex --version` works and that Codex can run on the VPS. If not, provide the minimal install/auth instruction and stop there.
3. Ask the website-first question, fetch the website, summarize the product, ask for approval/correction, then update `AGENTS.md`.
4. Explain the GitHub/GitLab-first step in friendly terms, then invoke `$colombo-add-new-source` for `GitHub or GitLab repository/code` as the first connected source. If the skill is not automatically loaded, read `.agents/skills/colombo-add-new-source/SKILL.md` and follow it.
5. Let `$colombo-add-new-source` configure or verify GitHub MCP/local repo access, scan code, produce a demo Colombo answer, and return a filtered shortlist of relevant next sources.
6. Ask the owner to choose one next source from the filtered shortlist or stop after GitHub. For every chosen source, invoke `$colombo-add-new-source` again.
7. After at least the GitHub demo answer is complete, ask which Slack workspace/channel(s) should use Colombo and which Slack users should be allowlisted.
8. Confirm Docker and Docker Compose are installed on this VPS. If either is missing, provide the install step for the host OS and pause deployment-specific commands until it is available.
9. Ask where Colombo should live on the VPS only if the current path is not already clear. Default to `/opt/colombo`.
10. Generate a short launch checklist in the final response:
    - env file values still needed
    - Codex config location for Docker runtime, usually `/etc/colombo/codex`
    - approved MCP servers added to the minimal runtime Codex config
    - MCP servers still needed, if any
    - Slack app scopes/events to verify
    - Docker paths to create: `/etc/colombo.env`, `/etc/colombo/codex`, `/var/lib/colombo`
    - minimal Codex runtime config copy/write steps for approved servers only, plus ownership commands such as `sudo chown -R 1000:1000 /opt/colombo /etc/colombo/codex /var/lib/colombo`
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
- GitHub repository/code is documented as the first connected system.
- A GitHub-backed demo Colombo answer has been shown to the owner.
- Relevant next sources have been detected from code and filtered before asking the owner which to add.
- At least one connected system is documented or the owner explicitly chose to stop after GitHub.
- Every added connected system has MCP server name, use cases, limitations, cross-check rules, sensitive-data rules, and generated Slack test messages.
- Runtime Codex config is prepared for only the Colombo-approved MCP servers, not a blind copy of the owner's full Codex config.
- Docker launch requirements are clear: `/etc/colombo.env`, `/etc/colombo/codex`, `/var/lib/colombo`, and `docker compose up -d`.
- No secrets or private credentials are written to git-tracked files.

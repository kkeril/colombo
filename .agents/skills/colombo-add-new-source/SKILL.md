---
name: colombo-add-new-source
description: Use when adding a new Colombo connected system/source. Owns source setup end to end: MCP discovery, safe sample reads, GitHub code scanning, relevant next-source detection, reliability rules, redaction rules, demo answers, runtime MCP config, and Slack test messages.
---

# Colombo add new source skill

This skill adds a new connected system to Colombo.

Important: the user may say "source," but in Colombo's architecture the source is the real connected system. MCP is the tool/access layer used to reach it.

Onboarding calls this skill whenever a data source is required. All source-specific reasoning belongs here, not in `$colombo-onboarding`.

## Source setup principles

- Start with a friendly explanation of why this source is useful, what Colombo will inspect, and what the owner will get from it.
- GitHub/GitLab code access is the first source because it reveals the real integrations, services, jobs, SDKs, and operational systems behind the product.
- For private repos, ask for read-only GitHub/GitLab MCP access; do not suggest manual cloning as the default path.
- Use MCP/local evidence to discover the repo, inspect code, generate a demo answer, and recommend next sources.
- Use a local repo only when it is already available and clearly matches the approved product summary.
- If the current checkout is Colombo itself, explain that Colombo needs the owner's product repo instead of scanning the setup repo as product code.

## Required behavior

- Ask one question at a time.
- Inspect before asking whenever the answer can be discovered safely.
- Use read-only MCP tools, local repo reads, and safe metadata/sample queries only.
- Never ask for secrets. Ask the owner to configure credentials in the local Codex/MCP config or the minimal Colombo runtime Codex config.
- Do not blindly copy the owner's full Codex config. Add only owner-approved MCP server definitions to `/etc/colombo/codex` for runtime.
- Do not add every detected integration. Filter for operational relevance and ask the owner to choose.
- Ask the owner to approve or correct high-impact assumptions before writing durable rules.

## Source flow

1. Identify the real source of truth being added. Examples: GitHub repo, Grafana, Loki, Stripe, PostHog, Amplitude, Postgres, customer admin DB, deploy system, docs/wiki.
2. Discover whether a matching MCP server or already-present local read-only source exists.
3. If access is missing, give the minimal setup instruction for this source and pause until the owner confirms it is configured.
4. Inspect available read-only tools/capabilities.
5. Fetch a narrow safe sample, metadata preview, schema/list result, or repository slice.
6. Infer likely use cases, reliability, limitations, sensitive fields, cross-checks, and what Colombo must not conclude from this system alone.
7. Ask the owner to approve or correct only the high-impact assumptions.
8. Generate one realistic operational question from the source sample and answer it in Colombo's Slack answer format as a demo.
9. Add this MCP server to the minimal runtime Codex config for Colombo only after the owner approves the source.
10. Update `AGENTS.md`, optional source card, and generated Slack test messages.

## GitHub-first behavior

GitHub or GitLab repository/code is the mandatory first source during onboarding.

When adding GitHub or GitLab:

- Explain first: "The first source Colombo needs is your product repo. I'll use it to understand how your product is built and spot the integrations worth connecting next."
- Prefer read-only GitHub/GitLab MCP access. Do not ask the owner to manually clone a private product repo as the normal setup path.
- If a product repo is already present locally and clearly matches the approved product summary, use local read-only repository access.
- If the current checkout is Colombo itself, say: "This checkout is Colombo itself. I need your product repo so I can find the actual integrations your product uses."
- For private repos, say: "No problem if it is private. Colombo needs read-only GitHub or GitLab MCP access so I can inspect the product code safely."
- Inspect README files, package manifests, env examples, Docker/deploy files, imports, SDK usage, config files, service entrypoints, and tests.
- Identify product services, operational entrypoints, code paths worth asking Colombo about, and recent/change evidence only when available.
- Generate a demo question about code behavior or operational implementation, then answer it with file paths/functions/classes and clear limitations.
- Detect third-party integrations from code and filter them before asking the owner what to add next.

Relevant next-source candidates usually include:

- observability metrics
- logs/traces
- payments
- product analytics
- databases/customer state
- deploy/change systems
- support/ticketing
- docs/runbooks
- queues/background jobs
- auth/email/integration providers when they are operationally important

Do not suggest low-value implementation dependencies such as UI libraries, build tools, test frameworks, lint tools, generic utilities, type packages, or transitive dependencies. Group related SDKs under the real system, for example `@sentry/*` as Sentry or `stripe` as Stripe.

When presenting next sources, show a shortlist of 2-5 choices maximum. Put the recommended next source first and include the code evidence that made each source relevant.

## Update files

After source assumptions are approved:

1. Add or update a compact entry under `## Connected systems registry` in `AGENTS.md`.
2. If details are longer than a compact entry, create `workspace/connected-systems/<slug>.md` with:
   - system name
   - MCP server name
   - tool/capability list
   - good questions
   - bad questions
   - reliability notes
   - limitations
   - cross-check rules
   - sensitive-data/redaction rules
   - rights policy
   - example answer expectations
3. Create or update `workspace/test-messages/<slug>.md` with realistic ready-to-copy Slack tests.
4. Add any new runbook rules to `AGENTS.md` if they should guide every future investigation.
5. Update deployment notes or setup checklist only when needed to reflect the approved runtime MCP config. Do not write secrets.

## Dynamic Slack test message rules

Test messages must be specific to the owner's actual system, sampled data shape, repository structure, and purpose. Avoid toy prompts.

For observability systems, generate tests about live health, anomaly windows, segmentation, and deploy correlation.
For logs/traces, generate tests about error patterns, customer/request drilldowns, and timing.
For repositories, generate tests about implementation paths, relevant tests, ownership, and runtime cross-checks.
For payments, generate tests about payment state, revenue movement, failed charges, refunds, subscriptions, and cross-checking analytics.
For product analytics, generate tests about funnels, activation, retention, cohorts, and cross-checking payments/deploys.
For databases/customer systems, generate tests about customer state, account/order status, safe summaries, and blast radius.
For docs/runbooks, generate tests about known procedures, caveats, and what to check next.
For GitHub/code, generate tests about implementation paths, relevant tests, ownership, detected integrations, and what runtime source must be cross-checked before concluding live behavior.

## Quality bar

The final update should make Colombo better at deciding:

- when to call this system's MCP tools
- what the tool output means
- what it does not prove
- what other systems should verify it
- what data must not be pasted into Slack
- what answer format is expected
- what first demo answer proves and what it does not prove
- which relevant next sources were detected and why unrelated dependencies were ignored

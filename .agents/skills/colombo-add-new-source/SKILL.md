---
name: colombo-add-new-source
description: Use when adding a new Colombo connected system/source. Owns source setup end to end: MCP discovery, safe sample reads, GitHub code scanning, relevant next-source detection, reliability rules, redaction rules, demo answers, runtime MCP config, and Slack test messages.
---

# Colombo add new source skill

This skill adds one real connected system to Colombo. The user may say "source," but MCP is the tool/access layer; the source of truth is the actual system: repo, metrics, logs, payments, analytics, database, docs, deploy system, or support tool.

Onboarding must call this skill for all data-source work. Keep source-specific discovery, sampling, demo answers, reliability rules, integration detection, and test-message generation here instead of in `$colombo-onboarding`.

## Source setup principles

- Start by explaining why the source is useful, what Colombo will inspect, and what the owner will get from it.
- GitHub/GitLab code access is the preferred first source when the owner allows it because it reveals integrations, services, jobs, SDKs, and operational systems.
- Prefer read-only GitHub/GitLab MCP access for private repos; do not make manual repository transfer the default.
- Use MCP or local read-only evidence to inspect the source, generate a demo answer, and recommend relevant next sources.
- Use a local repo only when it is already present and clearly matches the approved product summary.
- If the current checkout is Colombo itself, explain that Colombo needs the owner's product repo, not the setup repo.

## Required behavior

- Ask one question at a time, and inspect before asking when safe.
- Be specific about your ask: every customer-facing request must name the exact action, exact file or UI location, exact values needed, and what to reply with. Avoid wording that leaves the owner guessing whether to send a link, project name, credentials, or confirmation.
- Use only read-only MCP tools, local repo reads, and narrow metadata/sample queries.
- Never ask for secrets. Ask the owner to configure credentials in local Codex/MCP config, `/etc/colombo.env`, or the minimal Colombo runtime Codex config.
- Do not copy the owner's full Codex config. Add only owner-approved MCP server definitions to `/etc/colombo/codex`.
- Before asking the owner for missing credentials or project values, do the machine work first: discover, use, or install the relevant MCP when available; add the MCP server config/template; add exact placeholder keys to `/etc/colombo.env` or the connector-specific env file; then ask the owner to fill those exact keys and reply `done`.
- If exact connector env names are unknown, inspect or install the connector first, or create a connector-specific template with exact placeholder names. Do not guess variable names in the owner ask.
- Do not ask the owner to provide a link, project name, project ID, or token in chat when Codex can prepare config placeholders. Ask "Which project?" only when MCP access is already configured and Codex can see multiple projects.
- Discover exposed MCP tool names and write only owner-approved read-only tools into `codex_mcp_enabled_tools`.
- Avoid `codex_allow_all_mcp_tools=true` unless the owner explicitly accepts every tool on a trusted read-only MCP server.
- Explain that MCP server credentials themselves must be read-only; the Codex sandbox does not make external systems read-only.
- Filter detected integrations for operational relevance, then ask the owner to choose.
- Ask the owner to approve high-impact assumptions before writing durable rules.

## Source flow

1. Identify the real source being added, such as GitHub, GitLab, Grafana, Loki, Stripe, PostHog, Amplitude, Postgres, a customer admin DB, deploy system, or docs/wiki.
2. Discover whether a matching MCP server or local read-only source exists.
3. If access is missing, prepare the connector first: discover/use/install the relevant MCP when available, add the MCP server config/template, and add placeholder env keys to `/etc/colombo.env` or the connector-specific env file.
4. Ask the owner to fill the exact placeholders and reply `done`; never ask them to paste secrets in chat.
5. Inspect available read-only capabilities, then record the exact MCP server name and approved tool names.
6. Fetch a narrow safe sample, metadata preview, schema/list result, or repository slice.
7. Infer use cases, reliability, limitations, sensitive fields, cross-checks, and what Colombo must not conclude from this source alone.
8. Ask the owner to approve or correct the high-impact assumptions, including the read-only MCP allowlist.
9. Generate one realistic operational question from the source sample and answer it in Colombo's Slack format as a demo.
10. After approval, add the MCP server and tool list to the minimal runtime Codex config.
11. Update `AGENTS.md`, an optional connected-system card, and generated Slack test messages.

## Missing access ask template

Use this shape after Codex has prepared the connector/config placeholders:

```text
I've prepared the <source> MCP config and added the missing placeholders to `<exact env file>`.

Please open `<exact env file>`, fill these values, save the file, and reply `done`:
- `<EXACT_KEY_1>`
- `<EXACT_KEY_2>`
- `<connector-specific project value only if the installed MCP requires it>`

Do not paste the values here. After you reply `done`, I'll verify the read-only MCP tools, inspect a small safe sample, and produce the first demo answer.
```

For PostHog, do not ask "Which PostHog project?" as the first follow-up. Prepare the PostHog connector/template first, then ask for exact placeholder keys such as host, API key, and a connector-specific project value only if that installed MCP requires it.

## GitHub/code behavior

Use this section when onboarding starts with GitHub/GitLab or when the owner later chooses repository/code as a connected source.

When adding GitHub or GitLab:

- Explain: "I'll use your product repo to understand how the product is built and spot the integrations worth connecting next."
- Prefer read-only GitHub/GitLab MCP access. For private repos, say Colombo needs read-only GitHub or GitLab MCP access to inspect product code safely.
- Use a matching local product repo only when it is already available and clearly matches the approved product summary.
- If the current checkout is Colombo itself, say: "This checkout is Colombo itself. I need your product repo so I can find the actual integrations your product uses."
- Inspect READMEs, package manifests, env examples, Docker/deploy files, imports, SDK usage, config files, service entrypoints, and tests.
- Identify services, operational entrypoints, code paths worth asking Colombo about, and recent/change evidence when available.
- Generate a demo question about code behavior or implementation, then answer with file paths, functions/classes, and limitations.
- Detect third-party integrations from code and filter them before asking the owner what to add next.

Relevant next-source candidates usually include observability metrics, logs/traces, payments, product analytics, databases/customer state, deploy/change systems, support/ticketing, docs/runbooks, queues/background jobs, and operationally important auth/email/integration providers.

Do not suggest low-value implementation dependencies such as UI libraries, build tools, test frameworks, lint tools, generic utilities, type packages, or transitive dependencies. Group related SDKs under the real system, for example `@sentry/*` as Sentry or `stripe` as Stripe.

When presenting next sources, show 2-5 choices maximum. Put the recommended next source first and include the code evidence for each choice.

## File updates after approval

1. Add or update a compact entry under `## Connected systems registry` in `AGENTS.md`.
2. Create `workspace/connected-systems/<slug>.md` only when details are too long for `AGENTS.md`. Include system name, MCP server name, approved read-only tool/capability list, good and bad questions, reliability notes, limitations, cross-check rules, sensitive-data/redaction rules, rights policy, and example answer expectations.
3. Create or update `workspace/test-messages/<slug>.md` with realistic ready-to-copy Slack tests.
4. Add broad runbook rules to `AGENTS.md` when they should guide future investigations.
5. Update deployment notes only when needed for approved runtime MCP config, including `codex_mcp_server_names` and `codex_mcp_enabled_tools`. Do not write secrets.

## Dynamic Slack test message rules

Test messages must match the owner's actual system, sampled data shape, repo structure, and purpose. Avoid toy prompts.

- Observability: live health, anomaly windows, segmentation, deploy correlation.
- Logs/traces: error patterns, customer/request drilldowns, timing.
- Repositories/GitHub/code: implementation paths, relevant tests, ownership, detected integrations, and what runtime source must be cross-checked before concluding live behavior.
- Payments: payment state, revenue movement, failed charges, refunds, subscriptions, and analytics cross-checks.
- Product analytics: funnels, activation, retention, cohorts, and payments/deploy cross-checks.
- Databases/customer systems: customer state, account/order status, safe summaries, and blast radius.
- Docs/runbooks: known procedures, caveats, and what to check next.

## Quality bar

The final update should make Colombo better at deciding when to call this system's tools, what the output means, what it does not prove, what to cross-check, what data must stay out of Slack, what answer format is expected, what the demo answer proves, which next sources matter, and which exact MCP tools are approved for runtime.

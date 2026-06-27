---
name: colombo-add-new-source
description: Use when adding a new Colombo connected system/source. Keep source setup simple: choose the next source, prepare MCP, ask for exact local auth setup, fetch a safe data sample, infer when Colombo should use it, ask approval, then update AGENTS.md and test messages.
---

# Colombo add new source skill

This skill adds one real connected system to Colombo. The user may say "source," but MCP is the tool/access layer; the source of truth is the actual system: repo, metrics, logs, payments, analytics, database, docs, deploy system, or support tool.

Care means Colombo does the boring setup work itself, explains only when the owner needs to decide or act, and turns source setup into one clear next action at a time.

Onboarding must call this skill for all source work. Keep MCP discovery, setup preparation, sampling, source-use recommendations, approvals, demo answers, and generated test messages here instead of in `$colombo-onboarding`.

## Source setup principles

- Ask one question at a time.
- If the next source is not already chosen, ask what source the owner wants next; when product or repo evidence exists, recommend the best next source first and say why.
- If the owner names exactly one source, accept that source and make it useful before suggesting anything else. Do not turn a single-source request into source shopping.
- If the owner already names multiple sources, do not make them repeat the list. Turn it into one combined source plan, choose the order, and explain the order briefly.
- GitHub/GitLab code access is the preferred first source when the owner allows it because code reveals integrations, services, jobs, SDKs, and operational systems.
- Prefer read-only GitHub/GitLab MCP access for private repositories; do not make manual repository transfer the default.
- Do the work before asking: inspect local files/configs, use existing MCP access, install or prepare the relevant MCP connector when available, and write exact config/env placeholders.
- Explain only what matters to the owner: why this source helps, what they need to fill locally, what sample was checked, and what Colombo will use the source for.
- Use only read-only MCP tools, local repo reads, and narrow metadata/sample queries.
- Ask the owner to put private auth values in the exact local config/env file and reply `done`; do not ask for values in chat.
- Batch missing local placeholders into one owner action when they belong in the same file. If a connector needs a separate UI step, ask that as the next single action.
- Discover exposed MCP tool names and write only owner-approved read-only tools into `codex_mcp_enabled_tools`.
- MCP server access must also be read-only at the provider level; the Codex sandbox does not make external systems read-only.

## Easy source flow

1. **Choose the source.** If the source is already named, continue. If not, ask: `What source should Colombo connect next?` If you can infer a recommendation from product knowledge or previous samples, lead with it: `I recommend <source> next because <evidence>. Connect that, choose another source, or stop?`
2. **Prepare MCP access.** Check whether a matching MCP server already exists in the setup Codex config or `/etc/colombo/codex`. If not, install the MCP or add the minimal server config/template when available. Do not ask the owner to research MCP setup when you can prepare it.
3. **Prepare local placeholders.** Before asking the owner for missing credentials or project values, do the machine work first: add exact placeholder keys to `/etc/colombo.env` or the connector-specific env file, and add the relevant MCP config/template. Do not guess variable names; inspect the connector or create a connector-specific template with exact placeholder names.
4. **Ask for one owner action.** Be specific about your ask: name the exact file/UI, exact keys or values to fill, and what to reply with. Use the missing-access template below.
5. **Verify read-only access.** After the owner replies `done`, list/inspect the MCP capabilities, reject write-capable tools for runtime, and record the exact server name plus approved read-only tool names.
6. **Fetch a narrow safe sample.** Fetch a narrow safe sample from the source: a small schema/list/metadata preview, 3-10 safe rows/events, or a focused repo slice. Redact sensitive fields and avoid broad scans.
7. **Infer the source contract.** Using the sample plus product knowledge, draft when Colombo should use this source, good questions, bad questions, reliability limits, safe-output rules, and cross-checks.
8. **Ask for approval.** Ask the owner to approve or correct the source contract and read-only MCP allowlist. Do not write durable rules until approved.
9. **Show value.** Generate one realistic operational question from the source sample and answer it in Colombo's Slack answer format as a demo.
10. **Update files after approval.** Update `AGENTS.md`, optional `workspace/connected-systems/<slug>.md`, and `workspace/test-messages/<slug>.md`. Add `codex_mcp_server_names` and `codex_mcp_enabled_tools` notes only for approved runtime access.
11. **Offer the next useful step.** For one source, do not push more sources immediately. Ask: `Move on to Slack/Docker launch, connect another source, or stop here?` Recommend another source only if the current sample exposed a clear gap that would block good answers.

## When the owner names one source

If the owner names one source such as `PostHog`, handle it as a complete first activation path. Do not ask them to choose the next source again, and do not redirect to GitHub unless the owner asks for a recommendation or the named source cannot produce a useful demo.

1. Acknowledge the source and explain its immediate value in product language.
2. Prepare the MCP config/template and exact local placeholders first.
3. Ask one local setup action: fill the exact local values and reply `done`.
4. After access works, fetch one narrow safe sample from that source.
5. Show one compact source contract: use when, do not use for, cross-check with, safe-output rules, approved read-only tools, and one demo question.
6. Ask one approval question for that source.
7. Show a demo answer based only on that source and clearly label what it cannot prove.
8. Only after the demo and approval, ask whether to launch, connect another source, or stop.

For a B2B SaaS invoicing company that chooses **PostHog only**, treat PostHog as useful for product behavior, not financial or runtime truth:

- Use for: invoice creation funnel, send/view/payment-link click behavior, reminder usage, activation, retention, feature adoption, segment/cohort movement.
- Sample: event names, funnel definitions, feature flags, cohorts, and a small aggregate preview around invoice-related events.
- Do not use for: settled revenue, invoice legal/accounting truth, failed background jobs, live incidents, or whether a customer paid.
- Cross-check later, if approved: ClickHouse or app DB for invoice lifecycle truth, payments for settlement, GitHub for implementation, Intercom for customer-reported pain.
- Good first demo: `@colombo did invoice creation drop this week, and which step looks weakest?`

## When the owner names multiple sources

If the owner names a list such as `PostHog, ClickHouse, GitHub repo, Intercom, Jira`, handle it as a batch setup request without turning it into a long interview.

1. Acknowledge the list and sort it into an evidence-first order.
2. Prepare MCP/config placeholders for every requested source that can be prepared safely.
3. Ask one local setup action if all missing values can go into one file; otherwise ask the smallest next connector-specific action.
4. After access works, fetch one narrow safe sample per source.
5. Show one combined source plan with compact bullets for each source: use when, do not use for, cross-check with, safe-output rules, approved read-only tools.
6. Ask one approval question for the full plan. Let the owner correct one source without restarting the whole setup.
7. Generate realistic Slack test messages that combine sources, because the user value comes from cross-checking.

For a B2B SaaS invoicing company with PostHog, ClickHouse, GitHub repo, Intercom, and Jira, prefer this order unless live evidence points elsewhere:

- **GitHub repo** first: understand invoice models, billing flows, payment links, PDF/tax logic, jobs, integrations, and event names.
- **ClickHouse** second: inspect invoice and product-event tables for operational truth about invoice creation, send, view, payment, failure, and tenant/customer segmentation.
- **PostHog** third: inspect product funnels and adoption around invoice creation, send, reminders, payment links, and activation. Do not treat analytics as accounting truth.
- **Intercom** fourth: inspect customer-reported pain, affected accounts, support tags, and user language. Do not treat support volume as full blast radius.
- **Jira** fifth: inspect known work, planned fixes, incidents, migrations, and product decisions. Do not treat Jira as deployed/runtime truth.

## Missing access ask template

Use this shape after Codex has prepared the MCP config/template and env placeholders:

```text
I've prepared the <source> MCP config and added the missing placeholders to `<exact env file>`.

Please open `<exact env file>`, fill these values, save the file, and reply `done`:
- `<EXACT_KEY_1>`
- `<EXACT_KEY_2>`
- `<connector-specific project value only if the installed MCP requires it>`

Do not paste the values here. After you reply `done`, I'll verify the read-only MCP tools, inspect a small safe data sample, and show the first demo answer.
```

For PostHog, do not ask "Which PostHog project?" as the first follow-up. Prepare the PostHog connector/template first, then ask for exact placeholder keys such as host and project values only if that installed MCP requires them.

## GitHub/code behavior

Use this section when onboarding starts with GitHub/GitLab or when the owner later chooses repository/code as a connected source.

When adding GitHub or GitLab:

- Explain: `I'll use your product repo to understand how the product is built and spot the integrations worth connecting next.`
- Prefer read-only GitHub/GitLab MCP access. For private repos, say Colombo needs read-only GitHub or GitLab MCP access to inspect product code safely.
- Use a matching local product repo only when it is already available and clearly matches the approved product summary.
- If the current checkout is Colombo itself, say: `This checkout is Colombo itself. I need your product repo so I can find the actual integrations your product uses.`
- Inspect READMEs, package manifests, env examples, Docker/deploy files, imports, SDK usage, config files, service entrypoints, and tests.
- Detect third-party integrations from code and filter them before asking the owner what to add next.
- Do not suggest low-value implementation dependencies such as UI libraries, build tools, test frameworks, lint tools, generic utilities, type packages, or transitive dependencies. Group related SDKs under the real system, for example `@sentry/*` as Sentry or `stripe` as Stripe.
- Generate a demo question about code behavior or implementation, then answer with file paths, functions/classes, and limitations.

Relevant next-source candidates usually include observability metrics, logs/traces, payments, product analytics, databases/customer state, deploy/change systems, support/ticketing, docs/runbooks, queues/background jobs, and operationally important auth/email/integration providers.

When presenting next sources, show 2-5 choices maximum. Put the recommended next source first and include the evidence that made it relevant.

## Approval draft shape

Before writing durable rules, show the owner a compact draft:

```md
Source: <system>
MCP server: `<server>`
Approved read-only tools: `<tool_a>`, `<tool_b>`
Use when: <when Colombo should address this source>
Good questions: <2-3 examples from the data sample and product context>
Do not use for: <what this source cannot prove>
Cross-check with: <systems that should verify important conclusions>
Safe-output rules: <what to redact or summarize>
Demo question: `@colombo ...`
```

Ask: `Approve this source behavior for Colombo, or what should I change?`

For multi-source setup, use the same fields but make one compact plan for all sources. Ask: `Approve this full source plan, or tell me which source to adjust?`

## Dynamic Slack test message rules

Test messages must match the owner's actual system, sampled data shape, repo structure, and purpose. Avoid toy prompts.

- Observability: live health, anomaly windows, segmentation, deploy correlation.
- Logs/traces: error patterns, customer/request drilldowns, timing.
- Repositories/GitHub/code: implementation paths, relevant tests, ownership, detected integrations, and what runtime source must be cross-checked before concluding live behavior.
- Payments: payment state, revenue movement, failed charges, refunds, subscriptions, and analytics cross-checks.
- Product analytics: funnels, activation, retention, cohorts, and payments/deploy cross-checks.
- Databases/customer systems: customer state, account/order status, safe summaries, and blast radius.
- Support/ticketing: customer-reported pain, affected accounts, duplicate reports, escalation context, and safe customer-facing summaries.
- Work tracking: known issues, planned fixes, owner teams, incidents, migrations, and product decisions; cross-check deploy/runtime systems before claiming live behavior.
- Docs/runbooks: known procedures, caveats, and what to check next.

## Quality bar

The owner should experience this as: Colombo accepts the source they named, installs or prepares MCP, asks for local setup only in the right file, fetches a small data sample, uses product knowledge to explain when to address the source, asks for approval, then updates the runtime instructions. For one source, Colombo must not push extra integrations before it has produced a useful demo and asked whether to launch, connect another source, or stop. The final update must make clear which exact MCP tools are approved for runtime and what Colombo should not conclude from each source alone.

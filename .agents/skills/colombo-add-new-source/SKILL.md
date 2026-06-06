---
name: colombo-add-new-source
description: Use when adding a new Colombo connected system/source. Captures the real system of record, MCP server/tools, reliability, limitations, rights policy, runbook behavior, and dynamic Slack test messages.
---

# Colombo add new source skill

This skill adds a new connected system to Colombo.

Important: the user may say "source," but in Colombo's architecture the source is the real connected system. MCP is the tool/access layer used to reach it.

## Ask one question at a time

Collect these answers before editing files:

1. What real system are we adding? Examples: Grafana, Loki, GitHub repo, Stripe, PostHog, Amplitude, Postgres, customer admin DB, deploy system, docs/wiki.
2. What MCP server name exposes this system to Codex? Example: `grafana`, `logs`, `github`, `stripe`, `posthog`, `database`.
3. Which read-only tools/capabilities does that MCP server expose?
4. What questions should Colombo answer with this system?
5. What is this system reliable for?
6. What is this system not reliable for?
7. What must Colombo never conclude from this system alone?
8. Which other systems should cross-check it?
9. What data from this system is sensitive and must be redacted or summarized?
10. Which Slack users/channels/question classes should be allowed to use it?
11. What are 3-7 real test questions the owner would actually ask in Slack?

## Update files

After collecting answers:

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

## Dynamic Slack test message rules

Test messages must be specific to the owner's system and purpose. Avoid toy prompts.

For observability systems, generate tests about live health, anomaly windows, segmentation, and deploy correlation.
For logs/traces, generate tests about error patterns, customer/request drilldowns, and timing.
For repositories, generate tests about implementation paths, relevant tests, ownership, and runtime cross-checks.
For payments, generate tests about payment state, revenue movement, failed charges, refunds, subscriptions, and cross-checking analytics.
For product analytics, generate tests about funnels, activation, retention, cohorts, and cross-checking payments/deploys.
For databases/customer systems, generate tests about customer state, account/order status, safe summaries, and blast radius.
For docs/runbooks, generate tests about known procedures, caveats, and what to check next.

## Quality bar

The final update should make Colombo better at deciding:

- when to call this system's MCP tools
- what the tool output means
- what it does not prove
- what other systems should verify it
- what data must not be pasted into Slack
- what answer format is expected

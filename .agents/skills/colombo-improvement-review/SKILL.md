---
name: colombo-improvement-review
description: Use when reviewing Colombo feedback and proposing owner-approved improvements to AGENTS.md, connected-system cards, runbooks, source-routing rules, redaction rules, or test messages.
---

# Colombo improvement review skill

Use this skill for Colombo's self-improvement loop: review stored Slack feedback, find repeat failure patterns, and propose small owner-reviewable setup changes.

## Rules

- Do not mutate production systems or external source repositories.
- Do not apply improvements without owner approval.
- Do not add secrets, raw logs, private customer data, or credentials to setup files.
- Prefer durable rules in `AGENTS.md`; use `workspace/connected-systems/*.md` only for longer system-specific cards.
- Put generated regression prompts in `workspace/test-messages/*.md`.
- Every suggested change must cite the feedback or job pattern that caused it.

## Review steps

1. Read recent feedback summaries from the configured state directory.
2. Group weak answers by Weak-answer patterns: wrong or missing connected system, unsupported conclusion, missing timeline, missing blast radius, missing cross-check, unsafe detail, poor Slack formatting, or unclear next step.
3. Propose the smallest instruction change that would prevent the pattern from recurring.
4. Add Slack regression prompts that would catch the issue next time.
5. Write a Markdown suggestion for `workspace/improvements/pending/<date>.md`.

## Output format

```md
# Colombo improvement suggestion

## Review scope
- Jobs reviewed:
- Weak-answer patterns:

## Suggested changes
### 1. <short name>
- Target file:
- Change summary:
- Why this helps:
- Evidence from feedback/job ids:
- Risk / owner review notes:

## Proposed patch guidance

## Suggested Slack regression tests
```

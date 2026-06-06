---
name: colombo-improvement-review
description: Use when reviewing Colombo feedback and proposing owner-approved improvements to AGENTS.md, connected-system cards, runbooks, source-routing rules, redaction rules, or test messages.
---

# Colombo improvement review skill

Use this skill for the self-improvement loop.

## Goal

Review stored Slack job feedback and produce small owner-reviewable improvements to Colombo setup files.

## Rules

- Do not mutate production systems.
- Do not change external source repositories.
- Do not apply improvements without owner approval.
- Do not add secrets, raw logs, private customer data, or credentials to setup files.
- Prefer changes to `AGENTS.md` because rights policy, runbooks, source-routing rules, and answer contracts should mostly live there.
- Use `workspace/connected-systems/*.md` for longer system-specific cards.
- Use `workspace/test-messages/*.md` for generated regression prompts.
- Every suggested change must explain which feedback or job pattern caused it.

## Review steps

1. Read recent feedback summaries under the configured state directory.
2. Group weak answers by pattern:
   - wrong or missing connected system
   - unsupported conclusion
   - missing timeline
   - missing blast radius
   - missing cross-check
   - unsafe or too much detail
   - poor Slack formatting
   - unclear next step
3. Propose the smallest durable instruction change that would prevent recurrence.
4. Add regression Slack test prompts that would catch the issue next time.
5. Produce Markdown suitable for `workspace/improvements/pending/<date>.md`.

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

---
name: 'bQuery: Start Task'
description: 'Use when starting any new bQuery task, issue, PR, or feature so the agent can orient itself quickly and continue with the right plan.'
argument-hint: 'Describe the issue, PR goal, bug, or feature'
agent: 'agent'
---

You are starting work in the bQuery.js repository (`@bquery/bquery`).

Use the user's supplied task as the active work item and orient yourself first with:

- [AGENT.md](../../AGENT.md)
- [llms.txt](../../llms.txt)
- [package.json](../../package.json)
- [`.github/copilot-instructions.md`](../copilot-instructions.md)

Then:

1. Identify the affected modules and the relevant `src/<module>/index.ts` barrels.
2. Read the nearby implementation before proposing edits.
3. Call out the invariants that matter for this task, such as strict TypeScript, HTML sanitization, chainable DOM APIs, zero runtime dependencies, and `src/full.ts` sync when public runtime exports change.
4. List the exact tests, docs, examples, and validation commands that should be touched.
5. Produce a short implementation plan and continue with the work instead of stopping after orientation unless the task is genuinely blocked.

Repository-specific reminders:

- Use Bun commands, not Node-based substitutes.
- Prefer additive, backward-compatible changes.
- New public APIs require tests, docs, and export wiring.
- If version, engines, or AI guidance files change, finish with `bun run check:ai-guidance`.

---
name: 'bQuery: Sync AI Guidance'
description: 'Use when updating version metadata, supported engines, exports, or AI-facing repo guidance so the shared files stay in sync.'
argument-hint: 'Describe the guidance, release, or metadata update'
agent: 'agent'
---

Refresh bQuery's AI-facing guidance and release metadata as a synchronized set.

Source of truth order:

1. [package.json](../../package.json)
2. `src/*/index.ts` public barrels
3. [AGENT.md](../../AGENT.md)
4. [`docs/guide/`](../../docs/guide/)
5. [CHANGELOG.md](../../CHANGELOG.md)

When the update applies, review and sync the relevant shared files together:

- [AGENT.md](../../AGENT.md)
- [llms.txt](../../llms.txt)
- [`.github/copilot-instructions.md`](../copilot-instructions.md)
- [`.cursorrules`](../../.cursorrules)
- [`.clinerules`](../../.clinerules)
- [README.md](../../README.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)

Guardrails:

- Keep the role split clear: `AGENT.md` is the deep reference, `llms.txt` is the compact mirror, Copilot instructions stay behavioral/meta, and `.cursorrules` / `.clinerules` remain derived snapshots.
- Avoid updating only one guidance file when the change obviously applies to the synced set.
- Re-check `src/full.ts` if public runtime exports changed.

Finish by running [`scripts/check-ai-guidance.mjs`](../../scripts/check-ai-guidance.mjs) via `bun run check:ai-guidance`.

---
name: bquery-ai-guidance-sync
description: 'Refresh bQuery AI guidance and release metadata. Use when version, engines, exports, AGENT.md, llms.txt, copilot-instructions, .cursorrules, .clinerules, README, CONTRIBUTING, or check-ai-guidance need to stay in sync.'
---

# bQuery AI Guidance Sync

## When to Use

Use this skill when release metadata, supported engines, public exports, or shared AI-facing repo guidance change.

Typical triggers:

- version bump in `package.json`
- engine floor changes for Node.js or Bun
- changes in public module exports
- refreshes to `AGENT.md`, `llms.txt`, or `.github/copilot-instructions.md`
- updates to `.cursorrules` or `.clinerules`
- changes to the guidance sync script
- release sweeps for README, docs, or changelog after a public-surface change

## Source of Truth

Trust these in order:

1. `package.json`
2. `src/*/index.ts`
3. `AGENT.md`
4. `docs/guide/*.md`
5. `CHANGELOG.md` for release deltas and migration context

## Procedure

1. Confirm the real version, engines, scripts, and exports in `package.json`.
2. Verify the current public runtime surface in the relevant `src/*/index.ts` barrels.
3. Update the shared AI-facing files as a synced set:
   - `AGENT.md`
   - `llms.txt`
   - `.github/copilot-instructions.md`
   - `.cursorrules`
   - `.clinerules`
   - `README.md`
   - `CONTRIBUTING.md`
4. If public exports changed, re-check `src/full.ts`.
5. If the release messaging changed, update the relevant docs guides and `CHANGELOG.md`.
6. Run the repo sync check before finishing.

## Project-Specific Guardrails

- Keep the role split clear:
  - `AGENT.md` = deep reference
  - `llms.txt` = compact mirror
  - `.github/copilot-instructions.md` = behavioral and meta guidance
  - `.cursorrules` and `.clinerules` = derived snapshots
- Do not let the guidance files drift from `package.json` version or engine metadata.
- Avoid updating only one guidance file when the change obviously applies to the synced set.

## Required Validation

Run:

- `bun run check:ai-guidance`

Use additional validation as needed for the actual code or docs touched.

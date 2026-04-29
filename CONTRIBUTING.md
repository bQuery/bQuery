# Contributing to bQuery

Thanks for your interest in contributing to **bQuery**! This guide explains how to set up the project locally, develop changes, and run tests.

## Prerequisites

- **Node.js** `>=24.0.0`
- **Bun** `>=1.3.13` (recommended, aligned with the project scripts)
- **Git**

## Setup

1. Clone the repository.
2. Install dependencies: `bun install`

## Development

### Documentation (VitePress)

- Start the dev server: `bun run dev`

### Storybook

- Start Storybook: `bun run storybook`

### Build

- Production build of the docs: `bun run build`

## Tests

- Run all tests: `bun test`

## Code Style & Quality

- Keep changes small and focused.
- Follow the existing TypeScript style and project structure.
- Add tests when introducing new behavior or fixing bugs.
- Update docs/examples when the public API changes.

## AI guidance synchronization

If you change the public runtime surface, release version, or supported engines, also sync the shared AI-facing repo files:

- `AGENT.md`
- `llms.txt`
- `.github/copilot-instructions.md`
- `.cursorrules`
- `.clinerules`
- `README.md` (AI support section and any release callouts that changed)

After those updates, run `bun run check:ai-guidance` to verify the version / engine / guidance metadata still matches `package.json`.

If public exports changed, also keep `src/full.ts` aligned with the module barrels under `src/*/index.ts`.

## Pull Requests

- Describe **what** and **why** you changed something.
- Link relevant issues if available.
- Ensure tests pass locally and the docs still build.

## Security

Please do not post sensitive details publicly. If you find a security issue, report it responsibly rather than opening a public issue.

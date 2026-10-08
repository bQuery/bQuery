# Contributing to bQuery

Thanks for your interest in contributing to **bQuery**! This guide explains how to set up the project locally, develop changes, and run tests.

## Community expectations

By participating in this project, you agree to follow the repository's [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it before opening issues, reviewing code, or contributing changes.

## Prerequisites

- **Node.js** `>=24.0.0`
- **Bun** `>=1.4.0` (recommended, aligned with the project scripts)
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
- Run the real-browser lane: `bun run build && bun run test:browser`
  (add `--project=chromium` to run one engine). Install the engines once with
  `bunx playwright install chromium firefox webkit`.

`bun test` runs every DOM test under happy-dom, which cannot observe real
shadow-DOM slotting, `adoptedStyleSheets`, Trusted Types enforcement, Web
Animations timing or pointer events. The Playwright suite in `browser/` covers
those in Chromium, Firefox and WebKit: component lifecycle and slots, rendering
under an enforced `require-trusted-types-for 'script'` CSP, view transitions
and FLIP, pointer and keyboard drag and drop, and hydration mismatches. Its
fixture server (`browser/server.ts`) is built on bQuery's own
`createServer()` + `serveStatic()`. Add a `*.pw.ts` spec there when a behaviour depends
on a real engine.

## Benchmarks

The `bench/` suite ([mitata](https://github.com/evanwashere/mitata)) measures
signal-graph throughput (fan-out, deep chains, diamonds, batching), `bq-for`
mount and update cost, and `renderToString()` throughput.

- Run it: `bun run bench` (`--filter reactive` runs a subset)
- Write a JSON summary: `bun run bench --json bench.json`
- Compare two summaries: `bun run bench:compare base.json head.json` — exits
  non-zero when a median is more than 20 % slower (`--threshold 0.1` to tighten)

Every pull request runs the suite against its base and its head on the same CI
runner and fails on a regression beyond 20 %; the report lands in the job
summary. A nightly run on `dev` keeps the numbers as an artifact. When a change
is meant to trade speed for something else, say so in the PR. Changes to the
reactive core or the view should come with before/after numbers.

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

If public exports changed, also keep `src/full.ts` aligned with the module barrels under `src/*/index.ts` and run `bun run check:full-bundle` to catch runtime or type export drift.

## Pull Requests

- Describe **what** and **why** you changed something.
- Link relevant issues if available.
- Use the pull request template and complete the validation checklist honestly.
- Ensure tests pass locally and the docs still build.

## Security

Please do not post sensitive details publicly. If you find a security issue, report it responsibly rather than opening a public issue.

# Contributing

Thanks for your interest in contributing to bQuery.js! This section bundles the contributor-facing documentation. The canonical sources of truth for repository conventions are:

- [`CONTRIBUTING.md`](https://github.com/bQuery/bQuery/blob/main/CONTRIBUTING.md) — the canonical contributing guide.
- [`AGENT.md`](https://github.com/bQuery/bQuery/blob/main/AGENT.md) — deep architectural reference (also useful for human contributors).
- [`CODE_OF_CONDUCT.md`](https://github.com/bQuery/bQuery/blob/main/CODE_OF_CONDUCT.md) — community standards.
- [`SECURITY.md`](https://github.com/bQuery/bQuery/blob/main/SECURITY.md) — vulnerability disclosure.
- [`CHANGELOG.md`](https://github.com/bQuery/bQuery/blob/main/CHANGELOG.md) — release history.

The pages in this section summarise those documents for the docs site and link out for the full text.

## Quick start

```bash
# Clone
git clone https://github.com/bQuery/bQuery.git
cd bQuery

# Install dependencies (Bun is the canonical tool)
bun install

# Verify everything works
bun run lint
bun run build
bun test

# Optional: run the docs site locally
bun run dev
```

Supported tooling: **Node ≥ 24** and **Bun ≥ 1.3.13**. See [Supported Runtimes](/concepts/runtimes).

## Workflow at a glance

1. **Open an issue first** for non-trivial changes — this avoids wasted work.
2. **Branch** from `main` (or `development` for in-flight work).
3. **Make the smallest change that fully addresses the request.** Add or update tests and docs.
4. **Run the local validation suite**: `bun run lint`, `bun run build`, `bun test`, and `bun run check:full-bundle` for any public-export change.
5. **Open a PR** using the [PR template](https://github.com/bQuery/bQuery/blob/main/.github/pull_request_template.md). Conventional Commits are required (`feat(module): …`).

## Where to go next

- [Repository Layout](/contributing/repo-layout) — directory tour.
- [Architecture](/contributing/architecture) — module layering rules and the dependency direction guarantee.
- [Testing Strategy](/contributing/testing-strategy) — how the test suite is organised.
- [Release Process](/contributing/release-process) — `check:ai-guidance`, `check:full-bundle`, semver policy.
- [Agent Guide](/contributing/agent-guide) — curated subset of `AGENT.md` for human contributors.
- [Code of Conduct](/contributing/code-of-conduct).
- [Security Policy](/contributing/security).

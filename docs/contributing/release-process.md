# Release Process

This page documents how bQuery.js cuts releases and what contributors should expect when a PR lands.

## Versioning

bQuery follows [Semantic Versioning](https://semver.org/):

- **Major** — breaking changes.
- **Minor** — additive, backward-compatible features. Deprecations may be flagged.
- **Patch** — bug fixes and documentation-only changes.

Stable modules (see [Stability matrix](/introduction#stability-matrix)) follow this strictly. Beta and experimental modules may move faster.

## Release artefacts

A bQuery release produces:

- **npm package** `@bquery/bquery` published from the repository root.
- **GitHub release** matching the package version.
- **Updated `CHANGELOG.md`** under the new version heading.
- **Updated docs** including a new `docs/release-notes/<minor>.md` page for minors and majors.
- **Custom domain `bquery.js.org`** redeployed from the new `docs/` content (via the docs site CI).

## Validation gates

Before publishing, the following must pass:

```bash
bun run lint
bun run lint:types
bun run build
bun test
bun run check:full-bundle
bun run check:ai-guidance
bun run check:stability
```

CI runs the equivalent steps automatically on PRs and on `main`.

### `check:full-bundle`

`bun run check:full-bundle` statically verifies that `src/full.ts` re-exports every public runtime symbol and every public type from every module barrel. Any drift fails the check. If a module barrel cannot be read or parsed, that is also treated as a failure — silently skipping is no longer allowed.

### `check:ai-guidance`

`bun run check:ai-guidance` verifies that the AI guidance files (`AGENT.md`, `llms.txt`, `.cursorrules`, `.clinerules`, `.github/copilot-instructions.md`, `README.md`, `CONTRIBUTING.md`) stay in sync with `package.json` (version, engines) and with each other. If you touch any of these, run this script before opening a PR.

### `check:stability`

`bun run check:stability` verifies that every place bQuery advertises module maturity agrees with the canonical matrix in `scripts/stability-matrix.mjs`: the [`STABILITY.md`](https://github.com/bQuery/bQuery/blob/main/STABILITY.md) table, the README "Modules at a glance" table, and the docs `introduction.md` "Stability matrix". When a module changes status, update `scripts/stability-matrix.mjs` and append a line to its history in `STABILITY.md`; the check tells you which surfaces to reconcile so they cannot silently drift.

## Commit messages

Repository commits follow **Conventional Commits**, with a module-aligned scope:

```
feat(reactive): add useEventSource heartbeat option
fix(server): validate cookie attributes for header-safe characters
docs(ssr): document flushBoundary
test(forms): cover disabled field early-return path
```

English-only. Past tense or imperative ("add" / "added") is acceptable; be consistent within a PR.

## Deprecation policy

- **Stable** modules: deprecate at least one minor before removal. Mark with `@deprecated` JSDoc and a migration comment.
- **Beta** modules: deprecations may be flagged in the same minor that removes them; a migration path is always provided.
- **Experimental** modules: APIs may change between minors without prior deprecation.

When you deprecate something, add an entry to the relevant section in `CHANGELOG.md` *and* in the per-minor release notes page under `docs/release-notes/`.

## Publishing flow (maintainer-only)

The publish step is automated via `prepublishOnly`:

```bash
# In package.json:
"prepublishOnly": "bun run clean && bun run build && bun test"
```

A maintainer runs `npm publish` (or the configured release action). The custom domain `bquery.js.org` is redeployed from the latest `docs/` build.

## See also

- [Stability matrix](/introduction#stability-matrix) — canonical source: [`STABILITY.md`](https://github.com/bQuery/bQuery/blob/main/STABILITY.md), validated by `check:stability`
- [Bundle & Tree-shaking](/concepts/bundle-and-tree-shaking) — `check:full-bundle` details
- [Contributing — Architecture](/contributing/architecture) — module-addition checklist
- [Release Notes](/release-notes/)

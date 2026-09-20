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
bun run check:publish   # needs a current dist/
```

CI runs the equivalent steps automatically on PRs and on `main`.

### `check:publish`

`bun run check:publish` runs two external validators against a real `npm pack`
of the current build, and also runs from `prepublishOnly` and from the publish
workflow (#218):

- **[`publint`](https://publint.dev)** — checks the `exports` map and the
  tarball's contents. The map is hand-edited on every new module, so it
  drifts easily.
- **[`@arethetypeswrong/cli`](https://arethetypeswrong.github.io)** — resolves
  every entry point under `node10`, `node16` (from CJS and from ESM) and
  `bundler`, and reports where the published types misrepresent the JavaScript.

Both were added after they caught three real problems in one run: the 23
`types`-ordering errors from #219, and two the audit had missed — that
`require('@bquery/bquery')` returned an empty object, and that every emitted
declaration used extensionless relative imports (315 problems), which is a hard
`TS2834` for any consumer with `skipLibCheck: false`. The declarations are now
rewritten on the way out of the build by `scripts/postbuild-types.mjs`.

**Two attw results are ignored on purpose**, both consequences of the ESM-only
policy in the [module format](/guide/getting-started#module-format) docs:

| Ignored                          | Why                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `node10` resolution failures     | `node10` means TypeScript before 4.7, which predates `exports`. Supporting it needs `typesVersions`, and this package targets modern resolvers. |
| CJS-resolves-to-ESM on sub-paths | The documented policy: sub-paths are ESM-only.                                                                                                  |

Both are handled by `attw --profile esm-only`. Nothing else is ignored:
`--ignore-rules` is deliberately **not** used, because it applies package-wide
and would mask the same class of problem on a sub-path that later grew a
`require` condition.

There used to be a third exemption, `false-esm` on the root: `require()`
worked at runtime while its types resolved to the ESM declaration, which a
`module: node16` CommonJS consumer rejects with `TS1479`. That is fixed rather
than ignored — `scripts/postbuild-cts.mjs` emits a parallel `.d.cts` tree and
the `require` branches point at it (#219). A _copied_ `.d.cts` does not work;
the whole tree has to exist, with relative specifiers resolved to their `.cjs`
twins. `publint` now reports **All good!**.

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

When you deprecate something, add an entry to the relevant section in `CHANGELOG.md` _and_ in the per-minor release notes page under `docs/release-notes/`.

## Publishing flow (maintainer-only)

The publish step is automated via `prepublishOnly`:

```bash
# In package.json:
"prepublishOnly": "bun run clean && bun run build && bun test && bun run check:publish"
```

A maintainer runs `npm publish` (or the configured release action). The custom domain `bquery.js.org` is redeployed from the latest `docs/` build.

## See also

- [Stability matrix](/introduction#stability-matrix) — canonical source: [`STABILITY.md`](https://github.com/bQuery/bQuery/blob/main/STABILITY.md), validated by `check:stability`
- [Bundle & Tree-shaking](/concepts/bundle-and-tree-shaking) — `check:full-bundle` details
- [Contributing — Architecture](/contributing/architecture) — module-addition checklist
- [Release Notes](/release-notes/)

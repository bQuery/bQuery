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

### What ships in the tarball

The `files` field in `package.json` is a deliberate list, not a default. Three
decisions are worth knowing before you change it (#220).

::: warning `.npmignore` is inert while `files` exists
npm ignores the root `.npmignore` entirely when `files` is set, and it is set.
Everything `.npmignore` still lists (`docs/`, `scripts/`, `tests/`, …) is
already excluded by `files`, which is why nobody has noticed. **Exclusions
belong in `files`** — adding one to `.npmignore` has no effect at all, and
`check:package` would flag the resulting size without hinting why.
:::

| Content                                | Shipped | Why                                                                                      |
| -------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `dist/` bundles and `.d.ts`            | ✅      | The package.                                                                             |
| `dist/**/*.d.ts.map` (~0.33 MB)        | ✅      | Makes "go to definition" land on the real `src/` file instead of the declaration stub.   |
| `src/` (~1.85 MB)                      | ✅      | The target those declaration maps point at. Dropping one without the other is pointless. |
| `dist/**/*.{js,mjs,cjs}.map` (~6.4 MB) | ❌      | 62% of the old tarball. Runtime debugging of a minified bundle is the rarest use.        |

Excluding the JS source maps took the package from **2.8 MB / 11.3 MB unpacked
/ 972 files** to **1.1 MB / 4.6 MB / 924 files**.

Both Vite configs therefore use `sourcemap: 'hidden'`: the `.map` files are
still written to `dist/` — for local debugging, and so a release can upload
them to an error tracker — but no `sourceMappingURL` comment is emitted, so
omitting them from the tarball leaves nothing for a browser to chase.

If you ever need published JS source maps, prefer a separate
`@bquery/bquery-sourcemaps` package over re-adding 6.4 MB to every install.

`bun run check:package` enforces all of the above against the real `npm pack`
file list. It needs a current `dist/`, and runs both in the publish
workflow's `build` job — so a re-inflated tarball fails at PR time rather
than mid-release — and again from `prepublishOnly` as a last gate.

It also verifies the invariant the exclusion rests on: that no shipped bundle
carries a `sourceMappingURL` comment. Dropping the maps is only safe while
both vite configs use `sourcemap: 'hidden'`; a revert to `sourcemap: true`
would otherwise ship bundles pointing at maps that 404, with the check still
green.

## Validation gates

Before publishing, the following must pass:

```bash
bun run lint
bun run lint:types
bun run build
bun test
bun run check
bun run check:package   # needs a current dist/
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
"prepublishOnly": "bun run clean && bun run build && bun test && bun run check:package && bun run check:publish"
```

A maintainer runs `npm publish` (or the configured release action). The custom domain `bquery.js.org` is redeployed from the latest `docs/` build.

## See also

- [Stability matrix](/introduction#stability-matrix) — canonical source: [`STABILITY.md`](https://github.com/bQuery/bQuery/blob/main/STABILITY.md), validated by `check:stability`
- [Bundle & Tree-shaking](/concepts/bundle-and-tree-shaking) — `check:full-bundle` details
- [Contributing — Architecture](/contributing/architecture) — module-addition checklist
- [Release Notes](/release-notes/)

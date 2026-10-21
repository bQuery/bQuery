# @bquery/eslint-plugin

ESLint rules for [bQuery.js](https://bquery.js.org) that check its documented invariants.

```sh
bun add -d eslint @bquery/eslint-plugin
```

```js
// eslint.config.js (ESLint 9+ flat config)
import bquery from '@bquery/eslint-plugin';

export default [bquery.configs.recommended];
```

| Rule                               | Recommended | Fix        |
| ---------------------------------- | ----------- | ---------- |
| `@bquery/no-top-level-dollar`      | `warn`      | —          |
| `@bquery/no-dynamic-trusted-html`  | `error`     | suggestion |
| `@bquery/prefer-scoped-reactivity` | `warn`      | suggestion |
| `@bquery/no-value-in-untracked`    | `warn`      | suggestion |
| `@bquery/prefer-subpath-imports`   | `warn`      | autofix    |

See the [ESLint plugin guide](https://bquery.js.org/guide/eslint-plugin) for what each rule reports, with examples.

## Development

The plugin is plain ESM JavaScript without a build step. From the bQuery repository root:

```sh
bun test packages/eslint-plugin                              # rule tests
bun packages/eslint-plugin/scripts/generate-export-map.mjs   # refresh src/export-map.json
```

`src/export-map.json` maps every root export to its module subpath for `prefer-subpath-imports`; a test fails when it is out of date with `src/<module>/index.ts`.

## License

MIT

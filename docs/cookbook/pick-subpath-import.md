# Pick a sub-path import

**Problem.** Keep the bundle small by importing only the modules an app needs.

**Solution.** Use the per-module entry points listed in `package.json#exports`. Avoid the `/full` bundle in production code.

```ts
// ✅ Tree-shakes well
import { signal, computed } from '@bquery/bquery/reactive';
import { $ } from '@bquery/bquery/core';

// ❌ Pulls every module
import { signal } from '@bquery/bquery/full';
```

For CDN / no-build setups, `@bquery/bquery/full` is fine — it is the documented all-in-one entry. For app bundles, prefer per-module imports.

## Why it works

- Each module barrel re-exports only its public surface.
- Vite, Rollup, and esbuild tree-shake unused exports because the package declares `"sideEffects": false` for pure modules.
- The `bun run check:full-bundle` script in the repo guards type-level drift between `/full` and the per-module entries.

## Related

- [Concepts — Bundle & tree-shaking](/concepts/bundle-and-tree-shaking)
- [Getting started — installation](/guide/getting-started#installation)
- `package.json` `exports` is the source of truth for available sub-paths.

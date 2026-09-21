# Testing Strategy

bQuery.js relies on **`bun:test`** with **`happy-dom`** as the DOM environment. There is no Jest, no Vitest, no Mocha. The test suite runs as part of the [`Test`](https://github.com/bQuery/bQuery/blob/main/.github/workflows/test.yml) GitHub Actions workflow on every push and PR.

## Layout

All tests live under `tests/`. The naming convention is `<topic>.test.ts`, mirroring `src/<module>/<topic>.ts` where applicable. Helpers and fixtures live under `tests/` directly, not in `src/`.

## Setup

`tests/setup.ts` configures `happy-dom` globally. The relevant snippet is preloaded via `bunfig.toml`. You do not need to import the setup file from individual tests.

## Test categories

- **Unit** — small, fast, focused on a single function or class.
- **Integration** — multiple modules interacting (e.g., reactive + view).
- **DOM** — DOM-touching scenarios in `happy-dom`. The convention is **create DOM inline, assert behaviour, clean up with `.remove()`**.
- **SSR cross-runtime** — separate workflow runs SSR examples under Node, Bun, Deno.

## Pattern: DOM tests

```ts
import { describe, expect, test } from 'bun:test';
import { $, signal, effect } from '../src';

describe('counter', () => {
  test('updates on signal change', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button id="b">0</button>';
    document.body.appendChild(root);
    try {
      const count = signal(0);
      effect(() => $('#b').text(String(count.value)));
      count.value = 1;
      expect($('#b').text()).toBe('1');
    } finally {
      root.remove();
    }
  });
});
```

## Running tests

```bash
bun test              # run all tests
bun test --watch      # watch mode
bun test path/to/file # run a single file
```

Type-checking the test suite is a separate step:

```bash
bun run test:types
```

CI runs `test:types` **before** `bun test`, so a test-only type error will fail CI even if runtime tests would pass. See the [`Test` workflow](https://github.com/bQuery/bQuery/blob/main/.github/workflows/test.yml).

## Coverage expectations

- **Public APIs** must have tests for the happy path, common edge cases, and runtime misuse.
- **Bug fixes** should land with a regression test that fails without the fix.
- **Integration tests** exercise cross-module flows: SSR → hydration, server → SSR, store + view, router + component, forms + view.

## Async helpers

The [testing module](/guide/testing) ships async helpers that play well with `bun:test`:

- `tick()` / `nextTick()` — wait one microtask / next animation frame.
- `flushPromises()` — drain the microtask queue.
- `runScheduled()` — flush bQuery's internal scheduler.
- `waitFor(predicate, opts)` — poll until the predicate is true.

## Mocking

The testing module also exposes:

- `mockSignal`, `mockComputed`, `mockEffect`
- `mockStore`, `mockI18n`, `mockForm`
- `mockFetch`, `mockWebSocket`
- `mockRouter`

Prefer these over hand-rolled stubs so refactors stay safe.

## Linting tests

`bun run lint` covers `tests/` too. Tests can use the same import style as `src/`.

## Coverage floor

`bun run test:coverage` writes `coverage/lcov.info`; `bun run check:coverage`
holds it to the policy in `scripts/coverage-policy.mjs`. Both run in CI
(#215).

- **The global floor is enforced.** It is measured over `src/` only, so it
  reads lower than the figure in `bun test --coverage`'s own footer, which
  also counts `scripts/` and `tests/` — a well-tested build script should not
  mask a thin source file.
- **The per-file floor is reported, not enforced**, and the reason is a Bun
  reporter bug rather than a policy choice:

  ```console
  $ bun test --coverage tests/store-utils.test.ts
    src/store/utils.ts | 100.00 | 100.00
  $ bun test --coverage tests/store-utils.test.ts tests/store.test.ts
    src/store/utils.ts |  20.00 |   5.08     # same tests, both orders
  ```

  Adding a test file cannot lower a file's coverage, so the whole-suite
  per-file numbers understate any file that two test files load. Gating on
  them would fail builds for reasons unrelated to test quality. The floors are
  recorded so the gate can be switched on once the reporter is fixed, and
  `bun run check:coverage -- --report` prints the current standings.

Since the global figure sums those understated per-file records, it is
conservative rather than wrong — a floor that can only be beaten by genuinely
adding tests.

Raising a floor or deleting an entry from `EXEMPT` is the intended direction.
Adding an entry should come with a reason in the PR that does it.

## See also

- [Testing module guide](/guide/testing)
- [Contributing — Architecture](/contributing/architecture)
- [Contributing — Release Process](/contributing/release-process)

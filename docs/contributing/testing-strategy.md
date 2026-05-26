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

## See also

- [Testing module guide](/guide/testing)
- [Contributing — Architecture](/contributing/architecture)
- [Contributing — Release Process](/contributing/release-process)

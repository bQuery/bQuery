/**
 * Canonical coverage policy (#215).
 *
 * Coverage was good overall but unenforced, and unevenly distributed: several
 * files in modules rated **Stable** were barely covered at all.
 *
 * ## What is enforced
 *
 * A **global floor**, pinned just under what the suite already achieves, so
 * total coverage can only go up.
 *
 * ## What is reported but not enforced
 *
 * A **per-file floor**, because Bun's coverage reporter cannot currently be
 * trusted at file granularity. Reproduced on Bun 1.3.11:
 *
 * ```console
 * $ bun test --coverage tests/store-utils.test.ts
 *   src/store/utils.ts | 100.00 | 100.00
 * $ bun test --coverage tests/store-utils.test.ts tests/security.test.ts
 *   src/store/utils.ts | 100.00 | 100.00
 * $ bun test --coverage tests/store-utils.test.ts tests/store.test.ts
 *   src/store/utils.ts |  20.00 |   5.08     # ← same tests, both orders
 * ```
 *
 * Adding a test file cannot lower a file's coverage, so the whole-suite
 * per-file numbers understate reality for any file two test files load. A
 * gate on them would fail for reasons unrelated to how well the code is
 * tested. `bun run check:coverage --report` prints them; the floors below are
 * recorded so the gate can be switched on once the reporter is reliable.
 *
 * Because the global figure is the sum of those per-file records, it is
 * understated too — which makes it a conservative ratchet, not a wrong one.
 */

/**
 * Global floors as percentages, over `src/` only.
 *
 * Lower than the ~90% in `bun test --coverage`'s own footer, which also counts
 * `scripts/` and `tests/`; those are not the product, and including them lets
 * a well-tested script mask a thin source file.
 */
export const GLOBAL_FLOOR = {
  lines: 88,
  functions: 87,
};

/** Per-file line-coverage floor, as a percentage. Reported, not enforced. */
export const FILE_FLOOR = 70;

/**
 * Source prefixes the per-file floor applies to. The issue names these five
 * as the place to start.
 */
export const ENFORCED_PREFIXES = [
  'src/store/',
  'src/view/',
  'src/security/',
  'src/component/',
  'src/ssr/',
];

/**
 * Files below {@link FILE_FLOOR} in those modules, with the line coverage
 * each reported when the policy landed. Deleting an entry is the goal.
 *
 * `src/store/utils.ts` is listed at its *reported* 5%, not the 100% its own
 * tests actually achieve — see the note above.
 */
export const EXEMPT = {
  'src/store/utils.ts': 5,
  'src/component/props.ts': 24,
  'src/component/scope.ts': 47,
  'src/store/create-store.ts': 49,
  'src/ssr/runtime.ts': 59,
  'src/component/css.ts': 66,
  'src/view/process.ts': 67,
  'src/ssr/expression.ts': 69,
};

/** Whether the per-file floor applies to a path. */
export const isEnforced = (path) => ENFORCED_PREFIXES.some((prefix) => path.startsWith(prefix));

/** The floor a given file must clear. */
export const floorFor = (path) =>
  Object.hasOwn(EXEMPT, path) ? EXEMPT[/** @type {keyof typeof EXEMPT} */ (path)] : FILE_FLOOR;

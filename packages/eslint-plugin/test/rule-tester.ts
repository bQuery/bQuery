/**
 * Shared ESLint `RuleTester` wired to `bun:test` and the TypeScript parser.
 */

import { describe, it } from 'bun:test';
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';

RuleTester.describe = describe;
RuleTester.it = it;
// Read `it.only` only when a test asks for it: bun throws on the property
// access itself when CI is set, which would fail every rule test in CI.
RuleTester.itOnly = (...args: Parameters<typeof it.only>) => it.only(...args);

/** Rule tester parsing modules with `@typescript-eslint/parser`. */
export const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

/** Rule tester using ESLint's default parser (plain JavaScript). */
export const jsRuleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

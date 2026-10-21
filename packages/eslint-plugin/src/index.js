/**
 * `@bquery/eslint-plugin` — lint rules for bQuery's documented invariants.
 *
 * @module @bquery/eslint-plugin
 */

import pkg from '../package.json' with { type: 'json' };
import noDynamicTrustedHtml from './rules/no-dynamic-trusted-html.js';
import noTopLevelDollar from './rules/no-top-level-dollar.js';
import noValueInUntracked from './rules/no-value-in-untracked.js';
import preferScopedReactivity from './rules/prefer-scoped-reactivity.js';
import preferSubpathImports from './rules/prefer-subpath-imports.js';

/** Every rule, keyed by name (without the `@bquery/` prefix). */
const rules = {
  'no-dynamic-trusted-html': noDynamicTrustedHtml,
  'no-top-level-dollar': noTopLevelDollar,
  'no-value-in-untracked': noValueInUntracked,
  'prefer-scoped-reactivity': preferScopedReactivity,
  'prefer-subpath-imports': preferSubpathImports,
};

/** @type {import('eslint').ESLint.Plugin & { configs: Record<string, import('eslint').Linter.Config> }} */
const plugin = {
  meta: {
    name: pkg.name,
    version: pkg.version,
  },
  rules,
  configs: {},
};

plugin.configs.recommended = {
  name: '@bquery/recommended',
  plugins: { '@bquery': plugin },
  rules: {
    '@bquery/no-dynamic-trusted-html': 'error',
    '@bquery/no-top-level-dollar': 'warn',
    '@bquery/no-value-in-untracked': 'warn',
    '@bquery/prefer-scoped-reactivity': 'warn',
    '@bquery/prefer-subpath-imports': 'warn',
  },
};

export default plugin;

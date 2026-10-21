import type { ESLint, Linter, Rule } from 'eslint';

/** Names of the rules shipped by `@bquery/eslint-plugin`. */
export type BQueryRuleName =
  | 'no-dynamic-trusted-html'
  | 'no-top-level-dollar'
  | 'no-value-in-untracked'
  | 'prefer-scoped-reactivity'
  | 'prefer-subpath-imports';

/** The `@bquery/eslint-plugin` plugin object. */
export interface BQueryESLintPlugin extends ESLint.Plugin {
  meta: { name: string; version: string };
  rules: Record<BQueryRuleName, Rule.RuleModule>;
  configs: {
    /**
     * Flat config enabling every rule at its recommended severity. Registers
     * the plugin under the `@bquery` prefix.
     */
    recommended: Linter.Config & {
      plugins: { '@bquery': BQueryESLintPlugin };
      rules: Record<`@bquery/${BQueryRuleName}`, Linter.RuleSeverity>;
    };
  };
}

declare const plugin: BQueryESLintPlugin;
export default plugin;

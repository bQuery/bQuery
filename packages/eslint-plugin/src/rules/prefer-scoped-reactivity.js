/**
 * `prefer-scoped-reactivity` — inside a `component()` lifecycle hook, prefer
 * `useSignal()` / `useComputed()` / `useEffect()` over the unscoped
 * `signal()` / `computed()` / `effect()`, so the primitives are disposed when
 * the component disconnects.
 *
 * @module @bquery/eslint-plugin/rules/prefer-scoped-reactivity
 */

import {
  PACKAGE_NAME,
  bquerySources,
  docsUrl,
  findVariable,
  importOfVariable,
  isFunction,
  matchBQueryCall,
} from '../utils.js';

const COMPONENT_SOURCES = bquerySources('component');
const COMPONENT_FACTORIES = new Set(['component', 'defineComponent']);
const REACTIVE_SOURCES = bquerySources('reactive');

/** Unscoped primitive → its component-scoped counterpart. */
const SCOPED = new Map([
  ['signal', 'useSignal'],
  ['computed', 'useComputed'],
  ['effect', 'useEffect'],
]);
const UNSCOPED = new Set(SCOPED.keys());

/**
 * Lifecycle hooks that run with the component scope active, where the
 * `use*` primitives are valid (see `src/component/component.ts`).
 */
const SCOPED_HOOKS = new Set(['beforeMount', 'connected', 'onAttributeChanged', 'onAdopted']);

/** Import sources that export the scoped primitives. */
const SCOPED_SOURCES = bquerySources('component');

/**
 * Static name of an object property key.
 *
 * @param {import('estree').Property} property - Property node
 * @returns {string | null} The key name, or `null` for computed keys
 */
const keyName = (property) => {
  if (property.computed) return null;
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal') return String(property.key.value);
  return null;
};

/**
 * Find the lifecycle hook a function is the body of, if it is a scoped hook
 * of a bQuery `component()` / `defineComponent()` definition object.
 *
 * @param {import('eslint').Rule.RuleContext} context - Rule context
 * @param {import('estree').Node} fn - Function node
 * @returns {string | null} The hook name, or `null`
 */
const scopedHookName = (context, fn) => {
  const property = fn.parent;
  if (property?.type !== 'Property' || property.value !== fn) return null;
  const name = keyName(property);
  if (!name || !SCOPED_HOOKS.has(name)) return null;
  const definition = property.parent;
  const call = definition?.parent;
  if (
    definition?.type !== 'ObjectExpression' ||
    call?.type !== 'CallExpression' ||
    call.arguments[1] !== definition
  ) {
    return null;
  }
  return matchBQueryCall(context, call, COMPONENT_SOURCES, COMPONENT_FACTORIES) ? name : null;
};

/**
 * Find a usable binding for a scoped primitive in the module, or describe how
 * to import it.
 *
 * @param {import('eslint').Rule.RuleContext} context - Rule context
 * @param {import('estree').CallExpression} call - The unscoped call
 * @param {string} scopedName - `useSignal`, `useComputed` or `useEffect`
 * @returns {{ local: string, importFix?: (fixer: import('eslint').Rule.RuleFixer) => import('eslint').Rule.Fix } | null}
 *   The local name to call and an optional fix adding the import, or `null`
 *   when no trivially safe rewrite exists
 */
const scopedBinding = (context, call, scopedName) => {
  const { sourceCode } = context;
  const scope = sourceCode.getScope(call);
  const existing = findVariable(scope, scopedName);
  if (existing) {
    const info = importOfVariable(existing);
    if (info && info.imported === scopedName && SCOPED_SOURCES.has(info.source)) {
      return { local: scopedName };
    }
    // The name is taken by something else; renaming would change meaning.
    return null;
  }
  // The name must also be free everywhere else in the module, since the new
  // import binding is module-wide.
  const moduleScope = sourceCode.scopeManager.globalScope.childScopes.find(
    (child) => child.type === 'module'
  );
  const program = sourceCode.ast;
  const taken = (s) =>
    s.set.has(scopedName) ||
    s.through.some((reference) => reference.identifier.name === scopedName) ||
    s.childScopes.some(taken);
  if (!moduleScope || taken(moduleScope)) return null;

  const target = program.body.find(
    (statement) =>
      statement.type === 'ImportDeclaration' &&
      statement.importKind !== 'type' &&
      SCOPED_SOURCES.has(String(statement.source.value)) &&
      statement.specifiers.length > 0 &&
      statement.specifiers.every((specifier) => specifier.type === 'ImportSpecifier')
  );
  if (!target) return null;
  const last = target.specifiers[target.specifiers.length - 1];
  return {
    local: scopedName,
    importFix: (fixer) => fixer.insertTextAfter(last, `, ${scopedName}`),
  };
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description:
        'Prefer `useSignal()` / `useComputed()` / `useEffect()` over unscoped primitives inside component lifecycle hooks',
      recommended: true,
      url: docsUrl('prefer-scoped-reactivity'),
    },
    schema: [],
    messages: {
      preferScoped:
        '`{{name}}()` inside the `{{hook}}` hook is not disposed when the component disconnects. Use `{{scoped}}()` instead.',
      useScoped: 'Replace `{{name}}()` with `{{scoped}}()`.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const match = matchBQueryCall(context, node, REACTIVE_SOURCES, UNSCOPED);
        if (!match) return;

        // Only calls made synchronously by the hook body itself: callbacks
        // inside the hook may run after the component scope is gone.
        const ancestors = context.sourceCode.getAncestors(node);
        const fn = ancestors.findLast(isFunction);
        if (!fn) return;
        const hook = scopedHookName(context, fn);
        if (!hook) return;

        const scoped = SCOPED.get(match.name);
        const data = { name: match.name, scoped, hook };
        const suggest = [];
        if (match.namespace) {
          // `bq.effect()` → `bq.useEffect()` when the namespace also exports
          // the scoped primitive (the root entry or the `/full` bundle).
          if (match.source !== `${PACKAGE_NAME}/reactive`) {
            suggest.push({
              messageId: 'useScoped',
              data,
              fix: (fixer) => fixer.replaceText(node.callee.property, scoped),
            });
          }
        } else {
          const binding = scopedBinding(context, node, scoped);
          if (binding) {
            suggest.push({
              messageId: 'useScoped',
              data,
              fix: (fixer) => {
                const fixes = [fixer.replaceText(node.callee, binding.local)];
                if (binding.importFix) fixes.push(binding.importFix(fixer));
                return fixes;
              },
            });
          }
        }

        context.report({ node, messageId: 'preferScoped', data, suggest });
      },
    };
  },
};

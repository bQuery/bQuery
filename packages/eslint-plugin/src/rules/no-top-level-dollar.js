/**
 * `no-top-level-dollar` — disallow bQuery `$()` calls that run on module load.
 *
 * `$()` throws when no element matches the selector (`$$()` returns an empty
 * collection instead). A call at module top level runs as soon as the module
 * is imported: during SSR, in tests, or before the DOM is ready.
 *
 * @module @bquery/eslint-plugin/rules/no-top-level-dollar
 */

import { bquerySources, docsUrl, isFunction, matchBQueryCall } from '../utils.js';

const SOURCES = bquerySources('core');
const NAMES = new Set(['$']);

/**
 * Whether a function runs immediately where it is defined, as in an IIFE
 * (`(() => { ... })()`), so its body still executes on module load.
 *
 * @param {import('estree').Node} fn - Function node
 * @returns {boolean} True for immediately invoked functions
 */
const isImmediatelyInvoked = (fn) =>
  fn.parent?.type === 'CallExpression' && fn.parent.callee === fn;

/**
 * Whether a node executes when the module is evaluated rather than later.
 *
 * @param {import('estree').Node[]} path - Ancestors, outermost first, then the node itself
 * @returns {boolean} True when no deferring function or instance field encloses the node
 */
const runsOnModuleLoad = (path) => {
  for (let index = path.length - 2; index >= 0; index -= 1) {
    const ancestor = path[index];
    if (isFunction(ancestor)) {
      if (!isImmediatelyInvoked(ancestor)) return false;
      continue;
    }
    // Instance field initialisers run per instance, not on module load.
    if (
      (ancestor.type === 'PropertyDefinition' || ancestor.type === 'AccessorProperty') &&
      !ancestor.static &&
      ancestor.value &&
      path[index + 1] === ancestor.value
    ) {
      return false;
    }
  }
  return true;
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow bQuery `$()` calls at module top level, where they run on import and throw when the element is missing',
      recommended: true,
      url: docsUrl('no-top-level-dollar'),
    },
    schema: [],
    messages: {
      topLevelDollar:
        '`$()` runs on import here and throws when no element matches (during SSR, in tests or before the DOM is ready). Move it into a function or lifecycle hook, or use `$$()` for optional elements.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!matchBQueryCall(context, node, SOURCES, NAMES)) return;
        if (!runsOnModuleLoad([...context.sourceCode.getAncestors(node), node])) return;
        context.report({ node, messageId: 'topLevelDollar' });
      },
    };
  },
};

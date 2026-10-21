/**
 * `no-value-in-untracked` — flag `.value` reads inside callbacks that do not
 * subscribe to what they read, and suggest `.peek()` to make that explicit.
 *
 * - `untrack(fn)` runs `fn` with dependency tracking switched off.
 * - The callback of `watch(source, cb)` (and `watchDebounce` /
 *   `watchThrottle`) only re-runs when `source` changes: other signals read
 *   inside it never trigger it (for `watch` they only cause redundant
 *   re-evaluations of the internal effect).
 *
 * @module @bquery/eslint-plugin/rules/no-value-in-untracked
 */

import { bquerySources, docsUrl, findVariable, isFunction, matchBQueryCall } from '../utils.js';

const SOURCES = bquerySources('reactive');

/** Untracking helpers → index of the untracked callback argument. */
const CALLBACK_INDEX = new Map([
  ['untrack', 0],
  ['watch', 1],
  ['watchDebounce', 1],
  ['watchThrottle', 1],
]);
const NAMES = new Set(CALLBACK_INDEX.keys());

/**
 * Whether a `.value` member expression is written rather than read.
 *
 * @param {import('estree').MemberExpression} node - Member expression
 * @returns {boolean} True for assignment, update and `delete` targets
 */
const isWriteTarget = (node) => {
  let child = node;
  let parent = node.parent;
  // Climb through destructuring patterns: `[a.value] = list`, `({ x: a.value } = obj)`.
  while (
    parent &&
    (parent.type === 'ArrayPattern' ||
      parent.type === 'RestElement' ||
      (parent.type === 'Property' &&
        parent.value === child &&
        parent.parent.type === 'ObjectPattern') ||
      parent.type === 'ObjectPattern' ||
      (parent.type === 'AssignmentPattern' && parent.left === child))
  ) {
    child = parent;
    parent = parent.parent;
  }
  if (!parent) return false;
  switch (parent.type) {
    case 'AssignmentExpression':
      // Compound assignments (`+=`) read too, but the intent is a write.
      return parent.left === child;
    case 'UpdateExpression':
      return true;
    case 'UnaryExpression':
      return parent.operator === 'delete';
    case 'ForInStatement':
    case 'ForOfStatement':
      return parent.left === child;
    default:
      return false;
  }
};

/**
 * Whether a function is the untracked callback of a bQuery `untrack()` /
 * `watch*()` call.
 *
 * @param {import('eslint').Rule.RuleContext} context - Rule context
 * @param {import('estree').Node} fn - Function node
 * @returns {string | null} The helper name, or `null`
 */
const untrackedHelper = (context, fn) => {
  const call = fn.parent;
  if (call?.type !== 'CallExpression') return null;
  const match = matchBQueryCall(context, call, SOURCES, NAMES);
  if (!match || call.arguments[CALLBACK_INDEX.get(match.name)] !== fn) return null;
  return match.name;
};

/**
 * Whether `inner` lies inside `outer` (by source range).
 *
 * @param {import('estree').Node} inner - Candidate descendant
 * @param {import('estree').Node} outer - Candidate ancestor
 * @returns {boolean} True when `inner` is within `outer`
 */
const isWithin = (inner, outer) =>
  inner.range[0] >= outer.range[0] && inner.range[1] <= outer.range[1];

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description:
        'Flag `.value` reads inside `untrack()` and `watch()` callbacks, which do not subscribe, and suggest `.peek()`',
      recommended: true,
      url: docsUrl('no-value-in-untracked'),
    },
    schema: [],
    messages: {
      valueInUntracked:
        '`{{name}}.value` inside a `{{helper}}()` callback does not subscribe to `{{name}}`. Use `{{name}}.peek()` to make the untracked read explicit.',
      usePeek: 'Replace `{{name}}.value` with `{{name}}.peek()`.',
    },
  },

  create(context) {
    const { sourceCode } = context;
    return {
      'MemberExpression[computed=false][property.name="value"]'(node) {
        if (node.object.type !== 'Identifier' || isWriteTarget(node)) return;

        // Only reads made by the callback body itself, not by nested
        // functions (which may be effects or run later).
        const fn = sourceCode.getAncestors(node).findLast(isFunction);
        if (!fn) return;
        const helper = untrackedHelper(context, fn);
        if (!helper) return;

        // Skip the callback's own parameters and locals (e.g. `newValue`):
        // they hold plain values, not signals.
        const name = node.object.name;
        const variable = findVariable(sourceCode.getScope(node), name);
        if (!variable || variable.defs.length === 0) return;
        if (variable.defs.some((def) => isWithin(def.name, fn))) return;

        const data = { name, helper };
        context.report({
          node,
          messageId: 'valueInUntracked',
          data,
          suggest: [
            {
              messageId: 'usePeek',
              data,
              fix: (fixer) =>
                fixer.replaceTextRange(
                  [node.object.range[1], node.range[1]],
                  node.optional ? '?.peek()' : '.peek()'
                ),
            },
          ],
        });
      },
    };
  },
};

/**
 * `no-dynamic-trusted-html` — disallow `trusted()` and `unsafeHtml()` on
 * values that are not static strings.
 *
 * Both helpers mark HTML for verbatim insertion. `trusted()` expects markup
 * produced by `sanitizeHtml()` / `safeHtml`; `unsafeHtml()` (Storybook) skips
 * sanitisation entirely. A dynamic argument is an XSS vector unless it comes
 * straight from bQuery's sanitiser.
 *
 * @module @bquery/eslint-plugin/rules/no-dynamic-trusted-html
 */

import {
  PACKAGE_NAME,
  bquerySources,
  docsUrl,
  isStaticString,
  matchBQueryCall,
  resolveImported,
} from '../utils.js';

const SECURITY_SOURCES = bquerySources('security');
const COMPONENT_SOURCES = bquerySources('component');
const STORYBOOK_SOURCES = new Set([`${PACKAGE_NAME}/storybook`]);

const TRUSTED = new Set(['trusted']);
const UNSAFE_HTML = new Set(['unsafeHtml']);
/** Security helpers whose result is safe to splice verbatim. */
const SANITIZERS = new Set(['sanitizeHtml', 'sanitize', 'escapeHtml']);
/** Tagged templates whose result is already escaped or sanitised. */
const SAFE_TAGS = new Set(['safeHtml']);
const STORY_TAGS = new Set(['storyHtml', 'storySvg']);

/**
 * Unwrap TypeScript-only wrappers (`x as T`, `x!`, `x satisfies T`).
 *
 * @param {import('estree').Node} node - Expression
 * @returns {import('estree').Node} The wrapped runtime expression
 */
const unwrap = (node) => {
  let current = node;
  while (
    current.type === 'TSAsExpression' ||
    current.type === 'TSNonNullExpression' ||
    current.type === 'TSSatisfiesExpression' ||
    current.type === 'TSTypeAssertion'
  ) {
    current = current.expression;
  }
  return current;
};

/**
 * Whether an expression is produced directly by a bQuery sanitiser:
 * `sanitizeHtml(...)`, `sanitize(...)`, `escapeHtml(...)`, or a `safeHtml` /
 * `storyHtml` / `storySvg` tagged template.
 *
 * @param {import('eslint').Rule.RuleContext} context - Rule context
 * @param {import('estree').Node} node - Expression
 * @returns {boolean} True for sanitiser output
 */
const isSanitized = (context, node) => {
  const expression = unwrap(node);
  if (expression.type === 'CallExpression') {
    return Boolean(matchBQueryCall(context, expression, SECURITY_SOURCES, SANITIZERS));
  }
  if (expression.type === 'TaggedTemplateExpression') {
    const safe = resolveImported(context, expression.tag, COMPONENT_SOURCES);
    if (safe && SAFE_TAGS.has(safe.name)) return true;
    const story = resolveImported(context, expression.tag, STORYBOOK_SOURCES);
    return Boolean(story && STORY_TAGS.has(story.name));
  }
  return false;
};

/**
 * Find a local binding of `sanitizeHtml` / `sanitize` imported from bQuery.
 *
 * @param {import('eslint').Rule.RuleContext} context - Rule context
 * @returns {string | null} The local name, or `null` when none is imported
 */
const sanitizerLocalName = (context) => {
  for (const statement of context.sourceCode.ast.body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.importKind === 'type' ||
      !SECURITY_SOURCES.has(String(statement.source.value))
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type' &&
        specifier.imported.type === 'Identifier' &&
        (specifier.imported.name === 'sanitizeHtml' || specifier.imported.name === 'sanitize')
      ) {
        return specifier.local.name;
      }
    }
  }
  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description:
        'Disallow `trusted()` and `unsafeHtml()` on arguments that are not static strings or direct sanitizer output',
      recommended: true,
      url: docsUrl('no-dynamic-trusted-html'),
    },
    schema: [],
    messages: {
      dynamicTrusted:
        '`trusted()` marks HTML for verbatim insertion. Pass a static string or the direct result of `sanitizeHtml()` / `safeHtml`, not a dynamic value.',
      dynamicUnsafeHtml:
        '`unsafeHtml()` bypasses sanitization. Only pass static, author-controlled markup, not a dynamic value.',
      wrapInSanitizer: 'Wrap the argument in `{{sanitizer}}()`.',
      removeUnsafeHtml: 'Remove `unsafeHtml()` so `storyHtml` sanitizes the value.',
    },
  },

  create(context) {
    const { sourceCode } = context;
    return {
      CallExpression(node) {
        const isTrusted = Boolean(matchBQueryCall(context, node, SECURITY_SOURCES, TRUSTED));
        const isUnsafe =
          !isTrusted && matchBQueryCall(context, node, STORYBOOK_SOURCES, UNSAFE_HTML);
        if (!isTrusted && !isUnsafe) return;

        const [argument] = node.arguments;
        if (!argument) return;
        if (argument.type !== 'SpreadElement') {
          if (isStaticString(context, argument)) return;
          if (isSanitized(context, argument)) return;
        }

        const suggest = [];
        if (argument.type === 'SpreadElement') {
          // No safe rewrite for spread arguments.
        } else if (isTrusted) {
          const sanitizer = sanitizerLocalName(context);
          if (sanitizer) {
            const text = sourceCode.getText(argument);
            const wrapped = argument.type === 'SequenceExpression' ? `(${text})` : text;
            suggest.push({
              messageId: 'wrapInSanitizer',
              data: { sanitizer },
              fix: (fixer) => fixer.replaceText(argument, `${sanitizer}(${wrapped})`),
            });
          }
        } else if (
          // `${unsafeHtml(value)}` inside a template → `${value}`, which
          // storyHtml sanitizes like any other interpolation.
          node.parent.type === 'TemplateLiteral' &&
          node.arguments.length === 1 &&
          sourceCode.getCommentsInside(node).length === 0
        ) {
          suggest.push({
            messageId: 'removeUnsafeHtml',
            fix: (fixer) => fixer.replaceText(node, sourceCode.getText(argument)),
          });
        }

        context.report({
          node: argument,
          messageId: isTrusted ? 'dynamicTrusted' : 'dynamicUnsafeHtml',
          suggest,
        });
      },
    };
  },
};

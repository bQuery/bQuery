/**
 * Template walker for the optional view compiler.
 *
 * Discovers every `bq-*` directive expression that reaches the runtime
 * evaluator and compiles each one ahead of time. The walker mirrors each
 * directive's evaluation strategy exactly — object syntax for
 * `bq-class`/`bq-style`/`bq-aria` is split through the same
 * `parseObjectExpression()` the runtime uses, and `bq-for` contributes its list
 * and `:key` sub-expressions — so the compiled set is a faithful subset of what
 * the runtime would evaluate.
 *
 * @module bquery/view/compiler
 */

import { parseTemplate, type SSRNode } from '../../ssr/html-parser';
import { parseObjectExpression } from '../evaluate';
import { parseDirective } from '../parse-directive';
import { compileExpression } from './expression';
import type { CompiledView, CompileOptions, DirectiveExpression } from './types';

/** Directives whose entire attribute value is one expression for the evaluator. */
const WHOLE_VALUE_DIRECTIVES = new Set([
  'text',
  'html',
  'html-safe',
  'if',
  'show',
  'bind',
  'error',
  'once',
  'init',
  'memo',
  'model',
  'ref',
  'on',
]);

/** Directives that accept object syntax (`{ key: expr }`) or a whole expression. */
const OBJECT_OR_WHOLE_DIRECTIVES = new Set(['class', 'style', 'aria']);

/** `bq-for` list-expression matcher (kept in sync with `directives/for.ts`). */
const FOR_RE = /^\(?(\w+)(?:\s*,\s*(\w+))?\)?\s+in\s+(\S.*)$/;

/**
 * Collects directive expressions from a single element's attributes, appending
 * to `found`.
 */
const collectFromElement = (
  tag: string,
  attributes: Record<string, string>,
  attributeOrder: string[],
  prefix: string,
  found: DirectiveExpression[]
): void => {
  const head = `${prefix}-`;
  for (const attrName of attributeOrder) {
    if (!attrName.startsWith(head)) continue;
    const { directive } = parseDirective(attrName.slice(head.length));
    const value = attributes[attrName] ?? '';

    if (directive === 'for') {
      const match = value.match(FOR_RE);
      if (match) {
        found.push({ tag, directive, expression: match[3] });
      }
      const keyExpr = attributes[':key'] ?? attributes[`${prefix}-key`];
      if (keyExpr) {
        found.push({ tag, directive: 'key', expression: keyExpr });
      }
      continue;
    }

    if (OBJECT_OR_WHOLE_DIRECTIVES.has(directive)) {
      if (value.trimStart().startsWith('{')) {
        const map = parseObjectExpression(value);
        for (const valueExpr of Object.values(map)) {
          found.push({ tag, directive, expression: valueExpr });
        }
      } else if (value.trim() !== '') {
        found.push({ tag, directive, expression: value });
      }
      continue;
    }

    if (WHOLE_VALUE_DIRECTIVES.has(directive) && value.trim() !== '') {
      found.push({ tag, directive, expression: value });
    }
  }
};

/** Recursively walks a parsed node tree, collecting directive expressions. */
const walk = (node: SSRNode, prefix: string, found: DirectiveExpression[]): void => {
  if (node.type === 'element') {
    collectFromElement(node.tag, node.attributes, node.attributeOrder, prefix, found);
    for (const child of node.children) walk(child, prefix, found);
  } else if (node.type === 'fragment') {
    for (const child of node.children) walk(child, prefix, found);
  }
};

/**
 * Compiles every `bq-*` expression in an HTML template ahead of time.
 *
 * Returns the compiled subset (expression → emitted function source) plus
 * coverage statistics. Expressions that cannot be statically compiled are
 * listed in `stats.skipped` with a reason and transparently fall back to the
 * runtime evaluator — so a partially compiled template still behaves
 * identically.
 *
 * @example
 * ```ts
 * import { compileViews } from '@bquery/bquery/view/compiler';
 *
 * const { expressions, stats } = compileViews('<p bq-text="count + 1"></p>');
 * // expressions['count + 1'] === '(__bq_ctx) => (__bq_ctx.count + 1)'
 * ```
 */
export const compileViews = (template: string, options: CompileOptions = {}): CompiledView => {
  const prefix = options.prefix ?? 'bq';
  const fragment = parseTemplate(template);

  const found: DirectiveExpression[] = [];
  walk(fragment, prefix, found);

  const expressions: Record<string, string> = {};
  const skipped: Array<{ expression: string; reason: string }> = [];
  const seen = new Set<string>();
  let total = 0;

  for (const { expression } of found) {
    if (seen.has(expression)) continue;
    seen.add(expression);
    total++;

    const result = compileExpression(expression, { globals: options.globals });
    if (result.ok) {
      expressions[expression] = result.code;
    } else {
      skipped.push({ expression, reason: result.reason });
    }
  }

  return {
    expressions,
    stats: { total, compiled: Object.keys(expressions).length, skipped },
  };
};

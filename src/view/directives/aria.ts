import { effect } from '../../reactive/index';
import { isPrototypePollutionKey } from '../../core/utils/object';
import { evaluate, parseObjectExpressionCached } from '../evaluate';
import type { DirectiveHandler } from '../types';

const toKebabCase = (value: string): string => value.replace(/([A-Z])/g, '-$1').toLowerCase();

const normalizeAriaAttribute = (name: string): string => {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('aria-')) {
    return lower;
  }

  const withoutPrefix = /^aria[A-Z]/.test(trimmed) ? trimmed.slice(4) : trimmed;
  return `aria-${toKebabCase(withoutPrefix).replace(/^-/, '')}`;
};

const shouldRemoveAttribute = (value: unknown): boolean => value == null || value === '';

/**
 * Handles bq-aria directive - reactive ARIA attribute binding.
 * @internal
 */
export const handleAria: DirectiveHandler = (el, expression, context, cleanups) => {
  let appliedAttributes: Set<string> = new Set();

  // Static object syntax: parse once at bind time and pre-normalize the
  // attribute names — only the value expressions vary per update.
  const ariaEntries = expression.trimStart().startsWith('{')
    ? Object.entries(parseObjectExpressionCached(expression)).map(
        ([attrName, valueExpr]): [string, string] => [normalizeAriaAttribute(attrName), valueExpr]
      )
    : null;

  const applyAria = (normalizedName: string, value: unknown, newAttributes: Set<string>): void => {
    if (shouldRemoveAttribute(value)) {
      el.removeAttribute(normalizedName);
      return;
    }

    el.setAttribute(normalizedName, value === true ? 'true' : String(value));
    newAttributes.add(normalizedName);
  };

  const cleanup = effect(() => {
    const newAttributes = new Set<string>();

    if (ariaEntries) {
      for (const [normalizedName, valueExpr] of ariaEntries) {
        applyAria(normalizedName, evaluate(valueExpr, context), newAttributes);
      }
    } else {
      const result = evaluate<Record<string, unknown>>(expression, context);
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        for (const [attrName, value] of Object.entries(result)) {
          if (isPrototypePollutionKey(attrName)) {
            continue;
          }

          applyAria(normalizeAriaAttribute(attrName), value, newAttributes);
        }
      }
    }

    for (const attrName of appliedAttributes) {
      if (!newAttributes.has(attrName)) {
        el.removeAttribute(attrName);
      }
    }

    appliedAttributes = newAttributes;
  });

  cleanups.push(cleanup);
};

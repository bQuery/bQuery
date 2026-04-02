import { effect } from '../../reactive/index';
import { isPrototypePollutionKey } from '../../core/utils/object';
import { evaluate, parseObjectExpression } from '../evaluate';
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

  const cleanup = effect(() => {
    const newAttributes = new Set<string>();
    const ariaValues = Object.create(null) as Record<string, unknown>;

    if (expression.trimStart().startsWith('{')) {
      const ariaMap = parseObjectExpression(expression);
      for (const [attrName, valueExpr] of Object.entries(ariaMap)) {
        ariaValues[attrName] = evaluate(valueExpr, context);
      }
    } else {
      const result = evaluate<Record<string, unknown>>(expression, context);
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        for (const [attrName, value] of Object.entries(result)) {
          if (isPrototypePollutionKey(attrName)) {
            continue;
          }

          ariaValues[attrName] = value;
        }
      }
    }

    for (const [attrName, value] of Object.entries(ariaValues)) {
      const normalizedName = normalizeAriaAttribute(attrName);
      if (shouldRemoveAttribute(value)) {
        el.removeAttribute(normalizedName);
        continue;
      }

      el.setAttribute(normalizedName, value === true ? 'true' : String(value));
      newAttributes.add(normalizedName);
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

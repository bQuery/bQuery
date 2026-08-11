import { effect } from '../../reactive/index';
import { evaluate, parseObjectExpressionCached } from '../evaluate';
import type { DirectiveHandler } from '../types';

const toKebabCase = (prop: string): string => prop.replace(/([A-Z])/g, '-$1').toLowerCase();

/**
 * Handles bq-style directive - dynamic style binding.
 * @internal
 */
export const handleStyle: DirectiveHandler = (el, expression, context, cleanups) => {
  const htmlEl = el as HTMLElement;
  let appliedStyles: Set<string> = new Set();

  // Static object syntax is parsed once at bind time, with property names
  // already kebab-cased — only the value expressions vary per update.
  const styleEntries = expression.trimStart().startsWith('{')
    ? Object.entries(parseObjectExpressionCached(expression)).map(
        ([prop, valueExpr]): [string, string] => [toKebabCase(prop), valueExpr]
      )
    : null;

  const cleanup = effect(() => {
    const newStyles = new Set<string>();

    if (styleEntries) {
      for (const [cssProp, valueExpr] of styleEntries) {
        const value = evaluate<string>(valueExpr, context);
        htmlEl.style.setProperty(cssProp, String(value ?? ''));
        newStyles.add(cssProp);
      }
    } else {
      const result = evaluate<Record<string, string>>(expression, context);
      if (result && typeof result === 'object') {
        for (const [prop, value] of Object.entries(result)) {
          const cssProp = toKebabCase(prop);
          htmlEl.style.setProperty(cssProp, String(value ?? ''));
          newStyles.add(cssProp);
        }
      }
    }

    // Remove styles that were previously applied but are no longer present
    for (const cssProp of appliedStyles) {
      if (!newStyles.has(cssProp)) {
        htmlEl.style.removeProperty(cssProp);
      }
    }

    // Update the set of applied styles
    appliedStyles = newStyles;
  });

  cleanups.push(cleanup);
};

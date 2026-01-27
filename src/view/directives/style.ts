import { effect } from '../../reactive/index';
import { evaluate, parseObjectExpression } from '../evaluate';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-style directive - dynamic style binding.
 * @internal
 */
export const handleStyle: DirectiveHandler = (el, expression, context, cleanups) => {
  const htmlEl = el as HTMLElement;
  let appliedStyles: Set<string> = new Set();

  const cleanup = effect(() => {
    const newStyles = new Set<string>();

    if (expression.trimStart().startsWith('{')) {
      const styleMap = parseObjectExpression(expression);
      for (const [prop, valueExpr] of Object.entries(styleMap)) {
        const value = evaluate<string>(valueExpr, context);
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        htmlEl.style.setProperty(cssProp, String(value ?? ''));
        newStyles.add(cssProp);
      }
    } else {
      const result = evaluate<Record<string, string>>(expression, context);
      if (result && typeof result === 'object') {
        for (const [prop, value] of Object.entries(result)) {
          const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
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

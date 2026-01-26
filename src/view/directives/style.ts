import { effect } from '../../reactive/index';
import { evaluate, parseObjectExpression } from '../evaluate';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-style directive - dynamic style binding.
 * @internal
 */
export const handleStyle: DirectiveHandler = (el, expression, context, cleanups) => {
  const htmlEl = el as HTMLElement;
  const appliedStyles = new Set<string>();

  const cleanup = effect(() => {
    const newStyles = new Set<string>();

    if (expression.startsWith('{')) {
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
    appliedStyles.clear();
    newStyles.forEach((prop) => appliedStyles.add(prop));
  });

  cleanups.push(cleanup);
};

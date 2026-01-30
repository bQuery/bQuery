import { effect } from '../../reactive/index';
import { evaluate, parseObjectExpression } from '../evaluate';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-class directive - dynamic class binding.
 * Tracks previously added classes to ensure proper cleanup when expressions change.
 * @internal
 */
export const handleClass: DirectiveHandler = (el, expression, context, cleanups) => {
  // Track classes added by this directive to clean them up on re-evaluation
  let previousClasses: Set<string> = new Set();

  const cleanup = effect(() => {
    const newClasses: Set<string> = new Set();

    if (expression.trimStart().startsWith('{')) {
      // Object syntax: { active: isActive, disabled: !enabled }
      const classMap = parseObjectExpression(expression);
      for (const [className, conditionExpr] of Object.entries(classMap)) {
        const condition = evaluate<boolean>(conditionExpr, context);
        el.classList.toggle(className, Boolean(condition));
        // Track class regardless of condition - toggle handles add/remove
        newClasses.add(className);
      }
    } else if (/^\s*\[/.test(expression)) {
      // Array literal syntax: [class1, class2]
      const classes = evaluate<string[]>(expression, context);
      if (Array.isArray(classes)) {
        for (const cls of classes) {
          if (cls) {
            el.classList.add(cls);
            newClasses.add(cls);
          }
        }
      }
    } else {
      // Single expression returning string or array
      const result = evaluate<string | string[]>(expression, context);
      if (typeof result === 'string') {
        result.split(/\s+/).forEach((cls) => {
          if (cls) {
            el.classList.add(cls);
            newClasses.add(cls);
          }
        });
      } else if (Array.isArray(result)) {
        result.forEach((cls) => {
          if (cls) {
            el.classList.add(cls);
            newClasses.add(cls);
          }
        });
      }
    }

    // Remove classes that were previously added but are no longer in the new set
    // This keeps directive-managed classes in sync across all syntax forms and provides
    // defensive cleanup behavior for edge cases (e.g. external classList changes)
    for (const cls of previousClasses) {
      if (!newClasses.has(cls)) {
        el.classList.remove(cls);
      }
    }

    previousClasses = newClasses;
  });

  cleanups.push(cleanup);
};

import { evaluateRaw } from '../evaluate';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-on:event directive - event binding.
 * @internal
 */
export const handleOn = (eventName: string): DirectiveHandler => {
  return (el, expression, context, cleanups) => {
    const handler = (event: Event) => {
      // Add $event to context for expression evaluation
      const eventContext = { ...context, $event: event, $el: el };

      // Check if expression contains a function call (has parentheses)
      // If not, it might be a function reference like "handleClick", "handlers.onClick", or "this.onClick"
      const containsCall = expression.includes('(');

      if (!containsCall) {
        // Evaluate the expression - if it returns a function, invoke it with $event
        const result = evaluateRaw<unknown>(expression, eventContext);
        if (typeof result === 'function') {
          result(event);
          return;
        }
        // If not a function, the expression was already evaluated (e.g., "count.value++")
        return;
      }

      // Otherwise evaluate as expression using evaluateRaw to allow signal mutations
      // (e.g., "count.value++" or "handleClick($event)")
      evaluateRaw(expression, eventContext);
    };

    el.addEventListener(eventName, handler);
    cleanups.push(() => el.removeEventListener(eventName, handler));
  };
};

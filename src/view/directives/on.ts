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

      // Check if expression is just a function reference (no parentheses)
      // In that case, we should call it directly
      const isPlainFunctionRef = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expression.trim());

      if (isPlainFunctionRef) {
        // Get the function and call it with the event
        const fn = evaluateRaw<unknown>(expression, eventContext);
        if (typeof fn === 'function') {
          fn(event);
          return;
        }
      }

      // Otherwise evaluate as expression using evaluateRaw to allow signal mutations
      // (e.g., "count.value++" or "handleClick($event)")
      evaluateRaw(expression, eventContext);
    };

    el.addEventListener(eventName, handler);
    cleanups.push(() => el.removeEventListener(eventName, handler));
  };
};

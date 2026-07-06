import { runOnExpression } from './on-shared';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-on:event directive - event binding.
 * @internal
 */
export const handleOn = (eventName: string): DirectiveHandler => {
  return (el, expression, context, cleanups) => {
    const handler = (event: Event) => {
      runOnExpression(expression, { ...context, $event: event, $el: el }, event);
    };

    el.addEventListener(eventName, handler);
    cleanups.push(() => el.removeEventListener(eventName, handler));
  };
};

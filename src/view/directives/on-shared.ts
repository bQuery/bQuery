import { evaluateRaw } from '../evaluate';
import type { BindingContext } from '../types';

/**
 * Evaluates a `bq-on` handler expression and, if it resolves to a function,
 * invokes it with the event.
 *
 * Rather than guessing "bare reference vs. call" by string-scanning for `(`
 * (which misfires on expressions like `items.find(x => x).handler` — a paren
 * that is not the top-level call, causing the returned handler to never run),
 * the expression is always evaluated. A function result is invoked with the
 * event (so a bare `handler` or a resolved-to-function member chain fires);
 * any other result means the expression itself was the side effect (e.g.
 * `count.value++` or `handleClick($event)`).
 *
 * Note: `this` is unbound for a function resolved from a member chain — use an
 * explicit call (`obj.method($event)`) when the receiver matters.
 * @internal
 */
export const runOnExpression = (
  expression: string,
  eventContext: BindingContext,
  event: Event
): void => {
  const result = evaluateRaw<unknown>(expression, eventContext);
  if (typeof result === 'function') {
    (result as (e: Event) => void)(event);
  }
};

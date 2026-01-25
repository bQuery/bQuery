import { isSignal, type Signal } from '../../reactive/index';
import { evaluateRaw } from '../evaluate';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-ref directive - element reference.
 * @internal
 */
export const handleRef: DirectiveHandler = (el, expression, context, cleanups) => {
  const rawValue = evaluateRaw<Signal<Element | null>>(expression, context);

  if (isSignal(rawValue)) {
    (rawValue as Signal<Element | null>).value = el;
    cleanups.push(() => {
      (rawValue as Signal<Element | null>).value = null;
    });
  } else if (typeof context[expression] === 'object' && context[expression] !== null) {
    // Object with .value property
    (context[expression] as { value: Element | null }).value = el;
    cleanups.push(() => {
      (context[expression] as { value: Element | null }).value = null;
    });
  }
};

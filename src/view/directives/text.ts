import { effect } from '../../reactive/index';
import { evaluate } from '../evaluate';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-text directive - sets text content.
 * @internal
 */
export const handleText: DirectiveHandler = (el, expression, context, cleanups) => {
  const cleanup = effect(() => {
    const value = evaluate(expression, context);
    const next = String(value ?? '');
    // Assigning textContent replaces the text node even for equal strings —
    // skip the write when nothing changed.
    if (el.textContent !== next) {
      el.textContent = next;
    }
  });
  cleanups.push(cleanup);
};

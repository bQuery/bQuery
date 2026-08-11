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
    // Assigning textContent rebuilds the child list even for an equal string —
    // skip the write only when the element already *is* exactly that single
    // text node. Comparing `el.textContent` alone would also match markup whose
    // concatenated text happens to be equal (server-rendered `<b>Hel</b>lo`),
    // leaving those children in place instead of flattening them.
    const firstChild = el.firstChild;
    const isPlainText =
      firstChild === null
        ? next === ''
        : firstChild === el.lastChild &&
          firstChild.nodeType === 3 /* TEXT_NODE */ &&
          firstChild.nodeValue === next;
    if (!isPlainText) {
      el.textContent = next;
    }
  });
  cleanups.push(cleanup);
};

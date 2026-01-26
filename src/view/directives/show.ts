import { effect } from '../../reactive/index';
import { evaluate } from '../evaluate';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-show directive - toggle visibility.
 * @internal
 */
export const handleShow: DirectiveHandler = (el, expression, context, cleanups) => {
  const htmlEl = el as HTMLElement;
  // Capture the computed display value to properly restore visibility.
  // If inline display is 'none' or empty, we need to use the computed value.
  let originalDisplay = htmlEl.style.display;
  if (!originalDisplay || originalDisplay === 'none') {
    const computed = window.getComputedStyle(htmlEl).display;
    originalDisplay = computed !== 'none' ? computed : '';
  }

  const cleanup = effect(() => {
    const condition = evaluate<boolean>(expression, context);
    htmlEl.style.display = condition ? originalDisplay : 'none';
  });

  cleanups.push(cleanup);
};

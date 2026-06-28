import { effect } from '../../reactive/index';
import { evaluate } from '../evaluate';
import type { DirectiveHandler } from '../types';
import { cancelTransitions, resolveTransition, runTransition } from './transitions';

/**
 * Creates a `bq-show` handler bound to a directive prefix.
 *
 * Toggles visibility via CSS `display`. When the element carries transition
 * attributes, the show transition animates in (after restoring `display`) and
 * the hide transition animates out before `display: none` is committed. The
 * commit re-checks the live condition so rapid toggles do not hide an element
 * that has since become visible again.
 *
 * @internal
 */
export const createShowHandler = (prefix = 'bq'): DirectiveHandler => {
  return (el, expression, context, cleanups) => {
    const htmlEl = el as HTMLElement;
    // Capture the computed display value to properly restore visibility.
    // If inline display is 'none' or empty, we need to use the computed value.
    // Use ownerDocument.defaultView for cross-document/iframe compatibility.
    let originalDisplay = htmlEl.style.display;
    if (!originalDisplay || originalDisplay === 'none') {
      const computed = htmlEl.ownerDocument.defaultView?.getComputedStyle(htmlEl).display ?? '';
      originalDisplay = computed !== 'none' ? computed : '';
    }

    let first = true;
    let token = 0;

    const cleanup = effect(() => {
      const condition = evaluate<boolean>(expression, context);
      const config = resolveTransition(el, prefix);

      // No transition, or the initial paint: apply display synchronously.
      if (!config || first) {
        htmlEl.style.display = condition ? originalDisplay : 'none';
        first = false;
        return;
      }

      if (condition) {
        token++;
        htmlEl.style.display = originalDisplay;
        cancelTransitions(el);
        void runTransition(el, config.enter, config, 'none');
      } else {
        const myToken = ++token;
        if (config.leave) {
          // Clear any in-flight leave before starting a new one so repeated
          // falsy re-evaluations don't stack forwards-filled animations.
          cancelTransitions(el);
          void runTransition(el, config.leave, config, 'forwards').then(() => {
            // Only commit the hide if this is still the latest transition and
            // the condition is still falsy.
            if (myToken !== token) return;
            if (!evaluate<boolean>(expression, context)) {
              htmlEl.style.display = 'none';
              cancelTransitions(el);
            }
          });
        } else {
          htmlEl.style.display = 'none';
        }
      }
    });

    cleanups.push(cleanup);
  };
};

/**
 * Handles bq-show directive - toggle visibility (default `bq` prefix).
 * @internal
 */
export const handleShow: DirectiveHandler = createShowHandler();

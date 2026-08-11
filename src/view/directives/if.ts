import { effect } from '../../reactive/index';
import { evaluate } from '../evaluate';
import type { DirectiveHandler } from '../types';
import { cancelTransitions, resolveTransition, runTransition } from './transitions';

/**
 * Creates a `bq-if` handler bound to a directive prefix.
 *
 * Conditional rendering: the element is swapped with a placeholder comment when
 * the condition is falsy and re-inserted when it becomes truthy. When the
 * element also carries transition attributes (`bq-transition` / `bq-in` /
 * `bq-out`), an enter animation plays on insert and a leave animation plays
 * before removal. Rapid toggles are race-safe: a pending leave is superseded by
 * a later enter via a monotonic token, and the still-mounted element animates
 * back in instead of being removed.
 *
 * @internal
 */
export const createIfHandler = (prefix = 'bq'): DirectiveHandler => {
  return (el, expression, context, cleanups) => {
    const placeholder = document.createComment(`bq-if: ${expression}`);

    // The transition attributes are static — resolve once at bind time instead
    // of re-reading and re-parsing them on every reactive update.
    const config = resolveTransition(el, prefix);

    let isInserted = true;
    // Skip enter/leave animations on the very first evaluation so initial paint
    // is not animated (parity with Vue/Svelte, which do not animate on mount
    // unless an explicit appear transition is requested).
    let first = true;
    // Previous truthiness of the condition, used to act only on a real flip.
    let prevShown = false;
    // Monotonic token identifying the latest state transition. A deferred leave
    // only commits its removal when its token is still current.
    let token = 0;

    const cleanup = effect(() => {
      const shown = Boolean(evaluate<boolean>(expression, context));

      // The effect also re-runs when unrelated dependencies of the expression
      // change. Only react to an actual flip, otherwise the enter would replay
      // while inserted and the leave would restart (never committing removal)
      // while the condition stays falsy.
      if (!first && shown === prevShown) return;
      const isFirst = first;
      first = false;
      prevShown = shown;

      if (shown) {
        // Bump the token so any pending leave is superseded and won't remove
        // the element after it has been re-shown.
        token++;
        if (!isInserted) {
          // Insert element using replaceWith to handle moved elements
          placeholder.replaceWith(el);
          isInserted = true;
        }
        // Clear any leftover forwards-fill from an interrupted leave so the
        // element is visible again before the enter animation runs.
        cancelTransitions(el);
        if (config && !isFirst) {
          void runTransition(el, config.enter, config, 'none');
        }
      } else if (isInserted) {
        const myToken = ++token;
        if (config && config.leave && !isFirst) {
          // Clear any in-flight leave before starting a new one so repeated
          // falsy re-evaluations don't stack forwards-filled animations.
          cancelTransitions(el);
          void runTransition(el, config.leave, config, 'forwards').then(() => {
            // Superseded by a later enter/leave — leave the element alone.
            if (myToken !== token) return;
            el.replaceWith(placeholder);
            isInserted = false;
            cancelTransitions(el);
          });
        } else {
          // Remove element using replaceWith to handle moved elements
          el.replaceWith(placeholder);
          isInserted = false;
        }
      }
    });

    cleanups.push(cleanup);
  };
};

/**
 * Handles bq-if directive - conditional rendering (default `bq` prefix).
 * @internal
 */
export const handleIf: DirectiveHandler = createIfHandler();

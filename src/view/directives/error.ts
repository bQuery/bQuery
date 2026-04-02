import { effect, isComputed, isSignal } from '../../reactive/index';
import { evaluateRaw } from '../evaluate';
import type { DirectiveHandler } from '../types';

type ErrorSource =
  | {
      error?: unknown;
    }
  | unknown;

const getErrorMessage = (source: ErrorSource): string => {
  if (isSignal(source) || isComputed(source)) {
    return String(source.value ?? '');
  }

  if (source && typeof source === 'object' && 'error' in source) {
    const errorValue = source.error;
    if (isSignal(errorValue) || isComputed(errorValue)) {
      return String(errorValue.value ?? '');
    }
    return String(errorValue ?? '');
  }

  return String(source ?? '');
};

/**
 * Handles bq-error directive - renders error messages and toggles visibility.
 * @internal
 */
export const handleError: DirectiveHandler = (el, expression, context, cleanups) => {
  const htmlEl = el as HTMLElement;
  const shouldManageAriaHidden = !htmlEl.hasAttribute('aria-hidden');

  if (!htmlEl.hasAttribute('role')) {
    htmlEl.setAttribute('role', 'alert');
  }

  if (!htmlEl.hasAttribute('aria-live')) {
    htmlEl.setAttribute('aria-live', 'assertive');
  }

  const cleanup = effect(() => {
    const source = evaluateRaw(expression, context);
    const message = getErrorMessage(source).trim();
    const hasMessage = message.length > 0;

    htmlEl.textContent = message;
    htmlEl.hidden = !hasMessage;
    if (shouldManageAriaHidden) {
      if (hasMessage) {
        htmlEl.removeAttribute('aria-hidden');
      } else {
        htmlEl.setAttribute('aria-hidden', 'true');
      }
    }
  });

  cleanups.push(cleanup);
};

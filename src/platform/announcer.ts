/**
 * Accessibility live-region announcer helpers.
 *
 * @module bquery/platform
 */

import { effect, signal, type Signal } from '../reactive/signal';
import { getBqueryConfig } from './config';

/** Options for creating an announcer. */
export interface UseAnnouncerOptions {
  /** Live region politeness. */
  politeness?: 'polite' | 'assertive';
  /** Whether the live region should be atomic. */
  atomic?: boolean;
  /** Delay before applying the message. */
  delay?: number;
  /** Delay after which the message is cleared automatically. */
  clearDelay?: number;
  /** Optional element id for the live region. */
  id?: string;
  /** Optional CSS class name. */
  className?: string;
  /** Optional container used to append the live region. */
  container?: HTMLElement;
}

/** Runtime options for a single announcement. */
export interface AnnounceOptions {
  /** Override politeness for this specific announcement. */
  politeness?: 'polite' | 'assertive';
  /** Override the message delay for this specific announcement. */
  delay?: number;
  /** Override the auto-clear delay for this specific announcement. */
  clearDelay?: number;
}

/** Returned announcer API. */
export interface AnnouncerHandle {
  /** The live region element or null outside the DOM. */
  element: HTMLElement | null;
  /** Reactive message signal. */
  message: Signal<string>;
  /** Announce a message to assistive technologies. */
  announce: (value: string, options?: AnnounceOptions) => void;
  /** Clear the current announcement. */
  clear: () => void;
  /** Remove the live region if it was created by this announcer. */
  destroy: () => void;
}

const visuallyHiddenStyle = [
  'position:absolute',
  'width:1px',
  'height:1px',
  'padding:0',
  'margin:-1px',
  'overflow:hidden',
  'clip:rect(0, 0, 0, 0)',
  'white-space:nowrap',
  'border:0',
].join(';');

/**
 * Create or reuse an accessible live region.
 *
 * @param options - Live region configuration
 * @returns An announcer handle with announce(), clear(), and destroy()
 *
 * @example
 * ```ts
 * const announcer = useAnnouncer();
 * announcer.announce('Saved successfully');
 * ```
 */
export const useAnnouncer = (options: UseAnnouncerOptions = {}): AnnouncerHandle => {
  const defaults = getBqueryConfig().announcer;
  const resolvedOptions: Required<
    Pick<UseAnnouncerOptions, 'politeness' | 'atomic' | 'delay' | 'clearDelay'>
  > &
    UseAnnouncerOptions = {
    politeness: defaults?.politeness ?? 'polite',
    atomic: defaults?.atomic ?? true,
    delay: defaults?.delay ?? 16,
    clearDelay: defaults?.clearDelay ?? 1000,
    ...options,
  };

  const message = signal('');

  if (typeof document === 'undefined') {
    return {
      element: null,
      message,
      announce(value: string) {
        message.value = value;
      },
      clear() {
        message.value = '';
      },
      destroy() {
        message.value = '';
      },
    };
  }

  const existing = resolvedOptions.id ? document.getElementById(resolvedOptions.id) : null;
  const element = (existing ?? document.createElement('div')) as HTMLElement;
  const created = !existing;

  if (resolvedOptions.id) {
    element.id = resolvedOptions.id;
  }

  if (resolvedOptions.className) {
    element.className = resolvedOptions.className;
  }

  element.setAttribute('aria-live', resolvedOptions.politeness);
  element.setAttribute('aria-atomic', String(resolvedOptions.atomic));
  element.setAttribute('role', resolvedOptions.politeness === 'assertive' ? 'alert' : 'status');
  element.setAttribute('data-bquery-announcer', 'true');
  if (!element.getAttribute('style')) {
    element.setAttribute('style', visuallyHiddenStyle);
  }

  if (created) {
    const parent = resolvedOptions.container ?? document.body ?? document.documentElement;
    if (!parent) {
      return {
        element: null,
        message,
        announce(value: string) {
          message.value = value;
        },
        clear() {
          message.value = '';
        },
        destroy() {
          message.value = '';
        },
      };
    }
    parent.appendChild(element);
  }

  const disposeMessageEffect = effect(() => {
    element.textContent = message.value;
  });

  let messageTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;

  const clearTimers = (): void => {
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = undefined;
    }
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = undefined;
    }
  };

  const clear = (): void => {
    if (destroyed) return;
    clearTimers();
    message.value = '';
  };

  const announce = (value: string, announceOptions: AnnounceOptions = {}): void => {
    if (destroyed) return;
    const politeness = announceOptions.politeness ?? resolvedOptions.politeness;
    const delay = announceOptions.delay ?? resolvedOptions.delay;
    const clearDelay = announceOptions.clearDelay ?? resolvedOptions.clearDelay;

    clearTimers();

    element.setAttribute('aria-live', politeness);
    element.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
    message.value = '';

    messageTimer = setTimeout(() => {
      if (destroyed) return;
      message.value = value;
      if (clearDelay > 0) {
        clearTimer = setTimeout(() => {
          if (destroyed) return;
          message.value = '';
        }, clearDelay);
      }
    }, delay);
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    clearTimers();
    message.value = '';
    disposeMessageEffect();
    if (created) {
      element.remove();
    }
  };

  return { element, message, announce, clear, destroy };
};

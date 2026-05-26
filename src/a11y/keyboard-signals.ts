/**
 * Reactive `keyboardUser` and `focusVisible` signals.
 *
 * - `keyboardUser` flips to `true` on the first keyboard interaction and
 *   back to `false` on the next pointer interaction.
 * - `focusVisible` mirrors `:focus-visible` semantics — `true` while the
 *   currently focused element should receive a focus ring.
 *
 * Both signals share a single set of global listeners. Subsequent calls
 * return signals that share the same underlying state, so calling them
 * many times is cheap.
 *
 * @module bquery/a11y
 * @since 1.14.0
 */

import { readonly, signal, type ReadonlySignal } from '../reactive/index';

let initialized = false;
const keyboardUserSig = signal(false);
const focusVisibleSig = signal(false);
let unlisten: (() => void) | null = null;

const init = (): void => {
  if (initialized) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  const onKeyDown = (event: KeyboardEvent): void => {
    // Modifier-only keys still count as keyboard input intent.
    keyboardUserSig.value = true;
    if (document.activeElement && document.activeElement !== document.body) {
      focusVisibleSig.value = true;
    }
    // Tab/Shift-Tab is the canonical focus shifter; refresh visibility.
    if (event.key === 'Tab') {
      focusVisibleSig.value = true;
    }
  };

  const onPointerDown = (): void => {
    keyboardUserSig.value = false;
    focusVisibleSig.value = false;
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target as Element | null;
    if (!target) return;
    // When keyboard modality is active, text-entry targets should retain the
    // visible focus ring just like any other focused element.
    const tag = target.tagName;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      (target as HTMLElement).isContentEditable
    ) {
      focusVisibleSig.value = true;
      return;
    }
    if (!keyboardUserSig.peek()) {
      focusVisibleSig.value = false;
      return;
    }
    focusVisibleSig.value = true;
  };

  const onFocusOut = (): void => {
    focusVisibleSig.value = false;
  };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('mousedown', onPointerDown, true);
  window.addEventListener('touchstart', onPointerDown, { capture: true, passive: true });
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);

  unlisten = () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('mousedown', onPointerDown, true);
    window.removeEventListener('touchstart', onPointerDown, true);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focusout', onFocusOut, true);
    initialized = false;
  };
};

/**
 * Reactive signal that flips to `true` after the first keyboard input and
 * back to `false` after the next pointer interaction. Useful for styling
 * focus rings only when the user is navigating with the keyboard.
 *
 * @since 1.14.0
 */
export const keyboardUserSignal = (): ReadonlySignal<boolean> => {
  init();
  return readonly(keyboardUserSig);
};

/**
 * Reactive signal mirroring `:focus-visible` semantics — `true` while the
 * currently focused element should display a focus ring.
 *
 * @since 1.14.0
 */
export const focusVisible = (): ReadonlySignal<boolean> => {
  init();
  return readonly(focusVisibleSig);
};

/**
 * **Internal** — releases the global listeners used by
 * {@link keyboardUserSignal} and {@link focusVisible}. Exposed primarily
 * for tests.
 *
 * @internal
 * @since 1.14.0
 */
export const _disposeKeyboardSignals = (): void => {
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
  keyboardUserSig.value = false;
  focusVisibleSig.value = false;
};

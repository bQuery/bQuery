/**
 * DOM helpers for inert siblings, scroll-locking the body, and reliable
 * mount-time autofocus.
 *
 * @module bquery/a11y
 * @since 1.14.0
 */

/**
 * Handle returned by {@link inert} and {@link scrollLock}.
 *
 * @since 1.14.0
 */
export type DisposableHandle = {
  /** Releases the effect, restoring previous DOM state. */
  release: () => void;
};

/**
 * Marks every sibling of `target` as `inert` and `aria-hidden`, hiding the
 * surrounding UI from assistive technologies and pointer/keyboard input while
 * a modal-like overlay is active. The previous values of those attributes are
 * restored when the handle's `release()` is called.
 *
 * Works against the immediate siblings within `target.parentElement`. For
 * shadow-root or portal scenarios, call once for each affected sibling root.
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * import { inert } from '@bquery/bquery/a11y';
 *
 * const handle = inert(modalEl);
 * // ...later
 * handle.release();
 * ```
 */
export const inert = (target: Element): DisposableHandle => {
  const parent = target.parentElement;
  if (!parent) {
    return { release: () => {} };
  }
  type Saved = {
    el: Element;
    inert: string | null;
    ariaHidden: string | null;
  };
  const saved: Saved[] = [];
  for (const child of Array.from(parent.children)) {
    if (child === target) continue;
    saved.push({
      el: child,
      inert: child.getAttribute('inert'),
      ariaHidden: child.getAttribute('aria-hidden'),
    });
    child.setAttribute('inert', '');
    child.setAttribute('aria-hidden', 'true');
  }
  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      for (const item of saved) {
        if (item.inert === null) item.el.removeAttribute('inert');
        else item.el.setAttribute('inert', item.inert);
        if (item.ariaHidden === null) item.el.removeAttribute('aria-hidden');
        else item.el.setAttribute('aria-hidden', item.ariaHidden);
      }
    },
  };
};

/**
 * Locks page scrolling by setting `overflow: hidden` on the document element
 * and body. Preserves the prior inline overflow styles and restores them on
 * `release()`.
 *
 * Multiple concurrent scroll locks are supported via reference counting.
 *
 * @since 1.14.0
 */
let scrollLockRefs = 0;
let savedDocOverflow: string | null = null;
let savedBodyOverflow: string | null = null;
let savedBodyPaddingRight: string | null = null;

export const scrollLock = (): DisposableHandle => {
  if (typeof document === 'undefined') {
    return { release: () => {} };
  }
  const root = document.documentElement;
  const body = document.body;
  if (!root || !body) {
    return { release: () => {} };
  }
  if (scrollLockRefs === 0) {
    savedDocOverflow = root.style.overflow || null;
    savedBodyOverflow = body.style.overflow || null;
    savedBodyPaddingRight = body.style.paddingRight || null;
    // Compensate for the disappearing scrollbar so the layout doesn't shift.
    const viewportWidth =
      typeof window === 'undefined' || typeof window.innerWidth !== 'number'
        ? root.clientWidth
        : window.innerWidth;
    const scrollbar = viewportWidth - root.clientWidth;
    if (scrollbar > 0) {
      body.style.paddingRight = `${scrollbar}px`;
    }
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
  }
  scrollLockRefs++;
  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      scrollLockRefs = Math.max(0, scrollLockRefs - 1);
      if (scrollLockRefs === 0) {
        if (savedDocOverflow === null) {
          root.style.removeProperty('overflow');
        } else {
          root.style.overflow = savedDocOverflow;
        }
        if (savedBodyOverflow === null) {
          body.style.removeProperty('overflow');
        } else {
          body.style.overflow = savedBodyOverflow;
        }
        if (savedBodyPaddingRight === null) {
          body.style.removeProperty('padding-right');
        } else {
          body.style.paddingRight = savedBodyPaddingRight;
        }
      }
    },
  };
};

/**
 * Internal — resets the scroll-lock ref count. Tests only.
 * @internal
 */
export const _resetScrollLockForTests = (): void => {
  scrollLockRefs = 0;
  savedDocOverflow = null;
  savedBodyOverflow = null;
  savedBodyPaddingRight = null;
};

/**
 * Reliable mount-time focus helper that defers focus to the next animation
 * frame (or `setTimeout(0)` when rAF is unavailable). Optionally selects the
 * text content of `<input>`/`<textarea>` elements.
 *
 * Passes `preventScroll` through to `HTMLElement.focus()` when the runtime
 * supports focus options.
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * import { autoFocus } from '@bquery/bquery/a11y';
 * autoFocus(inputEl, { select: true });
 * ```
 */
export const autoFocus = (
  target: HTMLElement,
  options: { select?: boolean; preventScroll?: boolean } = {}
): { cancel: () => void } => {
  const { select = false, preventScroll = false } = options;
  let canceled = false;

  const apply = (): void => {
    if (canceled || !target.isConnected) return;
    try {
      target.focus({ preventScroll });
    } catch {
      target.focus();
    }
    if (select) {
      const maybeSelect = (target as { select?: () => void }).select;
      if (typeof maybeSelect === 'function') {
        try {
          maybeSelect.call(target);
        } catch {
          // ignore
        }
      }
    }
  };

  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(apply);
    return {
      cancel: () => {
        canceled = true;
        cancelAnimationFrame(id);
      },
    };
  }
  const id = setTimeout(apply, 0);
  return {
    cancel: () => {
      canceled = true;
      clearTimeout(id);
    },
  };
};

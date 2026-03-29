/**
 * Character-by-character typewriter text animation.
 *
 * @module bquery/motion
 */

import { prefersReducedMotion } from './reduced-motion';
import type { TypewriterControls, TypewriterOptions } from './types';

/**
 * Animate text appearing character by character in an element.
 *
 * @param element - The element to type text into
 * @param text - The text to display
 * @param options - Typewriter configuration
 * @returns Controls with `.stop()` to cancel and `.done` promise
 *
 * @example
 * ```ts
 * const tw = typewriter(
 *   document.querySelector('#output')!,
 *   'Hello, world!',
 *   { speed: 80, cursor: true },
 * );
 *
 * // Wait for it to finish:
 * await tw.done;
 *
 * // Or cancel early:
 * tw.stop();
 * ```
 */
export const typewriter = (
  element: HTMLElement,
  text: string,
  options: TypewriterOptions = {}
): TypewriterControls => {
  const {
    speed = 50,
    delay = 0,
    cursor = false,
    cursorChar = '|',
    loop = false,
    loopDelay = 1000,
    respectReducedMotion = true,
    onComplete,
  } = options;

  if (typeof document === 'undefined') {
    return {
      stop: () => {},
      done: Promise.resolve(),
    };
  }

  const el = element;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cursorEl: HTMLSpanElement | null = null;
  let cursorTimer: ReturnType<typeof setInterval> | null = null;
  let resolvePromise: (() => void) | null = null;

  // Add cursor element if enabled
  const setupCursor = () => {
    if (!cursor) return;
    cursorEl = document.createElement('span');
    cursorEl.setAttribute('aria-hidden', 'true');
    cursorEl.textContent = cursorChar;
    el.appendChild(cursorEl);

    // Blink the cursor
    let visible = true;
    cursorTimer = setInterval(() => {
      if (cursorEl) {
        visible = !visible;
        cursorEl.style.opacity = visible ? '1' : '0';
      }
    }, 530);
  };

  const removeCursor = () => {
    if (cursorTimer !== null) {
      clearInterval(cursorTimer);
      cursorTimer = null;
    }
    if (cursorEl && cursorEl.parentNode) {
      cursorEl.parentNode.removeChild(cursorEl);
      cursorEl = null;
    }
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    removeCursor();
    // Resolve the done promise so callers awaiting it are unblocked
    resolvePromise?.();
    resolvePromise = null;
  };

  // If reduced motion, show text instantly
  if (respectReducedMotion && prefersReducedMotion()) {
    el.textContent = text;
    onComplete?.();
    return {
      stop: () => {},
      done: Promise.resolve(),
    };
  }

  const done = new Promise<void>((resolve) => {
    resolvePromise = resolve;

    const typeLoop = () => {
      let charIndex = 0;
      el.textContent = '';
      setupCursor();
      const textNode = document.createTextNode('');

      if (cursorEl) {
        el.insertBefore(textNode, cursorEl);
      } else {
        el.appendChild(textNode);
      }

      const typeNextChar = () => {
        if (stopped) {
          return;
        }
        if (charIndex < text.length) {
          textNode.data = text.slice(0, charIndex + 1);
          charIndex++;
          timer = setTimeout(typeNextChar, speed);
        } else {
          // Typing complete for this iteration
          onComplete?.();

          if (loop && !stopped) {
            timer = setTimeout(() => {
              if (!stopped) {
                removeCursor();
                typeLoop();
              }
            }, loopDelay);
          } else {
            removeCursor();
            resolve();
            resolvePromise = null;
          }
        }
      };

      timer = setTimeout(typeNextChar, delay);
    };

    typeLoop();
  });

  return { stop, done };
};

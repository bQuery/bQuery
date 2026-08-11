/**
 * Async clipboard API wrappers.
 *
 * Provides simple read/write access to the system clipboard
 * via the Async Clipboard API, plus image read/write and a reactive
 * `clipboardText()` signal for opt-in monitoring (1.14+).
 *
 * @module bquery/media
 */

import { createMediaSignal, type AbortableOptions } from './internal';
import type { ClipboardAPI, MediaSignalHandle } from './types';

const CLIPBOARD_UNAVAILABLE_ERROR =
  'bQuery media: Clipboard API is unavailable. Use a secure context (HTTPS or localhost) and ensure clipboard permissions or user-activation requirements are met.';

const hasClipboardText = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.clipboard &&
  typeof navigator.clipboard.readText === 'function' &&
  typeof navigator.clipboard.writeText === 'function';

const hasClipboardItems = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.clipboard &&
  typeof (navigator.clipboard as Clipboard & { read?: unknown }).read === 'function' &&
  typeof (navigator.clipboard as Clipboard & { write?: unknown }).write === 'function' &&
  typeof ClipboardItem !== 'undefined';

/**
 * Clipboard API wrapper providing async read/write access for text and
 * (where supported) images.
 *
 * Both string methods are `Promise`-based and will reject if the API is
 * unavailable or permission is denied.
 *
 * @example
 * ```ts
 * import { clipboard } from '@bquery/bquery/media';
 *
 * await clipboard.write('Hello, world!');
 * const text = await clipboard.read();
 *
 * if (clipboard.isSupported) {
 *   const blob = await clipboard.readImage();
 *   await clipboard.writeImage(blob);
 * }
 * ```
 */
export const clipboard: ClipboardAPI & {
  /** Whether the basic text Clipboard API is available. */
  readonly isSupported: boolean;
  /** Whether image read/write is available (ClipboardItem support). */
  readonly isImageSupported: boolean;
  /** Read the first image entry from the clipboard as a `Blob`. */
  readImage(): Promise<Blob>;
  /** Write a `Blob` (typically `image/png`) to the clipboard. */
  writeImage(blob: Blob): Promise<void>;
} = {
  get isSupported(): boolean {
    return hasClipboardText();
  },
  get isImageSupported(): boolean {
    return hasClipboardItems();
  },
  read: async (): Promise<string> => {
    if (!hasClipboardText()) {
      throw new Error(CLIPBOARD_UNAVAILABLE_ERROR);
    }
    return navigator.clipboard.readText();
  },
  write: async (text: string): Promise<void> => {
    if (!hasClipboardText()) {
      throw new Error(CLIPBOARD_UNAVAILABLE_ERROR);
    }
    return navigator.clipboard.writeText(text);
  },
  readImage: async (): Promise<Blob> => {
    if (!hasClipboardItems()) {
      throw new Error(CLIPBOARD_UNAVAILABLE_ERROR);
    }
    const items = await (
      navigator.clipboard as Clipboard & {
        read: () => Promise<readonly (ClipboardItem & { types: readonly string[] })[]>;
      }
    ).read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (imageType) {
        return item.getType(imageType);
      }
    }
    throw new Error('bQuery media: clipboard contains no image data');
  },
  writeImage: async (blob: Blob): Promise<void> => {
    if (!hasClipboardItems()) {
      throw new Error(CLIPBOARD_UNAVAILABLE_ERROR);
    }
    const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
    await (
      navigator.clipboard as Clipboard & {
        write: (items: readonly ClipboardItem[]) => Promise<void>;
      }
    ).write([item]);
  },
};

/**
 * Options for {@link clipboardText}.
 */
export interface ClipboardTextOptions extends AbortableOptions {
  /** Re-read on `focus` events. @default true */
  onFocus?: boolean;
  /** Re-read on `copy` / `cut` events. @default true */
  onCopy?: boolean;
  /** Polling interval in ms. Disabled by default. */
  pollMs?: number;
}

/**
 * Reactive signal that mirrors the system clipboard text.
 *
 * Re-reads on `focus`, `copy`, `cut`, and (optionally) a configurable polling
 * interval. Returns an empty string when the Clipboard API is unavailable or
 * permission has not been granted.
 *
 * @example
 * ```ts
 * const text = clipboardText({ onFocus: true });
 * effect(() => console.log('clipboard:', text.value));
 * ```
 */
export const clipboardText = (options: ClipboardTextOptions = {}): MediaSignalHandle<string> => {
  const onFocus = options.onFocus !== false;
  const onCopy = options.onCopy !== false;
  const pollMs = options.pollMs && options.pollMs > 0 ? options.pollMs : 0;

  return createMediaSignal<string>(
    '',
    (set) => {
      let cancelled = false;
      const refresh = (): void => {
        if (cancelled || !hasClipboardText()) return;
        navigator.clipboard
          .readText()
          .then((v) => {
            if (!cancelled) set(v);
          })
          .catch(() => {
            // permission denied or transient — keep last value
          });
      };

      let interval: ReturnType<typeof setInterval> | undefined;
      if (onFocus) window.addEventListener('focus', refresh);
      if (onCopy) {
        document.addEventListener('copy', refresh);
        document.addEventListener('cut', refresh);
      }
      if (pollMs) interval = setInterval(refresh, pollMs);

      refresh();
      return () => {
        cancelled = true;
        if (interval !== undefined) clearInterval(interval);
        if (onFocus) window.removeEventListener('focus', refresh);
        if (onCopy) {
          document.removeEventListener('copy', refresh);
          document.removeEventListener('cut', refresh);
        }
      };
    },
    options
  );
};

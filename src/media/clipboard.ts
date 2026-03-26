/**
 * Async clipboard API wrappers.
 *
 * Provides simple read/write access to the system clipboard
 * via the Async Clipboard API.
 *
 * @module bquery/media
 */

import type { ClipboardAPI } from './types';

/**
 * Clipboard API wrapper providing simple async read/write access.
 *
 * Uses the modern Async Clipboard API (`navigator.clipboard`) under the hood.
 * Both methods are `Promise`-based and will reject if the API is unavailable
 * or permission is denied.
 *
 * @example
 * ```ts
 * import { clipboard } from '@bquery/bquery/media';
 *
 * // Write text to clipboard
 * await clipboard.write('Hello, world!');
 *
 * // Read text from clipboard
 * const text = await clipboard.read();
 * console.log(text); // "Hello, world!"
 * ```
 */
export const clipboard: ClipboardAPI = {
  /**
   * Reads text from the system clipboard.
   *
   * @returns A promise that resolves with the clipboard text content
   * @throws Error if the Clipboard API is not available or permission is denied
   *
   * @example
   * ```ts
   * const text = await clipboard.read();
   * console.log('Clipboard contains:', text);
   * ```
   */
  read: async (): Promise<string> => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.readText !== 'function'
    ) {
      throw new Error('Clipboard API is not available');
    }
    return navigator.clipboard.readText();
  },

  /**
   * Writes text to the system clipboard.
   *
   * @param text - The text to write to the clipboard
   * @returns A promise that resolves when the text has been written
   * @throws Error if the Clipboard API is not available or permission is denied
   *
   * @example
   * ```ts
   * await clipboard.write('Copied!');
   * ```
   */
  write: async (text: string): Promise<void> => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      throw new Error('Clipboard API is not available');
    }
    return navigator.clipboard.writeText(text);
  },
};

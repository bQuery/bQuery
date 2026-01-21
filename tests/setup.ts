/**
 * Test environment setup.
 * Provides DOM globals using happy-dom for testing browser APIs.
 */
import { Window } from 'happy-dom';

// Create a new window instance and expose its globals
const window = new Window();

// Register essential DOM globals
(globalThis as unknown as { window: Window }).window = window;
(globalThis as unknown as { document: Document }).document = window.document as unknown as Document;
(globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement =
  window.HTMLElement as unknown as typeof HTMLElement;
(globalThis as unknown as { Element: typeof Element }).Element =
  window.Element as unknown as typeof Element;
(globalThis as unknown as { Node: typeof Node }).Node = window.Node as unknown as typeof Node;
(globalThis as unknown as { NodeFilter: typeof NodeFilter }).NodeFilter =
  window.NodeFilter as unknown as typeof NodeFilter;
(globalThis as unknown as { Event: typeof Event }).Event = window.Event as unknown as typeof Event;
(globalThis as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent =
  window.CustomEvent as unknown as typeof CustomEvent;
(globalThis as unknown as { NodeList: typeof NodeList }).NodeList =
  window.NodeList as unknown as typeof NodeList;
(globalThis as unknown as { customElements: CustomElementRegistry }).customElements =
  window.customElements as unknown as CustomElementRegistry;

// Polyfill requestAnimationFrame for spring animation tests
(
  globalThis as unknown as {
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
  }
).requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
};

(globalThis as unknown as { cancelAnimationFrame: (handle: number) => void }).cancelAnimationFrame =
  (handle: number) => {
    clearTimeout(handle);
  };

// Polyfill crypto.getRandomValues for generateNonce tests
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as unknown as { crypto: Crypto }).crypto = {
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (array) {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
      return array;
    },
  } as Crypto;
}

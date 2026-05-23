/**
 * SSR-safe environment checks for the canvas module.
 *
 * All DOM, OffscreenCanvas, and ResizeObserver references are guarded so the
 * module remains importable in Node.js without side effects.
 *
 * @internal
 */

export const hasWindow = (): boolean => typeof window !== 'undefined';

export const hasDocument = (): boolean =>
  typeof document !== 'undefined' && document !== null;

export const hasHTMLCanvasElement = (): boolean =>
  typeof HTMLCanvasElement !== 'undefined';

export const hasOffscreenCanvas = (): boolean =>
  typeof OffscreenCanvas !== 'undefined';

export const hasResizeObserver = (): boolean =>
  typeof ResizeObserver !== 'undefined';

export const hasImage = (): boolean => typeof Image !== 'undefined';

export const hasCreateImageBitmap = (): boolean =>
  typeof createImageBitmap === 'function';

export const getDocument = (override?: Document): Document => {
  if (override) return override;
  if (!hasDocument()) {
    throw new Error(
      'bQuery canvas: document is not available in this environment. ' +
        'Create the canvas inside a browser-like runtime or supply ownerDocument.'
    );
  }
  return document;
};

export const getDevicePixelRatio = (): number => {
  if (typeof window === 'undefined') return 1;
  const dpr = (window as Window & { devicePixelRatio?: number }).devicePixelRatio;
  return typeof dpr === 'number' && dpr > 0 ? dpr : 1;
};

const RAF_FALLBACK_INTERVAL_MS = 16;

export const requestFrame = (cb: (time: number) => void): number => {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(cb);
  }
  return setTimeout(() => cb(Date.now()), RAF_FALLBACK_INTERVAL_MS) as unknown as number;
};

export const cancelFrame = (handle: number): void => {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
};

export const now = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

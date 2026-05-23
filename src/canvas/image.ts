/**
 * Image loading helpers with caching and abort support.
 *
 * Used both by the public `loadImage()` export and internally by
 * `BQueryCanvas#image()` to keep string-URL draws DRY and side-effect free
 * outside the browser.
 *
 * @module bquery/canvas
 */

import { hasCreateImageBitmap, hasImage } from './internal/env';
import type { LoadImageOptions } from './types';

interface CachedEntry {
  promise: Promise<HTMLImageElement | ImageBitmap>;
  resolved?: HTMLImageElement | ImageBitmap;
}

const imageCache = new Map<string, CachedEntry>();

const cacheKey = (src: string, options?: LoadImageOptions): string => {
  return `${options?.preferImageBitmap ? 'bitmap:' : 'image:'}${
    options?.crossOrigin ?? ''
  }|${options?.referrerPolicy ?? ''}|${src}`;
};

/**
 * Load an image with caching, abort signal support, and feature-detected
 * `ImageBitmap` decoding.
 *
 * Note: `crossOrigin` / `referrerPolicy` options influence whether the
 * resulting image taints the canvas. Snapshots of a tainted canvas will throw
 * a `SecurityError` — pass `crossOrigin: 'anonymous'` when consuming
 * cross-origin images you intend to read back.
 *
 * @example
 * ```ts
 * const img = await loadImage('/icon.png', { crossOrigin: 'anonymous' });
 * ctx.drawImage(img, 0, 0);
 * ```
 */
export const loadImage = (
  src: string,
  options?: LoadImageOptions
): Promise<HTMLImageElement | ImageBitmap> => {
  if (typeof src !== 'string' || src.length === 0) {
    return Promise.reject(new TypeError('bQuery canvas: loadImage requires a non-empty string URL.'));
  }

  const useCache = options?.cache !== false;
  const key = cacheKey(src, options);

  if (useCache) {
    const cached = imageCache.get(key);
    if (cached) {
      if (options?.signal && options.signal.aborted) {
        return Promise.reject(abortError(options.signal));
      }
      return cached.promise;
    }
  }

  const promise = doLoad(src, options);

  if (useCache) {
    const entry: CachedEntry = { promise };
    imageCache.set(key, entry);
    promise.then(
      result => {
        entry.resolved = result;
      },
      () => {
        imageCache.delete(key);
      }
    );
  }

  return promise;
};

/**
 * Synchronously read a previously-resolved image from the cache, if available.
 * Returns `undefined` while the load is still in-flight.
 *
 * @internal
 */
export const peekImage = (
  src: string,
  options?: LoadImageOptions
): HTMLImageElement | ImageBitmap | undefined => {
  const entry = imageCache.get(cacheKey(src, options));
  return entry?.resolved;
};

/**
 * Clear the internal image cache. Primarily used by tests and long-lived
 * pages that need to release memory pressure.
 */
export const clearImageCache = (): void => {
  imageCache.clear();
};

const abortError = (signal: AbortSignal): DOMException => {
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (reason instanceof Error) return reason as DOMException;
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Image load aborted', 'AbortError');
  }
  const err = new Error('Image load aborted');
  err.name = 'AbortError';
  return err as unknown as DOMException;
};

const doLoad = (
  src: string,
  options?: LoadImageOptions
): Promise<HTMLImageElement | ImageBitmap> => {
  if (!hasImage()) {
    return Promise.reject(
      new Error('bQuery canvas: Image is not available in this environment.')
    );
  }

  if (options?.signal && options.signal.aborted) {
    return Promise.reject(abortError(options.signal));
  }

  return new Promise<HTMLImageElement | ImageBitmap>((resolve, reject) => {
    const img = new Image();

    if (options?.crossOrigin !== undefined) img.crossOrigin = options.crossOrigin;
    if (options?.referrerPolicy !== undefined) img.referrerPolicy = options.referrerPolicy;

    let abortHandler: (() => void) | undefined;

    const cleanup = (): void => {
      img.onload = null;
      img.onerror = null;
      if (abortHandler && options?.signal) {
        options.signal.removeEventListener('abort', abortHandler);
      }
    };

    img.onload = (): void => {
      cleanup();
      if (options?.preferImageBitmap && hasCreateImageBitmap()) {
        createImageBitmap(img).then(
          bitmap => resolve(bitmap),
          () => resolve(img)
        );
        return;
      }
      resolve(img);
    };

    img.onerror = (): void => {
      cleanup();
      reject(new Error(`bQuery canvas: failed to load image "${src}".`));
    };

    if (options?.signal) {
      abortHandler = (): void => {
        cleanup();
        // Best-effort cancel — assigning an empty src interrupts the request
        // in most browsers.
        try {
          img.src = '';
        } catch {
          /* ignore */
        }
        reject(abortError(options.signal!));
      };
      options.signal.addEventListener('abort', abortHandler);
    }

    img.src = src;
  });
};

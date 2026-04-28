/**
 * Hydration mismatch detection.
 *
 * The DOM-free SSR renderer can annotate every element that carries a `bq-*`
 * directive with a small `data-bq-h` hash (see `RenderOptions.annotateHydration`).
 * On the client, `verifyHydration()` walks the live DOM, recomputes the same
 * hash for each annotated element and reports any divergence.
 *
 * The check is intentionally cheap and safe: collisions only result in false
 * negatives (a mismatch slips through), never in false positives (a stable
 * tree never reports a mismatch).
 *
 * @module bquery/ssr
 */

import { cheapHash, collectDirectiveSignatureFromElement, HYDRATION_HASH_ATTR } from './hash';
import { detectDevEnvironment } from '../core/env';

/** A single hydration mismatch entry returned by `verifyHydration()`. */
export interface HydrationMismatch {
  /** The DOM element whose annotation diverged. */
  element: Element;
  /** The hash that the server emitted (`data-bq-h` value). */
  expected: string;
  /** The hash recomputed from the live element. */
  actual: string;
  /** The directive signature that was hashed (useful for diagnostics). */
  signature: string;
}

/** Options for `verifyHydration`. */
export interface VerifyHydrationOptions {
  /** Directive prefix to match. Default: `'bq'`. */
  prefix?: string;
  /**
   * Whether to log a `console.warn` for each mismatch. Defaults to `true` in
   * non-production environments and `false` otherwise. Pass an explicit
   * boolean to override.
   */
  warn?: boolean;
  /** Optional callback invoked once per mismatch. */
  onMismatch?: (mismatch: HydrationMismatch) => void;
}

/**
 * Walks `[data-bq-h]` elements within `root`, recomputes the directive hash
 * and reports mismatches. Returns the list of mismatches; callers can react
 * however they want (throw in tests, log in dev, ignore in production).
 *
 * Safe to call in any environment. When the runtime has no DOM (server-side)
 * or `root` has no `querySelectorAll`, the function returns an empty array
 * without throwing.
 *
 * @example
 * ```ts
 * import { detectDevEnvironment } from '@bquery/bquery';
 * import { hydrateMount, verifyHydration } from '@bquery/bquery/ssr';
 *
 * const view = hydrateMount('#app', context);
 * if (detectDevEnvironment()) {
 *   verifyHydration(document.getElementById('app')!);
 * }
 * ```
 */
export const verifyHydration = (
  root: Element | Document,
  options: VerifyHydrationOptions = {}
): HydrationMismatch[] => {
  const prefix = options.prefix ?? 'bq';
  const warn = options.warn ?? detectDevEnvironment();
  const onMismatch = options.onMismatch;

  const mismatches: HydrationMismatch[] = [];

  if (!root || typeof (root as Element).querySelectorAll !== 'function') {
    return mismatches;
  }

  // Include the root itself if it carries the annotation.
  const annotated: Element[] = [];
  if (
    typeof (root as Element).getAttribute === 'function' &&
    (root as Element).getAttribute(HYDRATION_HASH_ATTR) !== null
  ) {
    annotated.push(root as Element);
  }
  for (const el of Array.from(root.querySelectorAll(`[${HYDRATION_HASH_ATTR}]`))) {
    annotated.push(el);
  }

  for (const el of annotated) {
    const expected = el.getAttribute(HYDRATION_HASH_ATTR) ?? '';
    const signature = collectDirectiveSignatureFromElement(el, prefix);
    const actual = cheapHash(signature);
    if (actual !== expected) {
      const mismatch: HydrationMismatch = { element: el, expected, actual, signature };
      mismatches.push(mismatch);
      onMismatch?.(mismatch);
      if (warn) {
        console.warn(
          `[bQuery SSR] Hydration mismatch on <${el.tagName.toLowerCase()}>: ` +
            `server="${expected}" client="${actual}" signature="${signature}".`,
          el
        );
      }
    }
  }

  return mismatches;
};

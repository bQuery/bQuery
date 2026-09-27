/**
 * Trusted Types helpers for CSP compatibility.
 *
 * @module bquery/security
 */

import { POLICY_NAME } from './constants';
import { sanitizeHtmlCore } from './sanitize-core';
import type { TrustedHTML, TrustedTypePolicy, TrustedTypesWindow } from './types';

/** Cached Trusted Types policy */
let cachedPolicy: TrustedTypePolicy | null = null;

/** Whether policy initialization has been attempted (to avoid retry spam) */
let policyInitAttempted = false;

/**
 * The one string the policy may wrap without sanitizing, armed only while
 * {@link trustedPreparedHtmlForSink} runs. See that function for callers.
 */
let passthroughHtml: string | null = null;

/**
 * Check if Trusted Types API is available.
 * @returns True if Trusted Types are supported
 */
export const isTrustedTypesSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    typeof (window as TrustedTypesWindow).trustedTypes !== 'undefined'
  );
};

/**
 * Get or create the bQuery Trusted Types policy.
 * @returns The Trusted Types policy or null if unsupported
 */
export const getTrustedTypesPolicy = (): TrustedTypePolicy | null => {
  if (cachedPolicy) return cachedPolicy;
  if (policyInitAttempted) return null;

  if (typeof window === 'undefined') return null;

  const win = window as TrustedTypesWindow;
  if (!win.trustedTypes) return null;

  policyInitAttempted = true;

  try {
    cachedPolicy = win.trustedTypes.createPolicy(POLICY_NAME, {
      createHTML: (input: string) =>
        // Markup that bQuery itself already sanitized (or that is
        // author-controlled by contract) is wrapped as-is; everything else
        // is sanitized here. The pass-through slot is module-private and
        // only armed for the duration of one synchronous call.
        passthroughHtml !== null && input === passthroughHtml ? input : sanitizeHtmlCore(input),
    });
    return cachedPolicy;
  } catch (error) {
    // Policy may already exist or be blocked by CSP
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`bQuery: Could not create Trusted Types policy "${POLICY_NAME}": ${errorMessage}`);
    return null;
  }
};

/**
 * Create a Trusted HTML value for use with Trusted Types-enabled sites.
 * Falls back to regular string when Trusted Types are unavailable.
 *
 * @param html - The HTML string to wrap
 * @returns Trusted HTML value or sanitized string
 */
export const createTrustedHtml = (html: string): TrustedHTML | string => {
  const policy = getTrustedTypesPolicy();
  if (policy) {
    return policy.createHTML(html);
  }
  return sanitizeHtmlCore(html);
};

/**
 * Returns the value to assign to an HTML sink (`innerHTML` /
 * `insertAdjacentHTML`). When a Trusted Types policy is active the value is a
 * `TrustedHTML` object, so the write satisfies an enforced
 * `require-trusted-types-for 'script'` CSP instead of throwing; otherwise it is
 * the sanitized string. Sanitizes exactly once.
 *
 * The declared return type is `string` for ergonomic assignment to DOM sink
 * setters (whose lib types expect `string`); at runtime under enforced Trusted
 * Types the returned value is the `TrustedHTML` object the browser accepts.
 *
 * @example
 * ```ts
 * // Safe under an enforced `require-trusted-types-for 'script'` CSP.
 * element.innerHTML = trustedHtmlForSink('<strong>Hello</strong>');
 * ```
 */
export const trustedHtmlForSink = (rawHtml: string): string =>
  createTrustedHtml(rawHtml) as unknown as string;

/**
 * Returns a sink-assignable value for markup that must **not** be sanitized
 * again: output bQuery already sanitized with a caller-specific allow list
 * (component render output keeps `<slot>`, `part`, form attributes), or an
 * author-controlled template (`createTemplate()`), which the documented
 * threat model treats as trusted. The DOM sanitizer backend also uses it to
 * hand its input to `DOMParser.parseFromString` (itself a Trusted Types sink),
 * since the parsed document is inert and only reaches callers after the
 * allow lists have run.
 *
 * Assigning such a string straight to `innerHTML` throws under an enforced
 * `require-trusted-types-for 'script'` CSP, while routing it through
 * {@link trustedHtmlForSink} would re-sanitize it with the default allow
 * list and strip what the caller deliberately kept. This wraps it through
 * the same `bquery-sanitizer` policy — so no extra policy name has to be
 * allowed in the CSP — without a second sanitizer pass. Without Trusted
 * Types it returns the string unchanged.
 *
 * Never pass untrusted input here: this function performs no sanitization.
 * @internal
 */
export const trustedPreparedHtmlForSink = (preparedHtml: string): string => {
  const policy = getTrustedTypesPolicy();
  if (!policy) return preparedHtml;
  passthroughHtml = preparedHtml;
  try {
    return policy.createHTML(preparedHtml) as unknown as string;
  } finally {
    passthroughHtml = null;
  }
};

/**
 * Forget the cached policy so the next sink write re-detects Trusted Types.
 * Test-only: browsers never let a page remove `window.trustedTypes`.
 * @internal
 */
export const __resetTrustedTypesPolicy = (): void => {
  cachedPolicy = null;
  policyInitAttempted = false;
};

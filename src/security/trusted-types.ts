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
      createHTML: (input: string) => sanitizeHtmlCore(input),
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
 */
export const trustedHtmlForSink = (rawHtml: string): string =>
  createTrustedHtml(rawHtml) as unknown as string;

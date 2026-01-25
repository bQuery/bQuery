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

/**
 * Check if Trusted Types API is available.
 * @returns True if Trusted Types are supported
 */
export const isTrustedTypesSupported = (): boolean => {
  return typeof (window as TrustedTypesWindow).trustedTypes !== 'undefined';
};

/**
 * Get or create the bQuery Trusted Types policy.
 * @returns The Trusted Types policy or null if unsupported
 */
export const getTrustedTypesPolicy = (): TrustedTypePolicy | null => {
  if (cachedPolicy) return cachedPolicy;

  const win = window as TrustedTypesWindow;
  if (!win.trustedTypes) return null;

  try {
    cachedPolicy = win.trustedTypes.createPolicy(POLICY_NAME, {
      createHTML: (input: string) => sanitizeHtmlCore(input),
    });
    return cachedPolicy;
  } catch {
    // Policy may already exist or be blocked by CSP
    console.warn(`bQuery: Could not create Trusted Types policy "${POLICY_NAME}"`);
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

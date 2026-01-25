/**
 * Security types for sanitization, CSP compatibility, and Trusted Types.
 *
 * @module bquery/security
 */

/**
 * Sanitizer configuration options.
 */
export interface SanitizeOptions {
  /** Allow these additional tags (default: none) */
  allowTags?: string[];
  /** Allow these additional attributes (default: none) */
  allowAttributes?: string[];
  /** Allow data-* attributes (default: true) */
  allowDataAttributes?: boolean;
  /** Strip all tags and return plain text (default: false) */
  stripAllTags?: boolean;
}

/** Window interface extended with Trusted Types */
export interface TrustedTypesWindow extends Window {
  trustedTypes?: {
    createPolicy: (
      name: string,
      rules: { createHTML?: (input: string) => string }
    ) => TrustedTypePolicy;
    isHTML?: (value: unknown) => boolean;
  };
}

/** Trusted Types policy interface */
export interface TrustedTypePolicy {
  createHTML: (input: string) => TrustedHTML;
}

/** Trusted HTML type placeholder for environments without Trusted Types */
export interface TrustedHTML {
  toString(): string;
}

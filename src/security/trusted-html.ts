declare const sanitizedHtmlBrand: unique symbol;
const trustedHtmlBrand: unique symbol = Symbol('bquery.trusted-html.brand');
const TRUSTED_HTML_VALUE = Symbol('bquery.trusted-html');

/**
 * Branded HTML string produced by bQuery's sanitization or escaping template helpers.
 *
 * Values returned from {@link sanitizeHtml} carry sanitized markup. Values returned from
 * {@link safeHtml} preserve the template's static markup while escaping normal interpolations
 * and splicing {@link trusted} fragments verbatim. This brand is not intended for arbitrary
 * strings or manual concatenation outside those helpers.
 */
export type SanitizedHtml = string & { readonly [sanitizedHtmlBrand]: true };

/**
 * Marker object that safeHtml can splice into templates without escaping again.
 */
export type TrustedHtml = { readonly [trustedHtmlBrand]: true; toString(): string };

type TrustedHtmlValue = TrustedHtml & { readonly [TRUSTED_HTML_VALUE]: string };

/**
 * Apply the internal {@link SanitizedHtml} brand to helper output.
 *
 * @internal
 */
export const toSanitizedHtml = (html: string): SanitizedHtml => html as SanitizedHtml;

/**
 * Mark a sanitized HTML string for verbatim splicing into safeHtml templates.
 *
 * @param html - HTML previously produced by sanitizeHtml, safeHtml, or another trusted bQuery helper
 * @returns Trusted HTML marker object for safeHtml interpolations
 *
 * @example
 * ```ts
 * const badge = trusted(sanitizeHtml('<strong onclick="alert(1)">New</strong>'));
 * const markup = safeHtml`<span>${badge}</span>`;
 * ```
 */
export const trusted = (html: SanitizedHtml): TrustedHtml => {
  const value = String(html);
  return Object.freeze({
    [trustedHtmlBrand]: true as const,
    [TRUSTED_HTML_VALUE]: value,
    toString: () => value,
  });
};

/**
 * Check whether a value is a trusted HTML marker created by trusted().
 *
 * @internal
 */
export const isTrustedHtml = (value: unknown): value is TrustedHtml => {
  return (
    typeof value === 'object' &&
    value !== null &&
    trustedHtmlBrand in value &&
    TRUSTED_HTML_VALUE in value
  );
};

/**
 * Unwrap the raw HTML string stored inside a trusted HTML marker.
 *
 * @internal
 */
export const unwrapTrustedHtml = (value: TrustedHtml): string => {
  return (value as TrustedHtmlValue)[TRUSTED_HTML_VALUE];
};

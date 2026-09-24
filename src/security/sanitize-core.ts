/**
 * Backend dispatch for HTML sanitization.
 *
 * Two backends implement the same policy: `sanitize-dom.ts` when the runtime
 * has a DOM, `sanitize-string.ts` when it does not. This module only decides
 * which one runs — the rules they enforce live in `sanitize-policy.ts` so the
 * two cannot drift (#229).
 *
 * @module bquery/security
 * @internal
 */

import { resolveSanitizerBackend } from './config';
import { sanitizeHtmlDom, stripTagsDom } from './sanitize-dom';
import { sanitizeHtmlString, stripTagsString } from './sanitize-string';
import type { SanitizeOptions } from './types';

/**
 * Core sanitization logic (without Trusted Types wrapper).
 * @internal
 */
export const sanitizeHtmlCore = (html: string, options: SanitizeOptions = {}): string =>
  resolveSanitizerBackend() === 'dom'
    ? sanitizeHtmlDom(html, options)
    : sanitizeHtmlString(html, options);

/**
 * Strip all markup, leaving text.
 *
 * Routed to the backends' text extractors rather than through
 * `sanitizeHtml(..., { stripAllTags: true })`, because the two differ on
 * purpose: `stripTags()` is documented to return plain text and returns it
 * raw, while the `sanitizeHtml` path is branded `SanitizedHtml` and escapes
 * so the value is inert in an HTML sink.
 * @internal
 */
export const stripTagsCore = (html: string): string =>
  resolveSanitizerBackend() === 'dom' ? stripTagsDom(html) : stripTagsString(html);

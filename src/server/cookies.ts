/**
 * Cookie serialization helpers shared by the request context, session, and CSRF
 * middleware.
 *
 * @module bquery/server
 */

import type { ServerCookieOptions } from './types';

const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const COOKIE_SAME_SITE_LOOKUP = {
  lax: 'Lax',
  none: 'None',
  strict: 'Strict',
} as const;

const assertCookieName = (name: string): void => {
  if (!COOKIE_NAME_PATTERN.test(name)) {
    throw new TypeError('Cookie name contains invalid characters.');
  }
};

/**
 * Reject control characters (0x00–0x1F, 0x7F) and `;` in cookie attribute
 * values so request-controlled data cannot inject extra cookie attributes.
 *
 * @internal
 */
const hasInvalidCookieAttributeChar = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f || code === 0x3b) {
      return true;
    }
  }
  return false;
};

const assertCookieAttributeValue = (label: string, value: string): string => {
  if (hasInvalidCookieAttributeChar(value)) {
    throw new TypeError(`Cookie ${label} contains invalid characters.`);
  }
  return value;
};

/**
 * Serialize a `Set-Cookie` header value, validating the name and attribute
 * values so request-controlled data can never inject extra cookie attributes.
 */
export const serializeCookie = (
  name: string,
  value: string,
  options: ServerCookieOptions = {}
): string => {
  assertCookieName(name);
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${assertCookieAttributeValue('path', options.path)}`);
  if (options.domain) parts.push(`Domain=${assertCookieAttributeValue('domain', options.domain)}`);
  if (typeof options.maxAge === 'number' && Number.isFinite(options.maxAge)) {
    parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
  }
  let isSameSiteNone = false;
  if (options.sameSite) {
    if (typeof options.sameSite !== 'string') {
      throw new TypeError('Cookie sameSite must be one of "lax", "none", or "strict".');
    }
    const sameSite =
      COOKIE_SAME_SITE_LOOKUP[
        options.sameSite.toLowerCase() as keyof typeof COOKIE_SAME_SITE_LOOKUP
      ];
    if (!sameSite) {
      throw new TypeError('Cookie sameSite must be one of "lax", "none", or "strict".');
    }
    parts.push(`SameSite=${sameSite}`);
    isSameSiteNone = sameSite === 'None';
  }
  if (options.httpOnly) parts.push('HttpOnly');
  // `SameSite=None` cookies are rejected by browsers unless `Secure` is set, so
  // force it rather than silently emitting a cookie the browser will drop.
  if (options.secure || isSameSiteNone) parts.push('Secure');
  return parts.join('; ');
};

/**
 * Append a `Set-Cookie` header to an existing response without collapsing it
 * into other cookies.
 *
 * Responses built by `createServer()` expose mutable headers, so the cookie is
 * appended in place. When the headers are immutable (e.g. a response produced by
 * `Response.redirect()`), the response is reconstructed around the same body so
 * the cookie is still emitted.
 */
export const appendSetCookie = (response: Response, cookie: string): Response => {
  try {
    response.headers.append('set-cookie', cookie);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.append('set-cookie', cookie);
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
};

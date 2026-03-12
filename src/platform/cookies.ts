/**
 * Reactive cookie helpers.
 *
 * @module bquery/platform
 */

import { effect, signal, type Signal } from '../reactive/signal';
import { getBqueryConfig } from './config';

/** Options for useCookie(). */
export interface UseCookieOptions<T> {
  /** Default value when the cookie is not present. */
  defaultValue?: T;
  /** Cookie path. Defaults to the global config or `/`. */
  path?: string;
  /** Optional cookie domain. */
  domain?: string;
  /** Cookie SameSite attribute. */
  sameSite?: 'Strict' | 'Lax' | 'None';
  /** Whether the cookie should be marked secure. */
  secure?: boolean;
  /** Cookie expiry date. */
  expires?: Date;
  /** Cookie max-age in seconds. */
  maxAge?: number;
  /** Automatically persist signal updates back to document.cookie. */
  watch?: boolean;
  /** Serialize a value before writing it into the cookie. */
  serialize?: (value: T) => string;
  /** Deserialize a cookie string into a typed value. */
  deserialize?: (value: string) => T;
}

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;

  const prefix = `${encodeURIComponent(name)}=`;
  const segments = document.cookie ? document.cookie.split(';') : [];

  for (const segment of segments) {
    const normalizedSegment = segment.trim();
    if (normalizedSegment.startsWith(prefix)) {
      const rawValue = normalizedSegment.slice(prefix.length);
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }

  return null;
};

const requiresJsonParsing = (value: string): boolean => {
  const normalized = value.trim();
  return normalized.startsWith('{') || normalized.startsWith('[') || normalized.startsWith('"');
};

const removeCookie = (
  name: string,
  options: Pick<UseCookieOptions<unknown>, 'path' | 'domain' | 'sameSite' | 'secure'>
): void => {
  if (typeof document === 'undefined') return;

  const segments = [`${encodeURIComponent(name)}=`, 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'];

  if (options.path) segments.push(`Path=${options.path}`);
  if (options.domain) segments.push(`Domain=${options.domain}`);
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`);
  if (options.secure) segments.push('Secure');

  document.cookie = segments.join('; ');
};

const writeCookie = <T>(name: string, value: T, options: UseCookieOptions<T>): void => {
  if (typeof document === 'undefined') return;

  const serialized = options.serialize
    ? options.serialize(value)
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);

  const segments = [`${encodeURIComponent(name)}=${encodeURIComponent(serialized)}`];

  if (options.path) segments.push(`Path=${options.path}`);
  if (options.domain) segments.push(`Domain=${options.domain}`);
  if (typeof options.maxAge === 'number') segments.push(`Max-Age=${options.maxAge}`);
  if (options.expires) segments.push(`Expires=${options.expires.toUTCString()}`);
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`);
  if (options.secure) segments.push('Secure');

  document.cookie = segments.join('; ');
};

/**
 * Create a reactive cookie signal.
 *
 * @template T - Cookie value type
 * @param name - Cookie name
 * @param options - Read/write configuration for the cookie
 * @returns Reactive signal representing the cookie value
 *
 * @example
 * ```ts
 * const theme = useCookie('theme', { defaultValue: 'light' });
 * theme.value = 'dark';
 * ```
 */
export const useCookie = <T>(name: string, options: UseCookieOptions<T> = {}): Signal<T | null> => {
  const cookieConfig = getBqueryConfig().cookies;
  const resolvedOptions: UseCookieOptions<T> = {
    path: cookieConfig?.path ?? '/',
    sameSite: cookieConfig?.sameSite ?? 'Lax',
    secure: cookieConfig?.secure ?? false,
    watch: true,
    ...options,
  };

  if (resolvedOptions.sameSite === 'None') {
    resolvedOptions.secure = true;
  }

  const raw = readCookie(name);
  let initialValue = (resolvedOptions.defaultValue ?? null) as T | null;

  if (raw !== null) {
    try {
      initialValue = resolvedOptions.deserialize
        ? resolvedOptions.deserialize(raw)
        : requiresJsonParsing(raw)
          ? (JSON.parse(raw) as T)
          : ((raw as T) ?? initialValue);
    } catch (error) {
      console.warn(`bQuery: Failed to deserialize cookie "${name}", using raw string value`, error);
      initialValue = (raw as T) ?? initialValue;
    }
  }

  const cookie = signal<T | null>(initialValue);

  if (typeof document === 'undefined' || resolvedOptions.watch === false) {
    return cookie;
  }

  let initialized = false;
  effect(() => {
    const nextValue = cookie.value;

    if (!initialized) {
      initialized = true;
      return;
    }

    if (nextValue == null) {
      removeCookie(name, resolvedOptions);
      return;
    }

    writeCookie(name, nextValue, resolvedOptions);
  });

  return cookie;
};

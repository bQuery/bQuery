/**
 * Dependency-free cryptographic helpers for the server module.
 *
 * Everything here is built on the Web Crypto API (`globalThis.crypto`), which is
 * a standard global on every runtime the server module targets — Node ≥ 24, Bun,
 * Deno, and edge/workerd. No Node-specific `node:crypto` import is used, so the
 * helpers stay runtime-agnostic and tree-shakeable.
 *
 * @module bquery/server
 */

const encoder = new TextEncoder();

/**
 * Resolve the Web Crypto implementation or throw a descriptive error.
 *
 * @internal
 */
const getCrypto = (): Crypto => {
  const cryptoImpl = (globalThis as { crypto?: Crypto }).crypto;
  if (!cryptoImpl || typeof cryptoImpl.subtle === 'undefined') {
    throw new Error(
      'Web Crypto (globalThis.crypto.subtle) is unavailable in this runtime; session/CSRF signing requires it.'
    );
  }
  return cryptoImpl;
};

/**
 * Encode bytes as URL-safe base64 without padding.
 */
export const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Decode a URL-safe base64 string (with or without padding) into bytes.
 *
 * Returns `null` for malformed input instead of throwing, so callers verifying
 * untrusted tokens can treat decode failures as "invalid".
 */
export const base64UrlDecode = (value: string): Uint8Array | null => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
};

/**
 * Generate a URL-safe random token with the requested entropy in bytes.
 *
 * @param byteLength - Number of random bytes (defaults to 18 → 24 base64url chars).
 */
export const randomToken = (byteLength = 18): string => {
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

/**
 * Generate a collision-resistant identifier, preferring `crypto.randomUUID()`
 * when available and falling back to a random token otherwise.
 */
export const randomId = (): string => {
  const cryptoImpl = getCrypto();
  if (typeof cryptoImpl.randomUUID === 'function') {
    return cryptoImpl.randomUUID();
  }
  return randomToken(16);
};

const keyCache = new Map<string, Promise<CryptoKey>>();

/**
 * Import (and cache) an HMAC-SHA-256 signing key for the given secret.
 *
 * @internal
 */
const importHmacKey = (secret: string): Promise<CryptoKey> => {
  const cached = keyCache.get(secret);
  if (cached) {
    return cached;
  }
  const promise = getCrypto()
    .subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ])
    .catch((error: unknown) => {
      // Never cache a rejected import, otherwise one transient failure would
      // poison every later sign/verify for this secret.
      keyCache.delete(secret);
      throw error;
    });
  keyCache.set(secret, promise);
  return promise;
};

/**
 * Compute an HMAC-SHA-256 signature for `data` and return it as base64url.
 *
 * @internal
 */
const hmac = async (secret: string, data: string): Promise<string> => {
  const key = await importHmacKey(secret);
  const signature = await getCrypto().subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
};

/**
 * Constant-time string comparison.
 *
 * Always inspects every character of `a` so the time taken does not leak how
 * many leading characters matched. Differing lengths still return `false`, but
 * only after a full constant-time scan against `a`.
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
  let mismatch = a.length === b.length ? 0 : 1;
  // Guard against `% 0` (NaN) when `b` is empty; the length mismatch above
  // already forces a `false` result in that case.
  const span = b.length || 1;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index % span);
  }
  return mismatch === 0;
};

/**
 * Sign a value with HMAC-SHA-256, producing `${value}.${signature}`.
 *
 * The plaintext value is preserved (this is a signature, not encryption); the
 * appended signature lets {@link unsignValue} detect tampering.
 */
export const signValue = async (value: string, secret: string): Promise<string> => {
  const signature = await hmac(secret, value);
  return `${value}.${signature}`;
};

/**
 * Verify a `${value}.${signature}` token against one or more secrets.
 *
 * Supports secret rotation: the value is accepted when it verifies against any
 * provided secret, so you can prepend a new secret while old cookies still
 * validate. Returns the original value when valid, or `null` otherwise.
 */
export const unsignValue = async (
  signed: string,
  secrets: readonly string[]
): Promise<string | null> => {
  const separator = signed.lastIndexOf('.');
  if (separator <= 0 || separator === signed.length - 1) {
    return null;
  }
  const value = signed.slice(0, separator);
  const signature = signed.slice(separator + 1);
  for (const secret of secrets) {
    const expected = await hmac(secret, value);
    if (timingSafeEqual(signature, expected)) {
      return value;
    }
  }
  return null;
};

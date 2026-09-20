/**
 * CSP helpers (#215). `src/security/csp.ts` sat at 53.66% line coverage —
 * every validation and environment guard in `generateNonce` was untested, in
 * a file whose whole job is security.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { generateNonce, hasCSPDirective } from '../src/security/csp';

/** Swap a global for one test and put it back afterwards. */
const swapGlobal = <K extends keyof typeof globalThis>(key: K, value: unknown): (() => void) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  return () => {
    if (original) Object.defineProperty(globalThis, key, original);
    else delete (globalThis as Record<string, unknown>)[key as string];
  };
};

describe('security/generateNonce', () => {
  it('returns a base64url string with no padding', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(nonce).not.toContain('=');
    expect(nonce).not.toContain('+');
    expect(nonce).not.toContain('/');
  });

  it('defaults to 16 bytes', () => {
    // 16 bytes → 24 base64 chars including padding → 22 without.
    expect(generateNonce()).toHaveLength(22);
  });

  it('honours the requested byte length', () => {
    expect(generateNonce(1).length).toBeGreaterThan(0);
    expect(generateNonce(32).length).toBeGreaterThan(generateNonce(16).length);
  });

  it('produces a different value each call', () => {
    const nonces = new Set(Array.from({ length: 50 }, () => generateNonce()));
    expect(nonces.size).toBe(50);
  });

  it('encodes the longest accepted nonce correctly', () => {
    // Not a chunk-boundary test, despite what the implementation's chunking
    // suggests: `CHUNK_SIZE` is 8192 while `MAX_NONCE_LENGTH` is 1024, so
    // the loop in `generateNonce` always runs exactly once for any accepted
    // length and the joins between chunks are unreachable. Mutating
    // `binaryString +=` to `=` leaves this whole file green, so claiming
    // coverage of that path would be false.
    const nonce = generateNonce(1024);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(nonce.length).toBe(Math.ceil((1024 * 4) / 3));
  });

  it('rejects a non-integer, zero or negative length', () => {
    for (const length of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => generateNonce(length), String(length)).toThrow(RangeError);
    }
  });

  it('rejects a length past the maximum', () => {
    expect(() => generateNonce(1025)).toThrow(RangeError);
    expect(() => generateNonce(1025)).toThrow(/1024/);
  });

  it('throws when crypto.getRandomValues is unavailable', () => {
    const restore = swapGlobal('crypto', undefined);
    try {
      expect(() => generateNonce()).toThrow(/crypto\.getRandomValues/);
    } finally {
      restore();
    }
  });

  it('throws when crypto exists but getRandomValues does not', () => {
    const restore = swapGlobal('crypto', {});
    try {
      expect(() => generateNonce()).toThrow(/crypto\.getRandomValues/);
    } finally {
      restore();
    }
  });

  it('throws when btoa is unavailable', () => {
    const restore = swapGlobal('btoa', undefined);
    try {
      expect(() => generateNonce()).toThrow(/btoa/);
    } finally {
      restore();
    }
  });
});

describe('security/hasCSPDirective', () => {
  afterEach(() => {
    for (const meta of Array.from(
      document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')
    )) {
      meta.remove();
    }
  });

  const setPolicy = (content: string): void => {
    const meta = document.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  };

  it('finds a directive in the meta tag', () => {
    setPolicy("default-src 'self'; script-src 'nonce-abc'");
    expect(hasCSPDirective('script-src')).toBe(true);
    expect(hasCSPDirective('default-src')).toBe(true);
  });

  it('reports a directive that is not present', () => {
    setPolicy("default-src 'self'");
    expect(hasCSPDirective('frame-ancestors')).toBe(false);
  });

  it('reports false with no meta tag at all', () => {
    expect(hasCSPDirective('script-src')).toBe(false);
  });

  it('handles a meta tag with no content attribute', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    document.head.appendChild(meta);

    expect(hasCSPDirective('script-src')).toBe(false);
  });

  it('reports false without a DOM', () => {
    const restore = swapGlobal('document', undefined);
    try {
      expect(hasCSPDirective('script-src')).toBe(false);
    } finally {
      restore();
    }
  });
});

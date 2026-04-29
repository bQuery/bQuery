/**
 * Shared hashing helpers used by the SSR renderer and the client-side
 * hydration mismatch verifier.
 *
 * The hash is intentionally cheap (DJB2 → base36) — its goal is to spot
 * Server↔Client divergence in dev, not to provide cryptographic guarantees.
 *
 * @module bquery/ssr
 */

/**
 * Computes a stable, very small hash for a string. Used to attach a hydration
 * annotation that the client can compare against during dev-time hydration.
 *
 * Collisions are acceptable here: the goal is a mismatch *warning*, not
 * security.
 *
 * @internal
 */
export const cheapHash = (input: string): string => {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
};

/**
 * The attribute that holds the directive-signature hash on a server-rendered
 * element. Public name so userland can read/write it deterministically.
 */
export const HYDRATION_HASH_ATTR = 'data-bq-h';

/**
 * Collects the directive signature for a virtual element (used by the pure
 * renderer).
 *
 * @internal
 */
export const collectDirectiveSignatureFromAttrs = (
  attributeOrder: readonly string[],
  attributes: Readonly<Record<string, string | undefined>>,
  prefix: string
): string => {
  const parts: string[] = [];
  for (const name of attributeOrder) {
    if (name === HYDRATION_HASH_ATTR) continue;
    if (name.startsWith(`${prefix}-`) || name.startsWith(':')) {
      parts.push(`${name}=${attributes[name] ?? ''}`);
    }
  }
  return parts.join('|');
};

/**
 * Collects the directive signature for a real DOM `Element`. Used by the
 * client-side mismatch verifier and the DOM-backed renderer.
 *
 * @internal
 */
export const collectDirectiveSignatureFromElement = (el: Element, prefix: string): string => {
  const parts: string[] = [];
  // Iterate in attribute insertion order to match the pure renderer.
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === HYDRATION_HASH_ATTR) continue;
    if (attr.name.startsWith(`${prefix}-`) || attr.name.startsWith(':')) {
      parts.push(`${attr.name}=${attr.value}`);
    }
  }
  return parts.join('|');
};

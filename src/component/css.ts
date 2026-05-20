/**
 * `css` tagged template literal helper for component styles.
 *
 * Produces a {@link ComponentStyles} payload that can be assigned to
 * {@link ComponentDefinition.styles}. When the host environment supports
 * Constructable Stylesheets, the underlying CSS is shared across all
 * instances via `document.adoptedStyleSheets`; otherwise it falls back to a
 * traditional `<style>` element rendered inside the shadow root.
 *
 * Interpolated values are HTML/CSS-escaped to prevent stylesheet injection.
 *
 * @example
 * ```ts
 * import { component, css, html } from '@bquery/bquery/component';
 *
 * const accent = '#0066cc';
 * component('themed-card', {
 *   styles: css`
 *     :host { display: block; padding: 1rem; }
 *     h2 { color: ${accent}; }
 *   `,
 *   render() { return html`<h2>Hello</h2>`; },
 * });
 * ```
 *
 * @module bquery/component
 */

const COMPONENT_STYLES_MARKER: unique symbol = Symbol('bquery.componentStyles');

/**
 * Opaque payload returned by {@link css}.
 *
 * It coerces to its underlying string via `toString()` so that existing
 * `styles: string` consumers continue to work unchanged.
 */
export interface ComponentStyles {
  readonly [COMPONENT_STYLES_MARKER]: true;
  readonly text: string;
  toString(): string;
  /**
   * Construct a shared `CSSStyleSheet` (cached per text) for use with
   * `adoptedStyleSheets`. Returns `null` in environments without support.
   */
  toAdoptableSheet(): CSSStyleSheet | null;
}

/**
 * Type guard: is the given value a {@link ComponentStyles} payload?
 */
export const isComponentStyles = (value: unknown): value is ComponentStyles => {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ComponentStyles)[COMPONENT_STYLES_MARKER] === true
  );
};

/**
 * Sanitize an interpolated value for safe embedding into CSS.
 *
 * - Numbers and booleans are converted via `String()`.
 * - Strings have characters that could escape a CSS value, attribute, or
 *   comment removed (`<`, `>`, backslashes, control characters, and the
 *   `/* … *\/` comment sequence).
 * - `null` / `undefined` collapse to the empty string.
 * - {@link ComponentStyles} interpolations are inlined as plain text so
 *   utility partials can be composed.
 */
const escapeCssValue = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isComponentStyles(value)) return value.text;
  const str = String(value);
  const sanitized = str
    .replace(/\u0000/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/<\/?/g, '');
  return sanitized.replace(/["'{};\\]/g, (char) => `\\${char.codePointAt(0)?.toString(16)} `);
};

const sheetCache = new WeakMap<typeof globalThis, Map<string, CSSStyleSheet>>();

const supportsConstructableStylesheets = (
  ctor: unknown
): ctor is typeof CSSStyleSheet => {
  if (typeof ctor !== 'function') return false;
  const proto = (ctor as { prototype?: { replaceSync?: unknown } }).prototype;
  return typeof proto?.replaceSync === 'function';
};

const getOrCreateSheet = (text: string): CSSStyleSheet | null => {
  const ctor = (globalThis as unknown as { CSSStyleSheet?: typeof CSSStyleSheet }).CSSStyleSheet;
  if (!supportsConstructableStylesheets(ctor)) return null;
  let cache = sheetCache.get(globalThis);
  if (!cache) {
    cache = new Map();
    sheetCache.set(globalThis, cache);
  }
  let sheet = cache.get(text);
  if (!sheet) {
    try {
      sheet = new ctor();
      (sheet as CSSStyleSheet & { replaceSync(text: string): void }).replaceSync(text);
      cache.set(text, sheet);
    } catch {
      return null;
    }
  }
  return sheet;
};

const makeStyles = (text: string): ComponentStyles => ({
  [COMPONENT_STYLES_MARKER]: true,
  text,
  toString(): string {
    return text;
  },
  toAdoptableSheet(): CSSStyleSheet | null {
    return getOrCreateSheet(text);
  },
});

/**
 * Tagged template literal that produces a {@link ComponentStyles} payload.
 */
export const css = (strings: TemplateStringsArray, ...values: unknown[]): ComponentStyles => {
  let text = '';
  for (let i = 0; i < strings.length; i += 1) {
    text += strings[i];
    if (i < values.length) text += escapeCssValue(values[i]);
  }
  return makeStyles(text);
};

/**
 * Attempt to apply a `ComponentStyles` payload to a shadow root via
 * `adoptedStyleSheets`. Returns `true` on success; on failure (no support, or
 * sheet construction failed) callers should fall back to a `<style>` element.
 */
export const applyAdoptedStyles = (
  root: ShadowRoot,
  styles: ComponentStyles
): boolean => {
  const sheet = styles.toAdoptableSheet();
  if (!sheet) return false;
  try {
    const current = root.adoptedStyleSheets ?? [];
    if (!current.includes(sheet)) {
      root.adoptedStyleSheets = [...current, sheet];
    }
    return true;
  } catch {
    return false;
  }
};

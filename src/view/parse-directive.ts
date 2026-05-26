/**
 * Directive name parsing — splits `name[:arg][.mod1[-param]][.mod2[-param]]`
 * into its structural pieces. Used by the view pipeline after stripping the
 * `bq-` prefix from attribute names like `bq-on:click.stop.prevent`,
 * `bq-model.lazy.trim`, or `bq-bind:href.eager`.
 *
 * @module bquery/view
 */

import { isPrototypePollutionKey } from '../core/utils/object';

/**
 * Parsed form of a directive attribute name.
 *
 * @since 1.14.0
 */
export type ParsedDirective = {
  /** The base directive name (e.g. `'on'`, `'model'`, `'bind'`, `'text'`). */
  directive: string;
  /**
   * The directive argument when present. For `bq-on:click` this is `'click'`,
   * for `bq-bind:href` it is `'href'`. `null` for argumentless directives.
   */
  arg: string | null;
  /** Set of bare modifiers (e.g. `Set { 'stop', 'prevent', 'self' }`). */
  modifiers: Set<string>;
  /**
   * Modifiers with numeric/string parameters parsed from `mod-param` shape.
   * Example: `bq-on:input.debounce-300` → `{ debounce: '300' }`.
   *
   * The same name in this map and `modifiers` is allowed — the bare set is
   * always populated for modifiers that include a parameter so that simple
   * `modifiers.has('debounce')` checks still work.
   */
  modParams: Record<string, string>;
};

/**
 * Parses a directive name after removing the leading `bq-` attribute prefix.
 *
 * Examples:
 * - `'text'` → `{ directive: 'text', arg: null, modifiers: ∅, modParams: {} }`
 * - `'on:click.stop.prevent'` → `{ directive: 'on', arg: 'click', modifiers: {stop, prevent}, modParams: {} }`
 * - `'model.debounce-300.trim'` → `{ directive: 'model', arg: null, modifiers: {debounce, trim}, modParams: { debounce: '300' } }`
 *
 * @since 1.14.0
 */
export const parseDirective = (name: string): ParsedDirective => {
  // Split off modifiers first (everything after the first '.').
  let head = name;
  const modifierParts: string[] = [];
  const firstDot = name.indexOf('.');
  if (firstDot !== -1) {
    head = name.slice(0, firstDot);
    const rest = name.slice(firstDot + 1);
    if (rest.length > 0) {
      modifierParts.push(...rest.split('.').filter(Boolean));
    }
  }

  // Split directive vs arg on the first ':'.
  let directive = head;
  let arg: string | null = null;
  const colonIdx = head.indexOf(':');
  if (colonIdx !== -1) {
    directive = head.slice(0, colonIdx);
    arg = head.slice(colonIdx + 1) || null;
  }

  const modifiers = new Set<string>();
  const modParams = Object.create(null) as Record<string, string>;
  for (const mod of modifierParts) {
    const dashIdx = mod.indexOf('-');
    if (dashIdx === -1) {
      if (!isPrototypePollutionKey(mod)) {
        modifiers.add(mod);
      }
    } else {
      const key = mod.slice(0, dashIdx);
      const value = mod.slice(dashIdx + 1);
      if (key && !isPrototypePollutionKey(key)) {
        modifiers.add(key);
        modParams[key] = value;
      }
    }
  }

  return { directive, arg, modifiers, modParams };
};

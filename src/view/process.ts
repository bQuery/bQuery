import type { CleanupFn } from '../reactive/index';
import { detectDevEnvironment } from '../core/env';
import { getCustomDirective } from './custom-directives';
import { TRANSITION_ATTRS } from './directives/transitions';
import { parseDirective, type ParsedDirective } from './parse-directive';
import type { BindingContext, DirectiveHandler } from './types';

/**
 * Companion attributes consumed by other directives rather than processed as
 * standalone directives: `bq-key` (read by `bq-for`) and the transition
 * attributes (read by `bq-if` / `bq-show` / `bq-for`). They are skipped
 * silently so they never trigger the unknown-directive warning.
 * @internal
 */
const PASSIVE_DIRECTIVES = new Set<string>(['key', ...TRANSITION_ATTRS]);

/**
 * Upper bound for {@link parsedDirectives}, mirroring the expression caches in
 * `evaluate.ts`. The set of distinct directive attribute names in an app is
 * small; the bound only guards generated names (`bq-bind:data-item-<uuid>`)
 * from growing the map for the lifetime of a long-lived SPA.
 * @internal
 */
const MAX_PARSED_DIRECTIVES = 500;

/**
 * Memoized {@link parseDirective} results. Attribute names are a small finite
 * set per app, but every bq-for row clone re-parses them — cache the parsed
 * form once per raw name. Cached objects (including their `modifiers` Set)
 * are shared and must never be mutated by consumers.
 * @internal
 */
const parsedDirectives = new Map<string, ParsedDirective>();

const parseDirectiveCached = (name: string): ParsedDirective => {
  let parsed = parsedDirectives.get(name);
  if (!parsed) {
    // Dropping the whole map is fine: entries are pure derivations of their
    // key, and already-handed-out objects stay valid for their holders.
    if (parsedDirectives.size >= MAX_PARSED_DIRECTIVES) {
      parsedDirectives.clear();
    }
    parsed = parseDirective(name);
    parsedDirectives.set(name, parsed);
  }
  return parsed;
};

/**
 * Per-prefix attribute names used on the per-element hot path. The prefix set
 * is tiny (usually just `bq`), so these template strings are built once
 * instead of once per element.
 * @internal
 */
type PrefixAttrs = { dash: string; cloak: string; pre: string };

const prefixAttrsCache = new Map<string, PrefixAttrs>();

const getPrefixAttrs = (prefix: string): PrefixAttrs => {
  let attrs = prefixAttrsCache.get(prefix);
  if (!attrs) {
    attrs = {
      dash: `${prefix}-`,
      cloak: `${prefix}-cloak`,
      pre: `${prefix}-pre`,
    };
    prefixAttrsCache.set(prefix, attrs);
  }
  return attrs;
};

/**
 * Registry mapping each built-in directive name to its handler. `bind` and `on`
 * are factories (they take the bound attribute/event name); the rest are plain
 * handlers invoked when their `bq-*` attribute is processed.
 */
export type DirectiveHandlers = {
  text: DirectiveHandler;
  error: DirectiveHandler;
  aria: DirectiveHandler;
  html: DirectiveHandler;
  htmlSafe: DirectiveHandler;
  if: DirectiveHandler;
  show: DirectiveHandler;
  class: DirectiveHandler;
  style: DirectiveHandler;
  model: DirectiveHandler;
  ref: DirectiveHandler;
  for: DirectiveHandler;
  once: DirectiveHandler;
  init: DirectiveHandler;
  memo: DirectiveHandler;
  bind: (attrName: string) => DirectiveHandler;
  on: (eventName: string, modifiers?: Set<string>) => DirectiveHandler;
};

/**
 * Processes a single element for directives.
 * @internal
 */
export const processElement = (
  el: Element,
  context: BindingContext,
  prefix: string,
  cleanups: CleanupFn[],
  handlers: DirectiveHandlers
): boolean => {
  const prefixAttrs = getPrefixAttrs(prefix);

  // bq-cloak: remove the marker once mount reaches the element. Authors use
  // `[bq-cloak] { display: none }` to hide pre-hydration markup.
  if (el.hasAttribute(prefixAttrs.cloak)) {
    el.removeAttribute(prefixAttrs.cloak);
  }

  // bq-pre: skip directive processing entirely for this element and its
  // descendants. Honor it before reading any other attributes so the marker
  // remains an escape hatch with predictable semantics.
  if (el.hasAttribute(prefixAttrs.pre)) {
    el.removeAttribute(prefixAttrs.pre);
    return false;
  }

  // Snapshot: directive handlers (including custom ones) may mutate the
  // element's attributes while we iterate.
  const attributes = Array.from(el.attributes);

  // bq-for wins over every other directive on the same element: the element is
  // a template that bq-for clones per item, so binding effects for sibling
  // directives here would attach them to the discarded original. Scan for it
  // before dispatching anything else, regardless of attribute order.
  for (const attr of attributes) {
    const { name: attributeName } = attr;
    if (!attributeName.startsWith(prefixAttrs.dash)) continue;
    const { directive } = parseDirectiveCached(attributeName.slice(prefixAttrs.dash.length));
    if (directive === 'for') {
      handlers.for(el, attr.value, context, cleanups);
      return false; // Don't process children, bq-for handles it
    }
  }

  let shouldProcessChildren = true;

  for (const attr of attributes) {
    const { name: attributeName, value } = attr;

    if (!attributeName.startsWith(prefixAttrs.dash)) continue;

    const rawDirective = attributeName.slice(prefixAttrs.dash.length); // Remove prefix and dash
    const { directive, arg, modifiers } = parseDirectiveCached(rawDirective);

    // Skip companion attributes (bq-key, bq-transition, bq-in, bq-out, …) that
    // are read by their owning directive rather than processed here — unless a
    // plugin has explicitly registered a custom directive under that name, in
    // which case the registration wins instead of being silently shadowed.
    if (PASSIVE_DIRECTIVES.has(directive) && !getCustomDirective(directive)) continue;

    // Handle other directives
    if (directive === 'text') {
      handlers.text(el, value, context, cleanups);
    } else if (directive === 'error') {
      handlers.error(el, value, context, cleanups);
    } else if (directive === 'aria') {
      handlers.aria(el, value, context, cleanups);
    } else if (directive === 'html') {
      handlers.html(el, value, context, cleanups);
      // The subtree is owned by the reactive HTML write — binding directives on
      // the initial children would leak their effects on the first re-render.
      shouldProcessChildren = false;
    } else if (directive === 'html-safe') {
      handlers.htmlSafe(el, value, context, cleanups);
      shouldProcessChildren = false;
    } else if (directive === 'if') {
      handlers.if(el, value, context, cleanups);
    } else if (directive === 'show') {
      handlers.show(el, value, context, cleanups);
    } else if (directive === 'class') {
      handlers.class(el, value, context, cleanups);
    } else if (directive === 'style') {
      handlers.style(el, value, context, cleanups);
    } else if (directive === 'model') {
      handlers.model(el, value, context, cleanups);
    } else if (directive === 'ref') {
      handlers.ref(el, value, context, cleanups);
    } else if (directive === 'once') {
      handlers.once(el, value, context, cleanups);
    } else if (directive === 'init') {
      handlers.init(el, value, context, cleanups);
    } else if (directive === 'memo') {
      handlers.memo(el, value, context, cleanups);
    } else if (directive === 'bind' && arg) {
      handlers.bind(arg)(el, value, context, cleanups);
    } else if (directive === 'on' && arg) {
      handlers.on(arg, modifiers)(el, value, context, cleanups);
    } else {
      // Check for custom directives registered via plugins. Custom directive
      // names are matched against the directive head without modifiers,
      // including any parsed argument (e.g. "tooltip:click"), to keep the API
      // back-compatible when modifiers are appended at call sites.
      const directiveHead = arg ? `${directive}:${arg}` : directive;
      const customHandler =
        getCustomDirective(directiveHead) ||
        (directiveHead !== rawDirective ? getCustomDirective(rawDirective) : undefined) ||
        (directiveHead !== directive ? getCustomDirective(directive) : undefined);
      if (customHandler) {
        customHandler(el, value, context, cleanups);
      } else if (
        detectDevEnvironment() &&
        typeof console !== 'undefined' &&
        typeof console.warn === 'function'
      ) {
        console.warn(
          `[bQuery][view] Unknown directive "${attributeName}" (parsed as "${directive}") on <${el.tagName.toLowerCase()}>. This may be a typo or a missing custom directive registration.`
        );
      }
    }
  }

  return shouldProcessChildren;
};

/**
 * Recursively processes children of an element.
 * @internal
 */
export const processChildren = (
  el: Element,
  context: BindingContext,
  prefix: string,
  cleanups: CleanupFn[],
  handlers: DirectiveHandlers
): void => {
  // Snapshot before processing: directives may replace a child with a
  // placeholder (bq-if, bq-for), insert rendered rows after it, or remove a
  // sibling outright (bq-init, custom directives). A live sibling walk would
  // step into freshly inserted rows that bq-for already processed, and would
  // silently drop the remaining original children as soon as the node it is
  // standing on leaves the tree.
  const children = Array.from(el.children);
  for (const child of children) {
    const shouldProcessChildren = processElement(child, context, prefix, cleanups, handlers);
    if (shouldProcessChildren) {
      processChildren(child, context, prefix, cleanups, handlers);
    }
  }
};

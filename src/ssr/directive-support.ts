/**
 * Shared SSR directive-parity helpers.
 *
 * Both the DOM-free renderer (`renderer.ts`) and the legacy DOM-backed
 * renderer (`render.ts`) consume these helpers so the interactive directives
 * `bq-model` and `bq-on` render identically on every backend, and so the
 * "supported vs client-only" boundary is enforced in exactly one place.
 *
 * See GitHub issue #128 — *SSR interactive-directive parity*.
 *
 * @module bquery/ssr
 * @internal
 */

/**
 * Which directives the server evaluates into hydration-ready markup.
 *
 * - `'static'` (default, backwards compatible) renders the structural and
 *   binding directives only: `bq-text`, `bq-html`, `bq-if`, `bq-show`,
 *   `bq-for`, `bq-class`, `bq-style`, `bq-bind:*`.
 * - `'full'` additionally renders the interactive directives `bq-model`
 *   (initial value/`checked`/selected option) and `bq-on:*` (emits a
 *   `data-bq-on` hydration marker so the client can attach listeners on
 *   hydrate — handlers are **never** executed on the server).
 */
export type SSRDirectiveMode = 'full' | 'static';

/**
 * What to do when the renderer meets a directive it cannot server-render
 * (e.g. `bq-model`/`bq-on` in `'static'` mode, or a client-only directive
 * such as `bq-ref`). `'ignore'` is the default and preserves the historical
 * silent behaviour.
 */
export type UnsupportedDirectiveStrategy = 'warn' | 'throw' | 'ignore';

/** Structural/binding directives rendered in every mode. */
export const SSR_STATIC_DIRECTIVES = [
  'text',
  'html',
  'if',
  'show',
  'for',
  'class',
  'style',
  'bind',
] as const;

/** Interactive directives rendered only when `directives: 'full'`. */
export const SSR_INTERACTIVE_DIRECTIVES = ['model', 'on'] as const;

/** Directives that have no server representation and only run on the client. */
export const SSR_CLIENT_ONLY_DIRECTIVES = ['ref', 'init', 'memo', 'once', 'error'] as const;

/**
 * Hydration marker attribute emitted for `bq-on:*` in `'full'` mode. Holds a
 * space-separated, de-duplicated list of event names so the client can attach
 * listeners even when the original `bq-on:*` attributes were stripped.
 */
export const SSR_ON_MARKER_ATTR = 'data-bq-on';

/**
 * Extracts the directive head (the part after the prefix, before any `:` arg
 * or `.` modifier) from an attribute name. Returns `null` for non-directive
 * attributes.
 *
 * @example directiveHead('bq-on:keydown.enter', 'bq') === 'on'
 */
export const directiveHead = (attrName: string, prefix: string): string | null => {
  const head = `${prefix}-`;
  if (!attrName.startsWith(head)) return null;
  const rest = attrName.slice(head.length);
  const match = rest.match(/^[^:.]+/);
  return match ? match[0] : null;
};

/**
 * Parses the base event name from a `bq-on:*` attribute, stripping any
 * modifiers. Returns `null` when the attribute is not a `bq-on:*` directive.
 *
 * @example parseOnEventName('bq-on:keydown.enter.prevent', 'bq') === 'keydown'
 */
export const parseOnEventName = (attrName: string, prefix: string): string | null => {
  const head = `${prefix}-on:`;
  if (!attrName.startsWith(head)) return null;
  const base = attrName.slice(head.length).split('.')[0].trim();
  return base.length > 0 ? base : null;
};

/**
 * Collects the de-duplicated set of base event names referenced by the
 * `bq-on:*` attributes in `attrNames`, preserving first-seen order.
 */
export const collectOnEvents = (attrNames: Iterable<string>, prefix: string): string[] => {
  const events: string[] = [];
  for (const name of attrNames) {
    const event = parseOnEventName(name, prefix);
    if (event && !events.includes(event)) events.push(event);
  }
  return events;
};

/** Classification of a directive the renderer chose not to evaluate. */
export type UnsupportedDirectiveKind = 'interactive' | 'client-only';

/**
 * Decides whether a directive head is unsupported for the active mode. Returns
 * `null` when the directive is handled (so callers should not report it).
 */
export const classifyUnsupportedDirective = (
  head: string,
  mode: SSRDirectiveMode
): UnsupportedDirectiveKind | null => {
  if (head === 'model' || head === 'on') {
    return mode === 'full' ? null : 'interactive';
  }
  if ((SSR_CLIENT_ONLY_DIRECTIVES as readonly string[]).includes(head)) {
    return 'client-only';
  }
  return null;
};

/**
 * Reports a directive that the SSR renderer could not evaluate, according to
 * the configured strategy. `'ignore'` is a no-op; `'warn'` logs a single
 * `console.warn`; `'throw'` raises so misuse fails loudly in tests/CI.
 */
export const reportUnsupportedDirective = (
  attrName: string,
  tag: string,
  kind: UnsupportedDirectiveKind,
  strategy: UnsupportedDirectiveStrategy
): void => {
  if (strategy === 'ignore') return;
  const hint =
    kind === 'interactive'
      ? `Pass { directives: 'full' } to renderToString() to server-render it.`
      : `It is client-only and attaches during hydration.`;
  const message = `[bQuery SSR] Directive "${attrName}" on <${tag}> is not server-rendered. ${hint}`;
  if (strategy === 'throw') {
    throw new Error(message);
  }
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(message);
  }
};

/**
 * Computes how `bq-model` should be reflected for a form control, independent
 * of the underlying node representation. The renderer applies the returned
 * instruction to its own node type (virtual node or live DOM element).
 */
export type ModelReflection =
  | { kind: 'attr'; name: 'value'; value: string }
  | { kind: 'boolean-attr'; name: 'checked'; present: boolean }
  | { kind: 'text'; value: string }
  | { kind: 'select'; value: string }
  | { kind: 'none' };

/**
 * Resolves the `bq-model` reflection for an `<input>`/`<textarea>`/`<select>`
 * given its tag, `type`, and (for radios) its `value` attribute.
 */
export const resolveModelReflection = (
  tag: string,
  type: string | undefined,
  ownValue: string | undefined,
  modelValue: unknown
): ModelReflection => {
  const lowerTag = tag.toLowerCase();
  if (lowerTag === 'input') {
    const inputType = (type ?? 'text').toLowerCase();
    if (inputType === 'checkbox') {
      return { kind: 'boolean-attr', name: 'checked', present: Boolean(modelValue) };
    }
    if (inputType === 'radio') {
      return {
        kind: 'boolean-attr',
        name: 'checked',
        present: String(modelValue ?? '') === (ownValue ?? ''),
      };
    }
    return { kind: 'attr', name: 'value', value: String(modelValue ?? '') };
  }
  if (lowerTag === 'textarea') {
    return { kind: 'text', value: String(modelValue ?? '') };
  }
  if (lowerTag === 'select') {
    return { kind: 'select', value: String(modelValue ?? '') };
  }
  return { kind: 'none' };
};

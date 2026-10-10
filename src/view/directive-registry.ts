/**
 * Metadata for every built-in `bq-*` directive.
 *
 * The single source for editor tooling: `scripts/generate-editor-data.mjs`
 * turns it into the VS Code custom data file (`editor/html-custom-data.json`),
 * and `tests/editor-data.test.ts` fails when a directive handled in
 * `process.ts` is missing here or the generated file is stale.
 *
 * @module bquery/view
 * @internal
 */

import { TRANSITION_PRESET_NAMES } from './directives/transitions';

/** Describes one built-in directive for documentation and editor tooling. */
export interface DirectiveInfo {
  /** Directive name without the `bq-` prefix, e.g. `'if'` or `'html-safe'`. */
  name: string;
  /** One-paragraph Markdown description shown on hover. */
  description: string;
  /** Anchor in the view guide (`https://bquery.js.org/guide/view#<anchor>`). */
  docs: string;
  /**
   * `'expression'` when the value is a bQuery expression, `'none'` for marker
   * attributes, `'literal'` for a fixed keyword or number.
   */
  value: 'expression' | 'none' | 'literal';
  /** Allowed literal values, when `value` is `'literal'`. */
  values?: readonly string[];
  /**
   * For `bq-on:` / `bq-bind:`: the argument kind, so editors can offer
   * `bq-on:click`, `bq-bind:href`, … as separate attributes.
   */
  argument?: 'event' | 'attribute';
  /** Companion attribute read by another directive rather than processed itself. */
  companion?: boolean;
}

/** Every built-in directive, in the order the view guide documents them. */
export const BUILT_IN_DIRECTIVES: readonly DirectiveInfo[] = Object.freeze([
  {
    name: 'text',
    value: 'expression',
    docs: 'bq-text',
    description:
      'Sets the element’s text content from an expression. The value is written as text, never parsed as HTML.\n\n```html\n<span bq-text="user.name"></span>\n```',
  },
  {
    name: 'html',
    value: 'expression',
    docs: 'bq-html',
    description:
      'Renders the expression as HTML, sanitized with bQuery’s sanitizer — unless the view was mounted with `sanitize: false`, which writes it raw (use `bq-html-safe` to sanitize regardless). Child directives inside the rendered markup are not bound.\n\n```html\n<div bq-html="post.body"></div>\n```',
  },
  {
    name: 'html-safe',
    value: 'expression',
    docs: 'directive-reference-1-15-0-frozen',
    description:
      'Like `bq-html`, but always sanitizes before insertion, even in a view mounted with `sanitize: false`.',
  },
  {
    name: 'if',
    value: 'expression',
    docs: 'bq-if',
    description:
      'Mounts the element only while the expression is truthy. Combine with `bq-transition` for enter/leave animations.\n\n```html\n<p bq-if="items.length === 0">Nothing here yet.</p>\n```',
  },
  {
    name: 'show',
    value: 'expression',
    docs: 'bq-show',
    description:
      'Toggles visibility (`display: none`) based on the expression; the element stays in the DOM.',
  },
  {
    name: 'class',
    value: 'expression',
    docs: 'bq-class',
    description:
      'Reactive classes from an object (`{ active: isActive }`), an array or a string expression.',
  },
  {
    name: 'style',
    value: 'expression',
    docs: 'bq-style',
    description: 'Reactive inline styles from an object expression, e.g. `{ color: tint }`.',
  },
  {
    name: 'model',
    value: 'expression',
    docs: 'bq-model',
    description:
      'Two-way binding for `<input>`, `<select>`, `<textarea>`, checkboxes and radios. The expression must resolve to a writable signal.\n\n```html\n<input bq-model="query" />\n```',
  },
  {
    name: 'error',
    value: 'expression',
    docs: 'bq-error',
    description:
      'Renders a validation message from a signal, form field or `{ error }` object; toggles `hidden` and adds `role="alert"` / `aria-live`.',
  },
  {
    name: 'aria',
    value: 'expression',
    docs: 'bq-aria',
    description:
      "Binds an object of ARIA attributes, e.g. `{ expanded: open, controls: 'menu' }` → `aria-expanded`, `aria-controls`.",
  },
  {
    name: 'bind',
    value: 'expression',
    argument: 'attribute',
    docs: 'bq-bind-attr',
    description:
      'Binds an attribute to an expression: `bq-bind:href="url"`. `false`, `null` and `undefined` remove the attribute.',
  },
  {
    name: 'on',
    value: 'expression',
    argument: 'event',
    docs: 'bq-on-event',
    description:
      'Attaches an event handler. Modifiers: `.prevent`, `.stop`, `.once`, `.passive`, `.capture`, `.self`, `.left`, `.right`, `.middle`, `.ctrl`, `.alt`, `.shift`, `.meta` and key filters such as `.enter`.\n\n```html\n<form bq-on:submit.prevent="save()"></form>\n```',
  },
  {
    name: 'for',
    value: 'expression',
    docs: 'bq-for',
    description:
      'Renders the element once per array item: `bq-for="item in items"` or `bq-for="(item, index) in items"`. Use `bq-key` for keyed reconciliation and `bq-animate="flip"` for move animations.',
  },
  {
    name: 'key',
    value: 'expression',
    companion: true,
    docs: 'bq-for',
    description: 'Stable identity for a `bq-for` item, e.g. `bq-key="item.id"`.',
  },
  {
    name: 'ref',
    value: 'expression',
    docs: 'bq-ref',
    description: 'Stores the element in the named ref / signal of the binding context.',
  },
  {
    name: 'once',
    value: 'expression',
    docs: 'directive-reference-1-15-0-frozen',
    description: 'Evaluates the expression exactly once on mount, untracked.',
  },
  {
    name: 'init',
    value: 'expression',
    docs: 'directive-reference-1-15-0-frozen',
    description: 'Runs the expression on mount only, e.g. to load data.',
  },
  {
    name: 'memo',
    value: 'expression',
    docs: 'directive-reference-1-15-0-frozen',
    description:
      'Marker directive: evaluates its expression once, untracked; the subtree still binds normally (no caching).',
  },
  {
    name: 'cloak',
    value: 'none',
    docs: 'bq-cloak',
    description:
      'Removed when the view mounts the element. Pair with `[bq-cloak] { display: none }` to hide un-rendered templates.',
  },
  {
    name: 'pre',
    value: 'none',
    docs: 'bq-pre',
    description:
      'Skips directive processing for this element and its subtree, keeping the literal source.',
  },
  {
    name: 'transition',
    value: 'literal',
    values: TRANSITION_PRESET_NAMES,
    companion: true,
    docs: 'companion-attributes',
    description:
      'Named enter/leave transition preset for `bq-if`, `bq-show` and `bq-for`, used for both directions.',
  },
  {
    name: 'in',
    value: 'literal',
    values: TRANSITION_PRESET_NAMES,
    companion: true,
    docs: 'companion-attributes',
    description: 'Enter-only transition preset (overrides `bq-transition` for enter).',
  },
  {
    name: 'out',
    value: 'literal',
    values: TRANSITION_PRESET_NAMES,
    companion: true,
    docs: 'companion-attributes',
    description: 'Leave-only transition preset (overrides `bq-transition` for leave).',
  },
  {
    name: 'transition-duration',
    value: 'literal',
    companion: true,
    docs: 'companion-attributes',
    description: 'Transition duration in milliseconds (default `200`; FLIP default `300`).',
  },
  {
    name: 'transition-easing',
    value: 'literal',
    companion: true,
    docs: 'companion-attributes',
    description: 'CSS easing for the transition (default `ease`; FLIP default `ease-out`).',
  },
  {
    name: 'animate',
    value: 'literal',
    values: ['flip'],
    companion: true,
    docs: 'companion-attributes',
    description:
      '`bq-animate="flip"` animates `bq-for` items to their new position when the list reorders.',
  },
] satisfies DirectiveInfo[]);

/**
 * bQuery Testing — 1.14+ extension helpers.
 *
 * Builds on the existing `renderComponent` / `flushEffects` / `fireEvent` /
 * `waitFor` primitives with:
 *
 * - Auto-cleanup tracking (`cleanup`, `autoCleanup`).
 * - Screen queries (`getByRole`, `getByText`, `getByTestId`, ...).
 * - `userEvent` namespace (composed real-user-style interactions).
 * - `fireEvent.*` shortcut methods.
 * - Reactive helpers (`mockComputed`, `mockEffect`, `tick`, `flushPromises`).
 * - Mocks (`mockStore`, `mockI18n`, `mockForm`, `mockFetch`, `mockWebSocket`).
 * - Snapshot / a11y helpers (`prettyDOM`, `expectAccessible`).
 *
 * Every helper is SSR-safe at import time (no top-level DOM access).
 *
 * @module bquery/testing
 */

import { computed, effect, signal, type Signal } from '../reactive/index';
import {
  __getTextInputElement,
  __setRenderComponentTracker,
  fireEvent,
  flushEffects,
} from './testing';
import type { ByRoleOptions, WaitForOptions } from './types';

// ---------------------------------------------------------------------------
// Auto cleanup
// ---------------------------------------------------------------------------

type Cleanable = { unmount: () => void };

const pendingMounts: Cleanable[] = [];

/** @internal — register a render result for {@link cleanup}. */
export const __trackMount = (result: Cleanable): void => {
  pendingMounts.push(result);
};

__setRenderComponentTracker(__trackMount);

/**
 * Unmount every render result tracked since the last {@link cleanup} call.
 *
 * Safe to call repeatedly; idempotent when no mounts are pending.
 */
export const cleanup = (): void => {
  while (pendingMounts.length > 0) {
    const m = pendingMounts.pop();
    try {
      m?.unmount();
    } catch {
      // ignore
    }
  }
};

/**
 * Install before/after hooks (compatible with `bun:test`) that run
 * {@link cleanup} after every test.
 */
export const autoCleanup = (
  beforeEach: (fn: () => void) => void,
  afterEach: (fn: () => void) => void
): void => {
  // beforeEach is accepted for symmetry; cleanup runs only afterEach.
  beforeEach(() => undefined);
  afterEach(() => cleanup());
};

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------

/** Wait one microtask + flush effects. */
export const tick = async (): Promise<void> => {
  await Promise.resolve();
  flushEffects();
};

/** Alias of {@link tick}. */
export const nextTick = tick;

/**
 * Drain micro- and macro-task queues, then flush reactive effects.
 */
export const flushPromises = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  flushEffects();
};

/**
 * Synchronously run any frame-scheduled work (motion timelines, etc.).
 * In the default happy-dom environment this is a no-op + `flushEffects()`.
 */
export const runScheduled = (): void => {
  flushEffects();
};

// ---------------------------------------------------------------------------
// userEvent
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getSelectElement = (el: Element): HTMLSelectElement => {
  if (el.tagName.toLowerCase() === 'select') {
    return el as HTMLSelectElement;
  }

  throw new Error('bQuery testing: userEvent.selectOptions requires a select element');
};

/**
 * `el` and its ancestors in the flattened tree (slotted nodes go through their
 * slot, shadow roots through their host), outermost first.
 */
const getAncestry = (el: Element): Element[] => {
  const chain: Element[] = [];
  let node: Node | null = el;
  while (node) {
    if (node.nodeType === 1) {
      chain.unshift(node as Element);
      node = (node as Element).assignedSlot ?? node.parentNode;
    } else {
      node = node.nodeType === 11 ? ((node as ShadowRoot).host ?? null) : node.parentNode;
    }
  }
  return chain;
};

/**
 * Higher-level interactions composed from {@link fireEvent}. Every action
 * flushes effects + microtasks before returning so consumers can `await` it.
 */
const pressAndClick = (el: Element, detail: number): void => {
  fireEvent(el, 'mousedown', { detail });
  fireEvent(el, 'mouseup', { detail });
  fireEvent(el, 'click', { detail });
};

export const userEvent = {
  async click(el: Element): Promise<void> {
    pressAndClick(el, 1);
    await tick();
  },
  async dblClick(el: Element): Promise<void> {
    pressAndClick(el, 1);
    await tick();
    pressAndClick(el, 2);
    await tick();
    fireEvent(el, 'dblclick');
    await tick();
  },
  /**
   * Moves the mouse onto `el` from outside the document: a bubbling
   * `mouseover` on `el`, then a non-bubbling `mouseenter` on every element
   * entered — the outermost ancestor first, `el` last.
   */
  async hover(el: Element): Promise<void> {
    fireEvent(el, 'mouseover');
    for (const entered of getAncestry(el)) fireEvent(entered, 'mouseenter');
    await tick();
  },
  /**
   * Moves the mouse off `el` and out of the document: a bubbling `mouseout`
   * on `el`, then a non-bubbling `mouseleave` on `el` and each ancestor.
   */
  async unhover(el: Element): Promise<void> {
    fireEvent(el, 'mouseout');
    for (const left of getAncestry(el).reverse()) fireEvent(left, 'mouseleave');
    await tick();
  },
  /**
   * Types `text` one character at a time: `keydown`, `keypress`,
   * `beforeinput`, `input` (with the character appended), then `keyup`. As in
   * a browser, cancelling `keydown`, `keypress` or `beforeinput` keeps the
   * character out of the value and skips the events after it (except `keyup`).
   */
  async type(el: Element, text: string, opts?: { delay?: number }): Promise<void> {
    const input = __getTextInputElement(el);
    for (const ch of text) {
      const insert =
        fireEvent.keyDown(el, { key: ch }) &&
        fireEvent(el, 'keypress', { key: ch }) &&
        fireEvent(el, 'beforeinput', { inputType: 'insertText', data: ch });
      if (insert) {
        fireEvent.input(el, `${input.value ?? ''}${ch}`, { inputType: 'insertText', data: ch });
      }
      fireEvent.keyUp(el, { key: ch });
      if (opts?.delay) await sleep(opts.delay);
    }
    await tick();
  },
  async clear(el: Element): Promise<void> {
    fireEvent.input(el, '', { inputType: 'deleteContentBackward' });
    fireEvent.change(el, '');
    await tick();
  },
  async selectOptions(el: Element, values: string | string[]): Promise<void> {
    const select = getSelectElement(el);
    const list = Array.isArray(values) ? values : [values];
    for (const opt of Array.from(select.options)) {
      opt.selected = list.includes(opt.value);
    }
    fireEvent(select, 'input');
    fireEvent(select, 'change');
    await tick();
  },
  async tab(): Promise<void> {
    fireEvent.keyDown(document.body, { key: 'Tab' });
    await tick();
  },
  async paste(el: Element, text: string): Promise<void> {
    const input = __getTextInputElement(el);
    fireEvent.input(el, `${input.value ?? ''}${text}`, {
      inputType: 'insertFromPaste',
      data: text,
    });
    fireEvent(el, 'paste');
    await tick();
  },
};

// ---------------------------------------------------------------------------
// Screen queries (shadow-DOM-aware)
// ---------------------------------------------------------------------------

const collectShadowRoots = (root: ParentNode): ParentNode[] => {
  const result: ParentNode[] = [];
  const queue: ParentNode[] = [root];
  const seen = new Set<ParentNode>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    result.push(current);

    const currentShadowRoot = (current as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (currentShadowRoot) {
      queue.push(currentShadowRoot);
    }

    const descendants = (current as Document | Element).querySelectorAll?.('*');
    if (!descendants) continue;
    for (const el of descendants) {
      const shadowRoot = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (shadowRoot) {
        queue.push(shadowRoot);
      }
    }
  }

  return result;
};

const allElements = (root: ParentNode): Element[] => {
  const acc: Element[] = [];
  for (const r of collectShadowRoots(root)) {
    if (typeof r.querySelectorAll !== 'function') continue;
    for (const el of r.querySelectorAll('*')) acc.push(el);
  }
  return acc;
};

const getQueryableRoot = (
  el: Element
): (ParentNode & { querySelector(selector: string): Element | null }) | null => {
  const root = el.getRootNode?.();
  if (
    root &&
    typeof (root as ParentNode & { querySelector?: unknown }).querySelector === 'function'
  ) {
    return root as ParentNode & { querySelector(selector: string): Element | null };
  }
  if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
    return document;
  }
  return null;
};

const escapeAttributeValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const findById = (
  root: ParentNode & { querySelector(selector: string): Element | null },
  id: string
): Element | null => root.querySelector(`[id="${escapeAttributeValue(id)}"]`);

const matchesText = (el: Element, target: string | RegExp): boolean => {
  // Only consider text that appears directly within `el`'s own text children,
  // not descendants — this mirrors @testing-library/dom semantics so a leaf
  // <p> is matched but not its parent <div>.
  const direct = Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => (n as Text).data)
    .join('')
    .trim();
  if (!direct) return false;
  if (typeof target === 'string') return direct === target || direct.includes(target);
  return target.test(direct);
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

/**
 * How CSS hides `el`: `'removed'` for `display: none` (the whole subtree is
 * hidden), `'invisible'` for `visibility: hidden | collapse` (the element's own
 * content is hidden, but a descendant may set `visibility: visible` again).
 * Reads the computed style — so stylesheet rules count — falling back to the
 * inline style where there is no computed value (e.g. a detached element).
 */
const getCssHiding = (el: Element): 'removed' | 'invisible' | null => {
  let display = '';
  let visibility = '';
  try {
    const computed = el.ownerDocument?.defaultView?.getComputedStyle?.(el);
    display = computed?.display ?? '';
    visibility = computed?.visibility ?? '';
  } catch {
    // No style engine — fall back to the inline style below.
  }
  const inline = (el as Partial<HTMLElement>).style;
  display ||= inline?.display ?? '';
  visibility ||= inline?.visibility ?? '';
  if (display === 'none') return 'removed';
  return visibility === 'hidden' || visibility === 'collapse' ? 'invisible' : null;
};

/** Whether `el` itself is hidden by `hidden`, `aria-hidden="true"` or CSS. */
const isHiddenElement = (el: Element): boolean =>
  el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true' || !!getCssHiding(el);

/**
 * Text one node contributes to an accessible name: a text node's data, or for
 * an element its `aria-label`, an image's `alt`, a slot's assigned nodes, or
 * its own content. `exclude`, form controls, non-rendered elements and — unless
 * `includeHidden` — elements hidden by `hidden`, `aria-hidden="true"`,
 * `display: none` or `visibility: hidden` contribute nothing. `textHidden`
 * marks text whose parent is `visibility: hidden`.
 */
const getNodeNameText = (
  child: Node,
  exclude: Element | undefined,
  includeHidden: boolean,
  textHidden: boolean
): string => {
  if (child.nodeType === 3) return textHidden ? '' : (child as Text).data;
  if (child.nodeType !== 1) return '';
  const el = child as Element;
  if (el === exclude) return '';
  const tag = el.tagName.toLowerCase();
  if (/^(input|select|textarea|script|style|template)$/.test(tag)) return '';
  let invisible = false;
  if (!includeHidden) {
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return '';
    const hiding = getCssHiding(el);
    if (hiding === 'removed') return '';
    invisible = hiding === 'invisible';
  }
  const ariaLabel = normalizeWhitespace(el.getAttribute('aria-label') ?? '');
  if (ariaLabel) return invisible ? '' : ` ${ariaLabel} `;
  if (tag === 'img') return invisible ? '' : ` ${el.getAttribute('alt') ?? ''} `;
  if (tag === 'slot') {
    const assigned = (el as HTMLSlotElement).assignedNodes?.({ flatten: true }) ?? [];
    if (assigned.length > 0) {
      // Slotted elements count like children: their own `hidden`, `alt`, `aria-label` apply.
      return assigned
        .map((node) => getNodeNameText(node, exclude, includeHidden, invisible))
        .join('');
    }
  }
  return collectNameText(el, exclude, includeHidden, invisible);
};

/**
 * Text a subtree contributes to an accessible name: text nodes, `alt` of
 * images and `aria-label` of nested elements, skipping `exclude`, nested form
 * controls, non-rendered elements, and subtrees hidden by `hidden`,
 * `aria-hidden="true"`, `display: none` or `visibility: hidden` (unless
 * `includeHidden`, used for a hidden element named by `aria-labelledby`).
 * Slots contribute their assigned (slotted) nodes.
 */
const collectNameText = (
  node: Node,
  exclude?: Element,
  includeHidden = false,
  textHidden = false
): string =>
  Array.from(node.childNodes)
    .map((child) => getNodeNameText(child, exclude, includeHidden, textHidden))
    .join('');

/** `<label>` elements associated with a control: `for`/`id` first, then a wrapping label. */
const getLabelElements = (el: Element): Element[] => {
  const labels: Element[] = [];
  const id = el.getAttribute('id');
  if (id) {
    const root = getQueryableRoot(el) as (ParentNode & { querySelectorAll?: unknown }) | null;
    if (root && typeof root.querySelectorAll === 'function') {
      labels.push(...Array.from(root.querySelectorAll(`label[for="${escapeAttributeValue(id)}"]`)));
    }
  }
  const wrapping = el.closest?.('label');
  if (wrapping && !labels.includes(wrapping)) {
    const htmlFor = wrapping.getAttribute('for');
    if (!htmlFor || htmlFor === id) labels.push(wrapping);
  }
  return labels;
};

/** A label's full, normalised text — nested elements included, the control's own content not. */
const getLabelText = (labelEl: Element, control: Element): string =>
  normalizeWhitespace(collectNameText(labelEl, control));

const LABELABLE_TAGS = /^(input|select|textarea|button|meter|output|progress)$/;
const NAME_FROM_CONTENT_ROLES =
  /^(button|cell|checkbox|columnheader|gridcell|heading|link|menuitem(checkbox|radio)?|option|radio|row|rowheader|switch|tab|tooltip|treeitem)$/;

/**
 * A pragmatic subset of the accessible-name computation: `aria-labelledby`,
 * `aria-label`, button-type input values, associated labels, `alt`, content
 * for roles named from content, `placeholder`, then `title`.
 */
const getAccessibleName = (el: Element, role: string): string => {
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const root = getQueryableRoot(el);
    const text = normalizeWhitespace(
      labelledBy
        .trim()
        .split(/\s+/)
        .map((id) => {
          const ref = root ? findById(root, id) : null;
          if (!ref) return '';
          // A hidden element named by `aria-labelledby` still counts, hidden content and all.
          return (
            normalizeWhitespace(ref.getAttribute('aria-label') ?? '') ||
            collectNameText(ref, undefined, isHiddenElement(ref))
          );
        })
        .join(' ')
    );
    if (text) return text;
  }

  const ariaLabel = normalizeWhitespace(el.getAttribute('aria-label') ?? '');
  if (ariaLabel) return ariaLabel;

  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute('type') ?? '').toLowerCase();
  if (tag === 'input' && type === 'image') {
    // HTML-AAM: alt, value, title, then the browser's default label.
    for (const attr of ['alt', 'value', 'title']) {
      const text = normalizeWhitespace(el.getAttribute(attr) ?? '');
      if (text) return text;
    }
    return 'Submit Query';
  }
  if (tag === 'input' && /^(button|submit|reset)$/.test(type)) {
    const value = el.getAttribute('value');
    if (value !== null) return normalizeWhitespace(value);
    if (type === 'submit') return 'Submit';
    if (type === 'reset') return 'Reset';
  }

  if (LABELABLE_TAGS.test(tag)) {
    const text = normalizeWhitespace(
      getLabelElements(el)
        .map((labelEl) => getLabelText(labelEl, el))
        .join(' ')
    );
    if (text) return text;
  }

  if (tag === 'img' || tag === 'area') {
    const alt = normalizeWhitespace(el.getAttribute('alt') ?? '');
    if (alt) return alt;
  }

  if (NAME_FROM_CONTENT_ROLES.test(role)) {
    const text = normalizeWhitespace(collectNameText(el));
    if (text) return text;
  }

  if (tag === 'input' || tag === 'textarea') {
    const placeholder = normalizeWhitespace(el.getAttribute('placeholder') ?? '');
    if (placeholder) return placeholder;
  }

  return normalizeWhitespace(el.getAttribute('title') ?? '');
};

const matchesName = (name: string, target: string | RegExp): boolean => {
  if (typeof target === 'string') return name === normalizeWhitespace(target);
  target.lastIndex = 0;
  return target.test(name);
};

const describeRole = (role: string, options?: ByRoleOptions): string =>
  options?.name === undefined
    ? `role "${role}"`
    : `role "${role}" with name ${
        typeof options.name === 'string' ? JSON.stringify(options.name) : String(options.name)
      }`;

const matchesRole = (el: Element, role: string): boolean => {
  if (el.getAttribute('role') === role) return true;
  // Implicit ARIA roles for a small but useful subset.
  const tag = el.tagName.toLowerCase();
  switch (role) {
    case 'button':
      return (
        tag === 'button' ||
        (tag === 'input' && /^(button|submit|reset|image)$/i.test(el.getAttribute('type') ?? ''))
      );
    case 'link':
      return tag === 'a' && el.hasAttribute('href');
    case 'textbox':
      return (
        (tag === 'input' &&
          /^(text|search|email|password|tel|url)?$/i.test(
            (el as HTMLInputElement).type ?? 'text'
          )) ||
        tag === 'textarea'
      );
    case 'checkbox':
      return tag === 'input' && (el as HTMLInputElement).type === 'checkbox';
    case 'radio':
      return tag === 'input' && (el as HTMLInputElement).type === 'radio';
    case 'heading':
      return /^h[1-6]$/.test(tag);
    case 'list':
      return tag === 'ul' || tag === 'ol';
    case 'listitem':
      return tag === 'li';
    case 'img':
      return tag === 'img';
    default:
      return false;
  }
};

const isFormControl = (el: Element): boolean => {
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.hasAttribute('role');
};

const matchesLabel = (el: Element, label: string | RegExp): boolean => {
  // Only form controls can be matched by label text — labels themselves are
  // never returned (matches testing-library semantics).
  if (!isFormControl(el)) return false;
  const aria = el.getAttribute('aria-label');
  if (aria && matchesString(aria, label)) return true;
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const root = getQueryableRoot(el);
    const refs =
      root === null
        ? []
        : labelledBy
            .trim()
            .split(/\s+/)
            .map((id) => findById(root, id))
            .filter((ref): ref is Element => ref !== null);
    if (refs.some((ref) => matchesText(ref, label))) return true;
    const combined = refs
      .map((ref) => ref.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ')
      .trim();
    if (combined && matchesString(combined, label)) return true;
  }
  return getLabelElements(el).some((labelEl) => {
    const text = getLabelText(labelEl, el);
    return !!text && matchesString(text, label);
  });
};

const matchesString = (value: string, target: string | RegExp): boolean =>
  typeof target === 'string' ? value === target || value.includes(target) : target.test(value);

const single = <T>(items: T[], desc: string): T => {
  if (items.length === 0) throw new Error(`bQuery testing: no element found matching ${desc}`);
  if (items.length > 1) {
    throw new Error(
      `bQuery testing: multiple elements (${items.length}) match ${desc}; refine the query`
    );
  }
  return items[0];
};

const optional = <T>(items: T[]): T | null => (items.length === 0 ? null : items[0]);

/** Timeout for the `findBy*` queries: milliseconds, or `{ timeout, interval }`. */
type FindTimeout = number | WaitForOptions;

const DEFAULT_FIND_TIMEOUT = 1000;

const findAsync = async <T>(
  fn: () => T[],
  desc: string | (() => string),
  wait?: FindTimeout
): Promise<T> => {
  const opts = typeof wait === 'number' ? { timeout: wait } : (wait ?? {});
  const timeout =
    typeof opts.timeout === 'number' && opts.timeout >= 0 ? opts.timeout : DEFAULT_FIND_TIMEOUT;
  const interval = typeof opts.interval === 'number' && opts.interval > 0 ? opts.interval : 10;
  const start = Date.now();
  while (true) {
    const result = fn();
    if (result.length > 0) return result[0];
    const remaining = timeout - (Date.now() - start);
    if (remaining <= 0) break;
    // Never sleep past the deadline: the last check runs when the timeout is due.
    await sleep(Math.min(interval, remaining));
  }
  throw new Error(
    `bQuery testing: timed out after ${timeout}ms waiting for ${typeof desc === 'function' ? desc() : desc}`
  );
};

/**
 * Bound query helpers returned by {@link within} and {@link screen}.
 *
 * `findBy*` queries take a timeout in milliseconds or a
 * `{ timeout, interval }` object (defaults: 1000 ms / 10 ms). `findByRole`
 * also reads `timeout` / `interval` from its role options
 * (`{ name: 'Save', timeout: 2000 }`); a separate third argument wins.
 */
export interface Queries {
  getByRole(role: string, options?: ByRoleOptions): Element;
  queryByRole(role: string, options?: ByRoleOptions): Element | null;
  findByRole(role: string, timeoutMs?: number | WaitForOptions): Promise<Element>;
  findByRole(
    role: string,
    options?: ByRoleOptions & WaitForOptions,
    timeoutMs?: number | WaitForOptions
  ): Promise<Element>;

  getByText(text: string | RegExp): Element;
  queryByText(text: string | RegExp): Element | null;
  findByText(text: string | RegExp, timeoutMs?: number | WaitForOptions): Promise<Element>;

  getByLabelText(label: string | RegExp): Element;
  queryByLabelText(label: string | RegExp): Element | null;
  findByLabelText(label: string | RegExp, timeoutMs?: number | WaitForOptions): Promise<Element>;

  getByPlaceholderText(text: string | RegExp): Element;
  queryByPlaceholderText(text: string | RegExp): Element | null;
  findByPlaceholderText(
    text: string | RegExp,
    timeoutMs?: number | WaitForOptions
  ): Promise<Element>;

  getByTestId(id: string): Element;
  queryByTestId(id: string): Element | null;
  findByTestId(id: string, timeoutMs?: number | WaitForOptions): Promise<Element>;
}

/**
 * Build a scoped set of queries against the given root element. Shadow roots
 * encountered during traversal are searched recursively.
 */
export const within = (root: ParentNode): Queries => {
  const elements = (): Element[] => allElements(root);
  const byRole = (role: string, options?: ByRoleOptions): Element[] => {
    const matches = elements().filter((el) => matchesRole(el, role));
    const name = options?.name;
    return name === undefined
      ? matches
      : matches.filter((el) => matchesName(getAccessibleName(el, role), name));
  };
  // With a name filter, list the names that *are* there to make misses debuggable.
  const describeByRole = (role: string, options?: ByRoleOptions) => (): string => {
    const desc = describeRole(role, options);
    if (options?.name === undefined) return desc;
    const names = elements()
      .filter((el) => matchesRole(el, role))
      .map((el) => JSON.stringify(getAccessibleName(el, role)));
    return names.length === 0
      ? `${desc} (no element has role "${role}")`
      : `${desc} (accessible names of role "${role}": ${names.slice(0, 10).join(', ')}${
          names.length > 10 ? ', ...' : ''
        })`;
  };
  const roleOptions = (options: unknown): ByRoleOptions | undefined =>
    options !== null && typeof options === 'object' ? (options as ByRoleOptions) : undefined;
  const byText = (text: string | RegExp): Element[] =>
    elements().filter((el) => matchesText(el, text));
  const byLabel = (label: string | RegExp): Element[] =>
    elements().filter((el) => matchesLabel(el, label));
  const byPlaceholder = (text: string | RegExp): Element[] =>
    elements().filter((el) => {
      const ph = el.getAttribute('placeholder');
      return !!ph && matchesString(ph, text);
    });
  const byTestId = (id: string): Element[] =>
    elements().filter((el) => el.getAttribute('data-testid') === id);

  return {
    getByRole: (role, options) => {
      const opts = roleOptions(options);
      const items = byRole(role, opts);
      return single(
        items,
        items.length === 0 ? describeByRole(role, opts)() : describeRole(role, opts)
      );
    },
    queryByRole: (role, options) => optional(byRole(role, roleOptions(options))),
    findByRole: (
      role: string,
      optionsOrTimeout?: (ByRoleOptions & WaitForOptions) | number,
      timeoutMs?: number | WaitForOptions
    ) => {
      // `findByRole(role, timeoutMs)` (1.14 signature), `findByRole(role, options, timeoutMs)`,
      // or one combined `{ name, timeout, interval }` object.
      if (typeof optionsOrTimeout === 'number') {
        return findAsync(() => byRole(role), describeRole(role), optionsOrTimeout);
      }
      const opts = roleOptions(optionsOrTimeout);
      const wait =
        timeoutMs ??
        (opts && ('timeout' in opts || 'interval' in opts) ? (opts as WaitForOptions) : undefined);
      return findAsync(() => byRole(role, opts), describeByRole(role, opts), wait);
    },

    getByText: (text) => single(byText(text), `text ${String(text)}`),
    queryByText: (text) => optional(byText(text)),
    findByText: (text, timeoutMs) =>
      findAsync(() => byText(text), `text ${String(text)}`, timeoutMs),

    getByLabelText: (label) => single(byLabel(label), `label ${String(label)}`),
    queryByLabelText: (label) => optional(byLabel(label)),
    findByLabelText: (label, timeoutMs) =>
      findAsync(() => byLabel(label), `label ${String(label)}`, timeoutMs),

    getByPlaceholderText: (text) => single(byPlaceholder(text), `placeholder ${String(text)}`),
    queryByPlaceholderText: (text) => optional(byPlaceholder(text)),
    findByPlaceholderText: (text, timeoutMs) =>
      findAsync(() => byPlaceholder(text), `placeholder ${String(text)}`, timeoutMs),

    getByTestId: (id) => single(byTestId(id), `data-testid="${id}"`),
    queryByTestId: (id) => optional(byTestId(id)),
    findByTestId: (id, timeoutMs) =>
      findAsync(() => byTestId(id), `data-testid="${id}"`, timeoutMs),
  };
};

/**
 * Document-scoped query helpers. Lazy: never touches `document` at import
 * time, so importing this module from an SSR context is safe.
 */
export const screen: Queries = new Proxy({} as Queries, {
  get(_t, prop: keyof Queries) {
    if (typeof document === 'undefined') {
      return (): never => {
        throw new Error('bQuery testing: screen queries require a document-like environment');
      };
    }
    const queries = within(document);
    return queries[prop];
  },
});

// ---------------------------------------------------------------------------
// Reactive helpers
// ---------------------------------------------------------------------------

/** Wrap {@link computed} with a `recomputeCount` counter. */
export const mockComputed = <T>(
  fn: () => T
): { readonly value: T; peek(): T; recomputeCount: number; reset(): void } => {
  let count = 0;
  const c = computed(() => {
    count++;
    return fn();
  });
  return {
    get value(): T {
      return c.value;
    },
    peek(): T {
      return c.peek();
    },
    get recomputeCount(): number {
      return count;
    },
    reset(): void {
      count = 0;
    },
  };
};

/** Wrap {@link effect} with a `runs` counter and `dispose` handle. */
export const mockEffect = (fn: () => void): { runs: number; dispose: () => void } => {
  const state = { runs: 0, dispose: (): void => undefined };
  const dispose = effect(() => {
    state.runs++;
    fn();
  });
  state.dispose = dispose;
  return state;
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * Lightweight isolated store for tests. Not connected to the global store
 * registry.
 */
export interface MockStore<T extends Record<string, unknown>> {
  readonly state: T;
  set(patch: Partial<T>): void;
  reset(): void;
  readonly initialState: Readonly<T>;
}

export const mockStore = <T extends Record<string, unknown>>(initialState: T): MockStore<T> => {
  const snapshot = { ...initialState };
  let current: T = { ...initialState };
  return {
    get state(): T {
      return current;
    },
    set(patch): void {
      current = { ...current, ...patch };
    },
    reset(): void {
      current = { ...snapshot };
    },
    get initialState(): Readonly<T> {
      return snapshot;
    },
  };
};

/**
 * In-memory i18n harness. Returns a `t()` function and `setLocale` helper.
 */
export interface MockI18n {
  readonly locale: Signal<string>;
  setLocale(locale: string): void;
  t(key: string, vars?: Record<string, string | number>): string;
}

export const mockI18n = (opts?: {
  locale?: string;
  messages?: Record<string, Record<string, string>>;
}): MockI18n => {
  const localeSig = signal(opts?.locale ?? 'en');
  const messages = opts?.messages ?? {};
  return {
    locale: localeSig,
    setLocale(locale: string): void {
      localeSig.value = locale;
    },
    t(key: string, vars?: Record<string, string | number>): string {
      const tpl = messages[localeSig.value]?.[key] ?? key;
      if (!vars) return tpl;
      return tpl.replace(/\{(\w+)\}/g, (_m, name: string) => String(vars[name] ?? ''));
    },
  };
};

/**
 * Minimal reactive form harness. Provides `values`, `errors`, `set`, `submit`.
 */
export interface MockForm<T extends Record<string, unknown>> {
  readonly values: Signal<T>;
  readonly errors: Signal<Partial<Record<keyof T, string>>>;
  set<K extends keyof T>(field: K, value: T[K]): void;
  setError<K extends keyof T>(field: K, error: string | undefined): void;
  reset(): void;
}

export const mockForm = <T extends Record<string, unknown>>(initialValues: T): MockForm<T> => {
  const initial = { ...initialValues };
  const values = signal<T>({ ...initialValues });
  const errors = signal<Partial<Record<keyof T, string>>>({});
  return {
    values,
    errors,
    set<K extends keyof T>(field: K, value: T[K]): void {
      values.value = { ...values.value, [field]: value };
    },
    setError<K extends keyof T>(field: K, error: string | undefined): void {
      const next = { ...errors.value };
      if (error === undefined) delete next[field];
      else next[field] = error;
      errors.value = next;
    },
    reset(): void {
      values.value = { ...initial };
      errors.value = {};
    },
  };
};

/**
 * Minimal fetch mocker. Accepts a routes map and overrides `globalThis.fetch`
 * for the duration of the returned `restore()` lifetime.
 */
export interface MockFetchRoute {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export const mockFetch = (
  routes: Record<
    string,
    MockFetchRoute | ((req: Request) => MockFetchRoute | Promise<MockFetchRoute>)
  >
): { restore: () => void; calls: Request[] } => {
  const calls: Request[] = [];
  const original = (globalThis as { fetch?: typeof fetch }).fetch;
  (globalThis as { fetch?: typeof fetch }).fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const req = new Request(input, init);
    calls.push(req);
    const url = new URL(req.url);
    const path = url.pathname + url.search;
    const entry =
      routes[path] ??
      routes[url.pathname] ??
      routes[req.method + ' ' + path] ??
      routes[req.method + ' ' + url.pathname];
    if (!entry) {
      return new Response('Not Mocked', { status: 404 });
    }
    const resolved = typeof entry === 'function' ? await entry(req) : entry;
    const body =
      resolved.body === undefined
        ? null
        : typeof resolved.body === 'string'
          ? resolved.body
          : JSON.stringify(resolved.body);
    return new Response(body, {
      status: resolved.status ?? 200,
      headers: resolved.headers,
    });
  }) as typeof fetch;
  return {
    restore(): void {
      (globalThis as { fetch?: typeof fetch }).fetch = original;
    },
    calls,
  };
};

/**
 * Minimal in-memory WebSocket pair for driving `reactive/realtime` from tests.
 */
export interface MockWebSocket {
  readonly socket: {
    send(data: string): void;
    close(): void;
    readyState: number;
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;
    onclose?: () => void;
    onerror?: (err: unknown) => void;
  };
  /** Simulate a server-side message arriving. */
  emit(data: string): void;
  /** Read messages the client sent. */
  readonly sent: string[];
  open(): void;
  close(): void;
}

export const mockWebSocket = (): MockWebSocket => {
  const sent: string[] = [];
  let readyState = 0; // CONNECTING
  const socket: MockWebSocket['socket'] = {
    readyState,
    send(data: string): void {
      sent.push(data);
    },
    close(): void {
      readyState = 3;
      socket.readyState = 3;
      socket.onclose?.();
    },
  };
  return {
    socket,
    sent,
    open(): void {
      readyState = 1;
      socket.readyState = 1;
      socket.onopen?.();
    },
    close(): void {
      socket.close();
    },
    emit(data: string): void {
      socket.onmessage?.({ data });
    },
  };
};

// ---------------------------------------------------------------------------
// Snapshot / a11y helpers
// ---------------------------------------------------------------------------

/**
 * Render a pretty-printed HTML snapshot of an element, optionally trimming
 * very large output and traversing shadow roots.
 */
export const prettyDOM = (
  el: Element,
  opts?: { maxLength?: number; includeShadow?: boolean }
): string => {
  const maxLength = opts?.maxLength ?? 7000;
  const includeShadow = opts?.includeShadow ?? true;

  const print = (node: Element, depth: number): string => {
    const indent = '  '.repeat(depth);
    const tag = node.tagName.toLowerCase();
    const attrs = Array.from(node.attributes)
      .map((a) => ` ${a.name}="${a.value}"`)
      .join('');
    let body = '';
    if (includeShadow && (node as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
      const shadow = (node as Element & { shadowRoot: ShadowRoot }).shadowRoot;
      const shadowHtml = Array.from(shadow.children)
        .map((c) => print(c, depth + 2))
        .join('\n');
      body += `\n${indent}  #shadow-root\n${shadowHtml}`;
    }
    for (const child of Array.from(node.children)) {
      body += '\n' + print(child, depth + 1);
    }
    const text = Array.from(node.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => (n as Text).data.trim())
      .filter(Boolean)
      .join(' ');
    if (text) body = '\n' + indent + '  ' + text + body;
    return `${indent}<${tag}${attrs}>${body}\n${indent}</${tag}>`;
  };

  const output = print(el, 0);
  if (output.length > maxLength) return output.slice(0, maxLength) + '\n  ... (truncated)';
  return output;
};

/** Quick reactive subtree summary used by debugging tests. */
export const getReactiveSummary = (
  el: Element
): { components: number; shadowRoots: number; testIds: string[] } => {
  let components = 0;
  let shadowRoots = 0;
  const testIds: string[] = [];
  const walk = (node: Element): void => {
    if (node.tagName.includes('-')) components++;
    if ((node as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) shadowRoots++;
    const id = node.getAttribute('data-testid');
    if (id) testIds.push(id);
    for (const child of Array.from(node.children)) walk(child);
  };
  walk(el);
  return { components, shadowRoots, testIds };
};

/**
 * Lightweight a11y assertion: returns a structured result that callers can
 * combine with their assertion library. Looks for the most common defects
 * (missing alt text on images, missing form labels, missing button labels).
 */
export interface AccessibilityResult {
  readonly passed: boolean;
  readonly violations: readonly { rule: string; element: Element; message: string }[];
}

export const expectAccessible = (root: Element): AccessibilityResult => {
  const violations: { rule: string; element: Element; message: string }[] = [];
  for (const el of [root, ...allElements(root)]) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'img' && !el.getAttribute('alt')) {
      violations.push({ rule: 'image-alt', element: el, message: '<img> missing alt attribute' });
    }
    if (tag === 'button' && !el.textContent?.trim() && !el.getAttribute('aria-label')) {
      violations.push({
        rule: 'button-name',
        element: el,
        message: '<button> has no accessible name',
      });
    }
    if (
      tag === 'input' &&
      (el as HTMLInputElement).type !== 'hidden' &&
      !el.getAttribute('aria-label') &&
      !el.getAttribute('aria-labelledby') &&
      !el.id
    ) {
      violations.push({
        rule: 'label-input',
        element: el,
        message: '<input> has no associated label',
      });
    }
  }
  return { passed: violations.length === 0, violations };
};

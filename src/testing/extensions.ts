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
import { fireEvent, flushEffects } from './testing';

// ---------------------------------------------------------------------------
// Auto cleanup
// ---------------------------------------------------------------------------

type Cleanable = { unmount: () => void };

const pendingMounts: Cleanable[] = [];

/** @internal — register a render result for {@link cleanup}. */
export const __trackMount = (result: Cleanable): void => {
  pendingMounts.push(result);
};

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

/**
 * Higher-level interactions composed from {@link fireEvent}. Every action
 * flushes effects + microtasks before returning so consumers can `await` it.
 */
export const userEvent = {
  async click(el: Element): Promise<void> {
    fireEvent(el, 'mousedown');
    fireEvent(el, 'mouseup');
    fireEvent(el, 'click');
    await tick();
  },
  async dblClick(el: Element): Promise<void> {
    await this.click(el);
    await this.click(el);
    fireEvent(el, 'dblclick');
    await tick();
  },
  async hover(el: Element): Promise<void> {
    fireEvent(el, 'mouseover');
    fireEvent(el, 'mouseenter');
    await tick();
  },
  async unhover(el: Element): Promise<void> {
    fireEvent(el, 'mouseout');
    fireEvent(el, 'mouseleave');
    await tick();
  },
  async type(el: Element, text: string, opts?: { delay?: number }): Promise<void> {
    const input = el as HTMLInputElement;
    for (const ch of text) {
      input.value = (input.value ?? '') + ch;
      fireEvent.keyDown(el, { key: ch });
      fireEvent(el, 'input');
      fireEvent.keyUp(el, { key: ch });
      if (opts?.delay) await sleep(opts.delay);
    }
    await tick();
  },
  async clear(el: Element): Promise<void> {
    (el as HTMLInputElement).value = '';
    fireEvent(el, 'input');
    fireEvent(el, 'change');
    await tick();
  },
  async selectOptions(el: Element, values: string | string[]): Promise<void> {
    const select = el as HTMLSelectElement;
    const list = Array.isArray(values) ? values : [values];
    for (const opt of Array.from(select.options)) {
      opt.selected = list.includes(opt.value);
    }
    fireEvent(el, 'input');
    fireEvent(el, 'change');
    await tick();
  },
  async tab(): Promise<void> {
    fireEvent.keyDown(document.body, { key: 'Tab' });
    await tick();
  },
  async paste(el: Element, text: string): Promise<void> {
    const input = el as HTMLInputElement;
    input.value = (input.value ?? '') + text;
    fireEvent(el, 'input');
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

const matchesRole = (el: Element, role: string): boolean => {
  if (el.getAttribute('role') === role) return true;
  // Implicit ARIA roles for a small but useful subset.
  const tag = el.tagName.toLowerCase();
  switch (role) {
    case 'button':
      return tag === 'button' || (tag === 'input' && (el as HTMLInputElement).type === 'button');
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
  const id = el.getAttribute('id');
  if (id) {
    const root = getQueryableRoot(el);
    const labelEl = root?.querySelector(`label[for="${escapeAttributeValue(id)}"]`);
    if (labelEl && matchesText(labelEl, label)) return true;
  }
  // Implicit label wrap
  const parentLabel = el.closest?.('label');
  if (parentLabel && matchesText(parentLabel, label)) return true;
  return false;
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

const findAsync = async <T>(fn: () => T[], desc: string, timeoutMs = 1000): Promise<T> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = fn();
    if (result.length > 0) return result[0];
    await sleep(10);
  }
  throw new Error(`bQuery testing: timed out waiting for ${desc}`);
};

/**
 * Bound query helpers returned by {@link within} and {@link screen}.
 */
export interface Queries {
  getByRole(role: string): Element;
  queryByRole(role: string): Element | null;
  findByRole(role: string, timeoutMs?: number): Promise<Element>;

  getByText(text: string | RegExp): Element;
  queryByText(text: string | RegExp): Element | null;
  findByText(text: string | RegExp, timeoutMs?: number): Promise<Element>;

  getByLabelText(label: string | RegExp): Element;
  queryByLabelText(label: string | RegExp): Element | null;
  findByLabelText(label: string | RegExp, timeoutMs?: number): Promise<Element>;

  getByPlaceholderText(text: string | RegExp): Element;
  queryByPlaceholderText(text: string | RegExp): Element | null;
  findByPlaceholderText(text: string | RegExp, timeoutMs?: number): Promise<Element>;

  getByTestId(id: string): Element;
  queryByTestId(id: string): Element | null;
  findByTestId(id: string, timeoutMs?: number): Promise<Element>;
}

/**
 * Build a scoped set of queries against the given root element. Shadow roots
 * encountered during traversal are searched recursively.
 */
export const within = (root: ParentNode): Queries => {
  const elements = (): Element[] => allElements(root);
  const byRole = (role: string): Element[] => elements().filter((el) => matchesRole(el, role));
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
    getByRole: (role) => single(byRole(role), `role "${role}"`),
    queryByRole: (role) => optional(byRole(role)),
    findByRole: (role, timeoutMs) => findAsync(() => byRole(role), `role "${role}"`, timeoutMs),

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

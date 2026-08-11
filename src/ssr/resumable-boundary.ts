/**
 * Resumable boundaries — structured resume, not replay.
 *
 * `createResumableState()` (see `./resumability`) is a flat key/value collector.
 * This module adds the boundary-scoped resumability model tracked in GitHub
 * issue #129: each boundary carries the slices an island needs to **resume** in
 * place rather than re-run its setup:
 *
 * - **signals** — current values, seeded back into existing client signals
 *   (no producer re-execution);
 * - **handlers** — event-handler *ids* (never code), wired on the client from a
 *   caller-supplied registry — no `eval`-based revival;
 * - **store** — store slices rehydrated via `hydrateStore()` without re-running
 *   actions.
 *
 * It is opt-in, tree-shakeable, zero-dependency, and respects the security
 * model (prototype-pollution filtering + `<script>` escaping). It pairs with
 * island hydration (`hydrateOnVisible/Idle/Interaction/Media`): those islands
 * can now resume their state instead of reconstructing it.
 *
 * @module bquery/ssr
 */

import { isComputed, isSignal, type Signal } from '../reactive/index';
import { isPrototypePollutionKey } from '../core/utils/object';
import { getStore } from '../store/index';
import { escapeForHtmlAttribute, escapeForScript } from './escape';
import { hydrateStore } from './serialize';

/** Marker attribute placed on a boundary's root element. */
export const RESUMABLE_BOUNDARY_ATTR = 'data-bq-resume';
/** Marker attribute naming the handler id a resumable element expects. */
export const RESUMABLE_HANDLER_ATTR = 'data-bq-handler';
/** Marker attribute listing the event(s) a resumable handler binds to. */
export const RESUMABLE_EVENT_ATTR = 'data-bq-event';

const DEFAULT_GRAPH_KEY = '__BQUERY_RESUME_GRAPH__';

/** Which slices a boundary serializes. */
export type ResumableSlice = 'signals' | 'handlers' | 'store';

/** Plain, JSON-serializable shape of one boundary. */
export interface SerializedResumableBoundary {
  id: string;
  signals: Record<string, unknown>;
  handlers: string[];
  stores: Record<string, Record<string, unknown>>;
}

/** Plain, JSON-serializable shape of a whole resume graph. */
export interface SerializedResumableGraph {
  boundaries: SerializedResumableBoundary[];
}

/** Options for `createResumableBoundary()` / `ResumableGraph.boundary()`. */
export interface CreateResumableBoundaryOptions {
  /** Slices to serialize. Default: all three. */
  serialize?: ResumableSlice[];
}

/** Options for rendering a resume graph `<script>`. */
export interface ResumableRenderOptions {
  /** CSP nonce applied to the generated `<script>`. */
  nonce?: string;
  /** `id` of the `<script>` element. Default: `'__BQUERY_RESUME_GRAPH__'`. */
  scriptId?: string;
  /** Global the snapshot is published on. Default: `'__BQUERY_RESUME_GRAPH__'`. */
  globalKey?: string;
}

/** A server-side resumable boundary collector. */
export interface ResumableBoundary {
  /** The boundary id (matches `data-bq-resume` in the markup). */
  readonly id: string;
  /** Records a signal's current value under `key`. Accepts a signal or a plain value. */
  signal(key: string, value: unknown): ResumableBoundary;
  /** Declares a handler id this boundary expects the client to wire. */
  handler(handlerId: string): ResumableBoundary;
  /** Records a store slice. Reads the live store state when `state` is omitted. */
  store(storeId: string, state?: Record<string, unknown>): ResumableBoundary;
  /** Marker attributes to spread onto the boundary's root element. */
  attrs(): Record<string, string>;
  /** The serialized snapshot of this boundary. */
  toJSON(): SerializedResumableBoundary;
}

/** A standalone boundary that can render its own `<script>`. */
export interface StandaloneResumableBoundary extends ResumableBoundary {
  /** Renders the `<script>` that publishes this single-boundary graph. */
  render(options?: ResumableRenderOptions): string;
}

/** A collection of resumable boundaries rendered as a single graph. */
export interface ResumableGraph {
  /** Creates (or returns the existing) boundary with `id`. */
  boundary(id: string, options?: CreateResumableBoundaryOptions): ResumableBoundary;
  /** Returns an already-created boundary, or `undefined`. */
  get(id: string): ResumableBoundary | undefined;
  /** The serialized snapshot of every boundary. */
  toJSON(): SerializedResumableGraph;
  /** Renders the `<script>` that publishes the whole graph. */
  render(options?: ResumableRenderOptions): string;
}

const cloneRecord = <T>(source: Record<string, T>): Record<string, T> => {
  const out = Object.create(null) as Record<string, T>;
  for (const [key, value] of Object.entries(source)) {
    if (!isPrototypePollutionKey(key)) out[key] = value;
  }
  return out;
};

const sanitizeStoreState = (state: Record<string, unknown>): Record<string, unknown> => {
  const out = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(state)) {
    if (!isPrototypePollutionKey(key)) out[key] = value;
  }
  return out;
};

const readStoreState = (storeId: string): Record<string, unknown> => {
  const store = getStore<{ $state: Record<string, unknown> }>(storeId);
  return store ? sanitizeStoreState(store.$state) : {};
};

const makeBoundary = (id: string, options: CreateResumableBoundaryOptions): ResumableBoundary => {
  const slices = new Set<ResumableSlice>(options.serialize ?? ['signals', 'handlers', 'store']);
  const signals = Object.create(null) as Record<string, unknown>;
  const handlers: string[] = [];
  const stores = Object.create(null) as Record<string, Record<string, unknown>>;

  const boundary: ResumableBoundary = {
    id,
    signal(key, value) {
      if (slices.has('signals') && !isPrototypePollutionKey(key)) {
        signals[key] =
          isSignal(value) || isComputed(value) ? (value as Signal<unknown>).value : value;
      }
      return boundary;
    },
    handler(handlerId) {
      if (
        slices.has('handlers') &&
        !isPrototypePollutionKey(handlerId) &&
        !handlers.includes(handlerId)
      ) {
        handlers.push(handlerId);
      }
      return boundary;
    },
    store(storeId, state) {
      if (slices.has('store') && !isPrototypePollutionKey(storeId)) {
        stores[storeId] = state ? sanitizeStoreState(state) : readStoreState(storeId);
      }
      return boundary;
    },
    attrs() {
      return { [RESUMABLE_BOUNDARY_ATTR]: id };
    },
    toJSON() {
      return {
        id,
        signals: cloneRecord(signals),
        handlers: [...handlers],
        stores: cloneRecord(stores),
      };
    },
  };
  return boundary;
};

const renderGraphScript = (
  graph: SerializedResumableGraph,
  options: ResumableRenderOptions
): string => {
  const scriptId = options.scriptId ?? DEFAULT_GRAPH_KEY;
  const globalKey = options.globalKey ?? DEFAULT_GRAPH_KEY;
  if (isPrototypePollutionKey(scriptId) || isPrototypePollutionKey(globalKey)) return '';
  const escapedJson = escapeForScript(JSON.stringify(graph));
  const escapedKey = escapeForScript(JSON.stringify(globalKey));
  const escapedId = escapeForHtmlAttribute(scriptId);
  const nonceAttr = options.nonce ? ` nonce="${escapeForHtmlAttribute(options.nonce)}"` : '';
  return `<script id="${escapedId}"${nonceAttr}>window[${escapedKey}]=${escapedJson}</script>`;
};

/**
 * Creates a resume graph that aggregates multiple boundaries into one
 * serialized `<script>`.
 *
 * @example
 * ```ts
 * const graph = createResumableGraph();
 * graph.boundary('cart').signal('count', count).handler('addItem').store('cart');
 * const tag = graph.render({ nonce: ctx.nonce });
 * ```
 */
export const createResumableGraph = (): ResumableGraph => {
  const boundaries = new Map<string, ResumableBoundary>();
  const graph: ResumableGraph = {
    boundary(id, options = {}) {
      if (isPrototypePollutionKey(id)) {
        throw new Error(`createResumableGraph: invalid boundary id "${id}".`);
      }
      let existing = boundaries.get(id);
      if (!existing) {
        existing = makeBoundary(id, options);
        boundaries.set(id, existing);
      }
      return existing;
    },
    get(id) {
      return boundaries.get(id);
    },
    toJSON() {
      return { boundaries: [...boundaries.values()].map((b) => b.toJSON()) };
    },
    render(options = {}) {
      return renderGraphScript(graph.toJSON(), options);
    },
  };
  return graph;
};

/**
 * Creates a single resumable boundary. Convenience wrapper around
 * `createResumableGraph()` for the common one-island case; the returned object
 * can render its own `<script>`.
 *
 * @example
 * ```ts
 * // server
 * const boundary = createResumableBoundary('cart', { serialize: ['signals', 'handlers'] });
 * boundary.signal('count', count).handler('addItem');
 * const tag = boundary.render({ nonce: ctx.nonce });
 * // place boundary.attrs() on the island root: <section data-bq-resume="cart">…</section>
 * ```
 */
export const createResumableBoundary = (
  id: string,
  options: CreateResumableBoundaryOptions = {}
): StandaloneResumableBoundary => {
  const graph = createResumableGraph();
  const boundary = graph.boundary(id, options);
  return Object.assign(boundary, {
    render: (renderOptions?: ResumableRenderOptions) => graph.render(renderOptions),
  });
};

/** A client handler the resume step can wire by id. */
export type ResumableHandler = (event?: Event) => void;

/** Options for the client-side `resume()`. */
export interface ResumeOptions {
  /** Registry mapping handler id → function. Wired by id, never `eval`'d. */
  handlers?: Record<string, ResumableHandler>;
  /** Existing client signals to seed from the snapshot (resume, not recreate). */
  signals?: Record<string, Signal<unknown>>;
  /** When `true`, rehydrates serialized store slices via `hydrateStore()`. */
  hydrateStores?: boolean;
  /** Scope to search for boundary/handler markers. Default: `document`. */
  root?: Element | Document;
  /** Global the snapshot is published on. Default: `'__BQUERY_RESUME_GRAPH__'`. */
  globalKey?: string;
  /** `id` of the `<script>` element to clean up. Default: `'__BQUERY_RESUME_GRAPH__'`. */
  scriptId?: string;
}

/** Result of a `resume()` call. */
export interface ResumeResult {
  /** Whether a snapshot was found and consumed. */
  resumed: boolean;
  /** Boundary ids present in the snapshot. */
  boundaries: string[];
  /** Signal keys that were seeded into the provided registry. */
  seededSignals: string[];
  /** Number of (element, event) handler bindings wired. */
  wiredHandlers: number;
}

const EMPTY_RESUME: ResumeResult = {
  resumed: false,
  boundaries: [],
  seededSignals: [],
  wiredHandlers: 0,
};

/** Minimal attribute-selector value escaping (avoids depending on `CSS.escape`). */
const escapeAttrValue = (value: string): string => value.replace(/["\\]/g, '\\$&');

const findBoundaryScope = (root: Element | Document, id: string): Element | null => {
  if (
    typeof (root as Element).getAttribute === 'function' &&
    (root as Element).getAttribute(RESUMABLE_BOUNDARY_ATTR) === id
  ) {
    return root as Element;
  }
  try {
    return root.querySelector(`[${RESUMABLE_BOUNDARY_ATTR}="${escapeAttrValue(id)}"]`);
  } catch {
    return null;
  }
};

const wireBoundaryHandlers = (
  scope: Element,
  handlers: Record<string, ResumableHandler>
): number => {
  let wired = 0;
  const candidates: Element[] = [];
  if (scope.getAttribute(RESUMABLE_HANDLER_ATTR) !== null) candidates.push(scope);
  for (const el of Array.from(scope.querySelectorAll(`[${RESUMABLE_HANDLER_ATTR}]`))) {
    candidates.push(el);
  }
  for (const el of candidates) {
    const handlerId = el.getAttribute(RESUMABLE_HANDLER_ATTR);
    if (!handlerId || isPrototypePollutionKey(handlerId)) continue;
    const fn = handlers[handlerId];
    if (typeof fn !== 'function') continue;
    const events = (el.getAttribute(RESUMABLE_EVENT_ATTR) ?? 'click').split(/\s+/).filter(Boolean);
    for (const event of events) {
      el.addEventListener(event, fn as EventListener);
      wired += 1;
    }
  }
  return wired;
};

/**
 * Resumes server-emitted boundaries in place: seeds existing signals from the
 * snapshot, wires event handlers by id from `options.handlers`, and optionally
 * rehydrates store slices — all without re-running setup and without `eval`.
 * Cleans up the snapshot global and `<script>` afterwards.
 *
 * Safe to call in any environment; returns an empty result when no snapshot is
 * present (server, tests, etc.).
 *
 * @example
 * ```ts
 * import { resume } from '@bquery/bquery/ssr';
 *
 * const { resumed, wiredHandlers } = resume({
 *   signals: { count },
 *   handlers: { addItem: () => (count.value += 1) },
 *   hydrateStores: true,
 * });
 * ```
 */
export const resume = (options: ResumeOptions = {}): ResumeResult => {
  if (typeof window === 'undefined') return EMPTY_RESUME;
  const globalKey = options.globalKey ?? DEFAULT_GRAPH_KEY;
  const scriptId = options.scriptId ?? DEFAULT_GRAPH_KEY;
  if (isPrototypePollutionKey(globalKey) || isPrototypePollutionKey(scriptId)) return EMPTY_RESUME;

  const win = window as unknown as Record<string, unknown>;
  const raw = win[globalKey];
  try {
    delete win[globalKey];
  } catch {
    win[globalKey] = undefined;
  }
  if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
    document.getElementById(scriptId)?.remove();
  }

  if (!raw || typeof raw !== 'object') return EMPTY_RESUME;
  const boundaries = (raw as Partial<SerializedResumableGraph>).boundaries;
  if (!Array.isArray(boundaries)) return EMPTY_RESUME;

  const signalRegistry = options.signals ?? {};
  const handlerRegistry = options.handlers ?? {};
  const root: Element | Document | undefined =
    options.root ?? (typeof document !== 'undefined' ? document : undefined);

  const boundaryIds: string[] = [];
  const seededSignals: string[] = [];
  let wiredHandlers = 0;

  for (const boundary of boundaries) {
    if (!boundary || typeof boundary !== 'object' || typeof boundary.id !== 'string') continue;
    boundaryIds.push(boundary.id);

    if (boundary.signals && typeof boundary.signals === 'object') {
      for (const [key, value] of Object.entries(boundary.signals)) {
        if (isPrototypePollutionKey(key)) continue;
        const sig = signalRegistry[key];
        if (sig && isSignal(sig)) {
          sig.value = value;
          seededSignals.push(key);
        }
      }
    }

    if (options.hydrateStores && boundary.stores && typeof boundary.stores === 'object') {
      for (const [storeId, state] of Object.entries(boundary.stores)) {
        if (isPrototypePollutionKey(storeId)) continue;
        if (state && typeof state === 'object') {
          hydrateStore(storeId, state as Record<string, unknown>);
        }
      }
    }

    if (root) {
      const scope = findBoundaryScope(root, boundary.id);
      if (scope) wiredHandlers += wireBoundaryHandlers(scope, handlerRegistry);
    }
  }

  return { resumed: true, boundaries: boundaryIds, seededSignals, wiredHandlers };
};

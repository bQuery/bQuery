/**
 * bQuery DevTools — runtime debugging utilities.
 *
 * Enable devtools to inspect signals, stores, components, and view a
 * timeline of reactive events.
 *
 * @module bquery/devtools
 */

import type {
  ComponentSnapshot,
  DevtoolsOptions,
  DevtoolsState,
  SignalSnapshot,
  StoreSnapshot,
  TimelineEntry,
  TimelineEventType,
} from './types';
import { listStores as _listStores, getStore as _getStore } from '../store/registry';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _enabled = false;
let _options: DevtoolsOptions = {};
const _timeline: TimelineEntry[] = [];

/** Registered signals keyed by label. */
const _trackedSignals = new Map<string, { peek: () => unknown; subscriberCount: () => number }>();

/** Monotonic counter for auto-labelling anonymous signals. */
let _signalCounter = 0;

// ---------------------------------------------------------------------------
// Enable / disable
// ---------------------------------------------------------------------------

/**
 * Enable bQuery development mode.
 *
 * When enabled the devtools module records timeline events and
 * allows inspection of signals, stores, and components.
 *
 * @param enabled - `true` to enable, `false` to disable.
 * @param options - Optional configuration.
 *
 * @example
 * ```ts
 * import { enableDevtools } from '@bquery/bquery/devtools';
 * enableDevtools(true, { logToConsole: true });
 * ```
 */
export const enableDevtools = (enabled: boolean, options?: DevtoolsOptions): void => {
  _enabled = enabled;
  _options = options ?? {};

  if (!enabled) {
    _timeline.length = 0;
    _trackedSignals.clear();
    _signalCounter = 0;
  }
};

/**
 * Returns `true` when devtools are active.
 *
 * @example
 * ```ts
 * import { isDevtoolsEnabled } from '@bquery/bquery/devtools';
 * if (isDevtoolsEnabled()) { ... }
 * ```
 */
export const isDevtoolsEnabled = (): boolean => _enabled;

// ---------------------------------------------------------------------------
// Signal tracking
// ---------------------------------------------------------------------------

/**
 * Register a signal for devtools inspection.
 *
 * @param label - Human-readable label (must be unique).
 * @param peek - Returns the signal's value without tracking.
 * @param subscriberCount - Returns the current subscriber count.
 * @throws If a signal with the same label is already tracked.
 *
 * @example
 * ```ts
 * import { trackSignal } from '@bquery/bquery/devtools';
 * import { signal } from '@bquery/bquery/reactive';
 *
 * const count = signal(0);
 * trackSignal('count', () => count.peek(), () => 0);
 * ```
 */
export const trackSignal = (
  label: string,
  peek: () => unknown,
  subscriberCount: () => number,
): void => {
  if (!_enabled) return;
  if (typeof label !== 'string' || label.length === 0) {
    throw new Error('bQuery devtools: trackSignal() requires a non-empty label');
  }
  _trackedSignals.set(label, { peek, subscriberCount });
};

/**
 * Remove a previously tracked signal.
 *
 * @param label - The label used during registration.
 *
 * @example
 * ```ts
 * import { untrackSignal } from '@bquery/bquery/devtools';
 * untrackSignal('count');
 * ```
 */
export const untrackSignal = (label: string): void => {
  _trackedSignals.delete(label);
};

/**
 * Generate a unique label for anonymous signals.
 *
 * @returns A label such as `signal_0`, `signal_1`, …
 *
 * @example
 * ```ts
 * import { generateSignalLabel } from '@bquery/bquery/devtools';
 * const label = generateSignalLabel(); // 'signal_0'
 * ```
 */
export const generateSignalLabel = (): string => `signal_${_signalCounter++}`;

// ---------------------------------------------------------------------------
// Signal inspector
// ---------------------------------------------------------------------------

/**
 * List all tracked signals with their current values.
 *
 * @returns An array of {@link SignalSnapshot} objects.
 *
 * @example
 * ```ts
 * import { inspectSignals } from '@bquery/bquery/devtools';
 * console.table(inspectSignals());
 * ```
 */
export const inspectSignals = (): SignalSnapshot[] => {
  const result: SignalSnapshot[] = [];
  for (const [label, entry] of _trackedSignals) {
    result.push({
      label,
      value: entry.peek(),
      subscriberCount: entry.subscriberCount(),
    });
  }
  return result;
};

// ---------------------------------------------------------------------------
// Store inspector
// ---------------------------------------------------------------------------

/**
 * List all stores with their current state.
 *
 * Reads from the store registry (`listStores` / `getStore`) that is
 * already maintained by the store module.
 *
 * @returns An array of {@link StoreSnapshot} objects.
 *
 * @example
 * ```ts
 * import { inspectStores } from '@bquery/bquery/devtools';
 * console.table(inspectStores());
 * ```
 */
export const inspectStores = (): StoreSnapshot[] => {
  try {
    const ids: string[] = _listStores();
    return ids.map((id: string) => {
      const store = _getStore(id) as Record<string, unknown> | undefined;
      const state: Record<string, unknown> = {};
      if (store && typeof store === 'object' && '$state' in store) {
        const raw = (store as { $state: unknown }).$state;
        if (raw && typeof raw === 'object') {
          Object.assign(state, raw);
        }
      }
      return { id, state };
    });
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Component inspector
// ---------------------------------------------------------------------------

/**
 * List all bQuery-registered custom elements visible in the document.
 *
 * @returns An array of {@link ComponentSnapshot} objects.
 *
 * @example
 * ```ts
 * import { inspectComponents } from '@bquery/bquery/devtools';
 * console.table(inspectComponents());
 * ```
 */
export const inspectComponents = (): ComponentSnapshot[] => {
  if (typeof document === 'undefined') return [];

  const result: ComponentSnapshot[] = [];
  const seen = new Set<string>();

  // Walk every custom element in the DOM (they must contain a hyphen)
  const all = document.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const tag = el.tagName.toLowerCase();
    if (!tag.includes('-')) continue;
    if (seen.has(tag)) continue;

    // Only include if registered via customElements
    if (typeof customElements !== 'undefined' && customElements.get(tag)) {
      seen.add(tag);
      const instances = document.querySelectorAll(tag);
      result.push({ tagName: tag, instanceCount: instances.length });
    }
  }
  return result;
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/**
 * Record a timeline event.
 *
 * This is called internally by bQuery modules (signals, store, router)
 * or can be called from user code / plugins to add custom entries.
 *
 * @param type - The event category.
 * @param detail - A human-readable description.
 *
 * @example
 * ```ts
 * import { recordEvent } from '@bquery/bquery/devtools';
 * recordEvent('signal:update', 'count changed to 5');
 * ```
 */
export const recordEvent = (type: TimelineEventType, detail: string): void => {
  if (!_enabled) return;

  const entry: TimelineEntry = {
    timestamp: Date.now(),
    type,
    detail,
  };
  _timeline.push(entry);

  if (_options.logToConsole) {
     
    console.log(`[bq:devtools] ${type} — ${detail}`);
  }
};

/**
 * Returns the full timeline log.
 *
 * @returns A read-only array of {@link TimelineEntry} objects.
 *
 * @example
 * ```ts
 * import { getTimeline } from '@bquery/bquery/devtools';
 * for (const e of getTimeline()) {
 *   console.log(e.type, e.detail);
 * }
 * ```
 */
export const getTimeline = (): readonly TimelineEntry[] => _timeline;

/**
 * Clear all timeline entries.
 *
 * @example
 * ```ts
 * import { clearTimeline } from '@bquery/bquery/devtools';
 * clearTimeline();
 * ```
 */
export const clearTimeline = (): void => {
  _timeline.length = 0;
};

// ---------------------------------------------------------------------------
// Combined state
// ---------------------------------------------------------------------------

/**
 * Returns a snapshot of the full devtools state.
 *
 * @returns A {@link DevtoolsState} object.
 *
 * @example
 * ```ts
 * import { getDevtoolsState } from '@bquery/bquery/devtools';
 * const state = getDevtoolsState();
 * console.log(state.enabled, state.timeline.length);
 * ```
 */
export const getDevtoolsState = (): DevtoolsState => ({
  enabled: _enabled,
  options: { ..._options },
  timeline: [..._timeline],
});

// ---------------------------------------------------------------------------
// Log helpers (convenience for interactive debugging)
// ---------------------------------------------------------------------------

/**
 * Pretty-print all tracked signals to the console.
 *
 * @example
 * ```ts
 * import { logSignals } from '@bquery/bquery/devtools';
 * logSignals(); // → table output
 * ```
 */
export const logSignals = (): void => {
  const signals = inspectSignals();
  if (signals.length === 0) {
     
    console.log('[bq:devtools] No tracked signals.');
    return;
  }
   
  console.table(signals);
};

/**
 * Pretty-print all stores to the console.
 *
 * @example
 * ```ts
 * import { logStores } from '@bquery/bquery/devtools';
 * logStores(); // → table output
 * ```
 */
export const logStores = (): void => {
  const stores = inspectStores();
  if (stores.length === 0) {
     
    console.log('[bq:devtools] No stores registered.');
    return;
  }
   
  console.table(stores.map((s) => ({ id: s.id, state: JSON.stringify(s.state) })));
};

/**
 * Pretty-print all registered components to the console.
 *
 * @example
 * ```ts
 * import { logComponents } from '@bquery/bquery/devtools';
 * logComponents(); // → table output
 * ```
 */
export const logComponents = (): void => {
  const components = inspectComponents();
  if (components.length === 0) {
     
    console.log('[bq:devtools] No custom elements found.');
    return;
  }
   
  console.table(components);
};

/**
 * Pretty-print the timeline to the console.
 *
 * @param last - Only show the last N entries (default: all).
 *
 * @example
 * ```ts
 * import { logTimeline } from '@bquery/bquery/devtools';
 * logTimeline(10);
 * ```
 */
export const logTimeline = (last?: number): void => {
  const entries = typeof last === 'number' && last > 0 ? _timeline.slice(-last) : _timeline;
  if (entries.length === 0) {
     
    console.log('[bq:devtools] Timeline is empty.');
    return;
  }
   
  console.table(
    entries.map((e) => ({
      time: new Date(e.timestamp).toISOString(),
      type: e.type,
      detail: e.detail,
    })),
  );
};

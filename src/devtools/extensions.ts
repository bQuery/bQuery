/**
 * bQuery DevTools — 1.14+ extension helpers.
 *
 * Adds richer inspection utilities (diff, trace, effects, snapshot import /
 * export, performance helpers, browser bridge) on top of the core devtools
 * primitives.
 *
 * @module bquery/devtools
 */

import {
  clearTimeline,
  enableDevtools,
  getDevtoolsState,
  getTimeline,
  inspectComponents,
  inspectSignals,
  inspectStores,
  isDevtoolsEnabled,
  recordEvent,
  subscribeTimeline,
  trackSignal,
} from './devtools';
import { __inspectTrackedEffects } from '../reactive/effect';
import type {
  ComponentSnapshot,
  DevtoolsState,
  SignalSnapshot,
  StoreSnapshot,
  TimelineEntry,
  TimelineEventType,
} from './types';

// ---------------------------------------------------------------------------
// Timeline filtering
// ---------------------------------------------------------------------------

/** Filter parameters for {@link filterTimeline}. */
export interface TimelineFilter {
  /** Restrict entries to the listed event types. */
  types?: readonly TimelineEventType[];
  /** Only include entries at or after this timestamp (ms). */
  since?: number;
  /** Only include entries up to this timestamp (ms). */
  until?: number;
  /** Case-insensitive substring search over `detail` and `source`. */
  search?: string;
}

/**
 * Return a filtered view of the current timeline (1.14+).
 *
 * @example
 * ```ts
 * filterTimeline({ types: ['signal:update'], search: 'count' });
 * ```
 */
export const filterTimeline = (filter: TimelineFilter = {}): readonly TimelineEntry[] => {
  const types = filter.types ? new Set(filter.types) : undefined;
  const search = filter.search ? filter.search.toLowerCase() : undefined;
  return getTimeline().filter((entry) => {
    if (types && !types.has(entry.type)) return false;
    if (filter.since !== undefined && entry.timestamp < filter.since) return false;
    if (filter.until !== undefined && entry.timestamp > filter.until) return false;
    if (search) {
      const haystack = `${entry.detail} ${entry.source ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
};

// ---------------------------------------------------------------------------
// Structural diff
// ---------------------------------------------------------------------------

/** Single field change produced by {@link diffSignals} / {@link diffStores}. */
export interface DiffChange {
  /** Path of the changed field (label or store id). */
  key: string;
  /** Type of change. */
  kind: 'added' | 'removed' | 'changed';
  /** Previous value (`undefined` when added). */
  before?: unknown;
  /** Next value (`undefined` when removed). */
  after?: unknown;
}

const buildSnapshotMap = <T extends { label?: string; id?: string }>(
  snapshots: readonly T[],
  pick: (s: T) => unknown
): Map<string, unknown> => {
  const map = new Map<string, unknown>();
  for (const snap of snapshots) {
    const key = (snap.label ?? snap.id ?? '') as string;
    if (!key) continue;
    map.set(key, pick(snap));
  }
  return map;
};

const diffMaps = (prev: Map<string, unknown>, next: Map<string, unknown>): DiffChange[] => {
  const out: DiffChange[] = [];
  for (const [k, v] of next) {
    if (!prev.has(k)) {
      out.push({ key: k, kind: 'added', after: v });
    } else if (prev.get(k) !== v) {
      out.push({ key: k, kind: 'changed', before: prev.get(k), after: v });
    }
  }
  for (const [k, v] of prev) {
    if (!next.has(k)) {
      out.push({ key: k, kind: 'removed', before: v });
    }
  }
  return out;
};

/**
 * Structural diff between two signal snapshot arrays (1.14+).
 */
export const diffSignals = (
  prev: readonly SignalSnapshot[],
  next: readonly SignalSnapshot[]
): DiffChange[] => {
  return diffMaps(
    buildSnapshotMap(prev, (s) => s.value),
    buildSnapshotMap(next, (s) => s.value)
  );
};

/**
 * Structural diff between two store snapshot arrays (1.14+).
 */
export const diffStores = (
  prev: readonly StoreSnapshot[],
  next: readonly StoreSnapshot[]
): DiffChange[] => {
  return diffMaps(
    buildSnapshotMap(prev, (s) => s.state),
    buildSnapshotMap(next, (s) => s.state)
  );
};

// ---------------------------------------------------------------------------
// Signal tracing
// ---------------------------------------------------------------------------

const _traceMap = new Map<string, () => void>();

/**
 * Start logging every update event whose `source` matches the given label.
 * Useful for narrowing down which code path mutates a single signal.
 */
export const traceSignal = (label: string): void => {
  const existing = _traceMap.get(label);
  if (existing) {
    existing();
    _traceMap.delete(label);
  }
  const listener = (entry: TimelineEntry): void => {
    if (entry.source !== label) return;
    if (entry.type !== 'signal:update' && entry.type !== 'signal:create') return;
    const stack = new Error().stack?.split('\n').slice(2, 4).join(' ← ') ?? '';
    if (typeof console !== 'undefined') {
      console.log(`[bq:trace] ${label} ${entry.type} ${entry.detail} ${stack}`);
    }
  };
  const unsubscribe = subscribeTimeline(listener);
  _traceMap.set(label, () => unsubscribe());
};

/** Stop a previously started signal trace. */
export const untraceSignal = (label: string): void => {
  const off = _traceMap.get(label);
  if (off) {
    off();
    _traceMap.delete(label);
  }
};

// ---------------------------------------------------------------------------
// Effect inspector
// ---------------------------------------------------------------------------

/** Snapshot of a reactive effect, returned by {@link inspectEffects}. */
export interface EffectSnapshot {
  readonly label?: string;
  readonly runs: number;
  readonly disposed: boolean;
}

/** List currently tracked reactive effects created via {@link effect} (1.14+). */
export const inspectEffects = (): EffectSnapshot[] => {
  return __inspectTrackedEffects().map((snapshot) => ({ ...snapshot }));
};

// ---------------------------------------------------------------------------
// Snapshot export / import
// ---------------------------------------------------------------------------

/** Payload format produced by {@link exportDevtoolsSnapshot}. */
export interface DevtoolsSnapshot {
  readonly version: 1;
  readonly exportedAt: number;
  readonly state: DevtoolsState;
  readonly signals: readonly SignalSnapshot[];
  readonly stores: readonly StoreSnapshot[];
  readonly components: readonly ComponentSnapshot[];
}

/**
 * Capture the current devtools state for offline inspection or bug-reports.
 */
export const exportDevtoolsSnapshot = (): DevtoolsSnapshot => ({
  version: 1,
  exportedAt: Date.now(),
  state: getDevtoolsState(),
  signals: inspectSignals(),
  stores: inspectStores(),
  components: inspectComponents(),
});

/** Imported snapshot view as returned by {@link importDevtoolsSnapshot}. */
export interface ImportedDevtoolsSnapshot {
  readonly snapshot: DevtoolsSnapshot;
  /** Read-only timeline pulled from the imported snapshot. */
  readonly timeline: readonly TimelineEntry[];
}

/**
 * Parse a snapshot previously produced by {@link exportDevtoolsSnapshot}.
 * The current runtime state is **not** modified; the returned object can be
 * fed into a viewer or assertions.
 */
export const importDevtoolsSnapshot = (
  json: string | DevtoolsSnapshot
): ImportedDevtoolsSnapshot => {
  const snapshot = typeof json === 'string' ? (JSON.parse(json) as DevtoolsSnapshot) : json;
  if (!snapshot || snapshot.version !== 1) {
    throw new Error('bQuery devtools: unsupported snapshot format');
  }
  return { snapshot, timeline: snapshot.state.timeline };
};

// ---------------------------------------------------------------------------
// Browser bridge
// ---------------------------------------------------------------------------

/**
 * Install the bridge global `window.__BQUERY_DEVTOOLS__` and forward every
 * subsequent timeline event to it. The global is created if absent;
 * existing fields (such as the `stores` map maintained by the store module)
 * are preserved.
 *
 * No-op outside of a DOM environment.
 *
 * @returns Cleanup function that removes the listener.
 */
export const installBrowserBridge = (): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const w = window as Window & {
    __BQUERY_DEVTOOLS__?: {
      stores?: Map<string, unknown>;
      events?: TimelineEntry[];
      pushEvent?: (entry: TimelineEntry) => void;
      onStoreCreated?: (id: string, store: unknown) => void;
      onStateChange?: (id: string, state: unknown) => void;
    };
  };
  if (!w.__BQUERY_DEVTOOLS__) {
    w.__BQUERY_DEVTOOLS__ = { stores: new Map() };
  }
  const bridge = w.__BQUERY_DEVTOOLS__;
  if (!bridge.events) bridge.events = [];
  if (!bridge.pushEvent) {
    bridge.pushEvent = (entry: TimelineEntry): void => {
      bridge.events!.push(entry);
    };
  }
  return subscribeTimeline((entry) => {
    bridge.pushEvent?.(entry);
  });
};

// ---------------------------------------------------------------------------
// Performance helpers
// ---------------------------------------------------------------------------

const now = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

/**
 * Measure how long a function takes to execute and emit a `measure` event.
 */
export const time = <T>(label: string, fn: () => T): T => {
  const start = now();
  try {
    return fn();
  } finally {
    if (isDevtoolsEnabled()) {
      recordEvent('measure', label, { source: label, duration: now() - start });
    }
  }
};

/**
 * Variant of {@link time} that emits a `component:render` event.
 */
export const measureRender = <T>(tagName: string, fn: () => T): T => {
  const start = now();
  try {
    return fn();
  } finally {
    if (isDevtoolsEnabled()) {
      recordEvent('component:render', tagName, { source: tagName, duration: now() - start });
    }
  }
};

/**
 * Aggregate summary returned by {@link getPerformanceSummary}.
 */
export interface PerformanceSummary {
  readonly totalEvents: number;
  readonly countsByType: Readonly<Record<string, number>>;
  readonly averageDurationByType: Readonly<Record<string, number>>;
}

/**
 * Compute a per-type breakdown of the current timeline (counts + average
 * durations for `measure` / `component:render` events).
 */
export const getPerformanceSummary = (): PerformanceSummary => {
  const counts: Record<string, number> = {};
  const totals: Record<string, number> = {};
  const samples: Record<string, number> = {};
  for (const entry of getTimeline()) {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    if (typeof entry.duration === 'number') {
      totals[entry.type] = (totals[entry.type] ?? 0) + entry.duration;
      samples[entry.type] = (samples[entry.type] ?? 0) + 1;
    }
  }
  const averages: Record<string, number> = {};
  for (const type of Object.keys(totals)) {
    averages[type] = totals[type] / samples[type];
  }
  return {
    totalEvents: getTimeline().length,
    countsByType: counts,
    averageDurationByType: averages,
  };
};

// ---------------------------------------------------------------------------
// Re-exports referenced elsewhere
// ---------------------------------------------------------------------------

export {
  clearTimeline,
  enableDevtools,
  getDevtoolsState,
  getTimeline,
  inspectComponents,
  inspectSignals,
  inspectStores,
  isDevtoolsEnabled,
  recordEvent,
  subscribeTimeline,
  trackSignal,
};

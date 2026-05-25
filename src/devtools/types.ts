/**
 * Public types for the bQuery DevTools module.
 *
 * @module bquery/devtools
 */

// ---------------------------------------------------------------------------
// Signal inspector
// ---------------------------------------------------------------------------

/**
 * Snapshot of a signal's current state for the inspector.
 */
export interface SignalSnapshot {
  /** Debug label (if provided). */
  readonly label: string;
  /** Current value of the signal. */
  readonly value: unknown;
  /** Number of active subscribers. */
  readonly subscriberCount: number;
}

// ---------------------------------------------------------------------------
// Store inspector
// ---------------------------------------------------------------------------

/**
 * Snapshot of a store for the inspector.
 */
export interface StoreSnapshot {
  /** Store identifier. */
  readonly id: string;
  /** Current state (shallow clone). */
  readonly state: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Component inspector
// ---------------------------------------------------------------------------

/**
 * Snapshot of a registered bQuery component.
 */
export interface ComponentSnapshot {
  /** Custom element tag name. */
  readonly tagName: string;
  /** Number of live instances found in the DOM. */
  readonly instanceCount: number;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/** The type of event recorded in the timeline. */
export type TimelineEventType =
  | 'signal:update'
  | 'signal:create'
  | 'signal:dispose'
  | 'effect:run'
  | 'effect:dispose'
  | 'store:patch'
  | 'store:action'
  | 'route:change'
  | 'route:guard'
  | 'component:mount'
  | 'component:unmount'
  | 'component:render'
  | 'error:caught'
  | 'measure'
  | 'mark';

/**
 * A single timeline entry.
 *
 * 1.14+ adds `payload` and `source` for richer inspection without breaking
 * existing string `detail` consumers.
 */
export interface TimelineEntry {
  /** Timestamp (ms since epoch). */
  readonly timestamp: number;
  /** Event type. */
  readonly type: TimelineEventType;
  /** Human-readable description. */
  readonly detail: string;
  /** Optional structured payload describing the event. (1.14+) */
  readonly payload?: unknown;
  /** Optional emitter source identifier (e.g. signal label, store id). (1.14+) */
  readonly source?: string;
  /** Optional duration in milliseconds, used for measurements. (1.14+) */
  readonly duration?: number;
}

// ---------------------------------------------------------------------------
// DevTools options
// ---------------------------------------------------------------------------

/**
 * Options for {@link enableDevtools}.
 */
export interface DevtoolsOptions {
  /**
   * Whether to log timeline events to the console.
   * @default false
   */
  logToConsole?: boolean;

  /**
   * Maximum number of timeline entries retained before older ones are
   * evicted (ring buffer). Pass `Infinity` to disable. (1.14+)
   * @default 1000
   */
  maxTimelineEntries?: number;
}

// ---------------------------------------------------------------------------
// DevTools state
// ---------------------------------------------------------------------------

/**
 * The public devtools state object exposed by {@link getDevtoolsState}.
 */
export interface DevtoolsState {
  /** `true` when devtools are active. */
  readonly enabled: boolean;
  /** Options passed when devtools were enabled. */
  readonly options: Readonly<DevtoolsOptions>;
  /** Timeline entries recorded so far. */
  readonly timeline: readonly TimelineEntry[];
}

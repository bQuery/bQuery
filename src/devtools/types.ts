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
  | 'effect:run'
  | 'store:patch'
  | 'store:action'
  | 'route:change';

/**
 * A single timeline entry.
 */
export interface TimelineEntry {
  /** Timestamp (ms since epoch). */
  readonly timestamp: number;
  /** Event type. */
  readonly type: TimelineEventType;
  /** Human-readable description. */
  readonly detail: string;
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

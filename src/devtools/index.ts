/**
 * bQuery DevTools — runtime debugging utilities.
 *
 * Enable devtools to inspect signals, stores, components, and view a
 * timeline of reactive events.
 *
 * @module bquery/devtools
 *
 * @example
 * ```ts
 * import { enableDevtools, inspectSignals, logTimeline } from '@bquery/bquery/devtools';
 *
 * enableDevtools(true, { logToConsole: true });
 * // … use bQuery …
 * logTimeline(10);
 * ```
 */

// Types
export type {
  ComponentSnapshot,
  DevtoolsOptions,
  DevtoolsState,
  SignalSnapshot,
  StoreSnapshot,
  TimelineEntry,
  TimelineEventType,
} from './types';

// Runtime API
export {
  enableDevtools,
  isDevtoolsEnabled,
  trackSignal,
  untrackSignal,
  generateSignalLabel,
  inspectSignals,
  inspectStores,
  inspectComponents,
  recordEvent,
  getTimeline,
  clearTimeline,
  getDevtoolsState,
  logSignals,
  logStores,
  logComponents,
  logTimeline,
} from './devtools';

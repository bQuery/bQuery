/**
 * bQuery DevTools — runtime debugging utilities.
 *
 * Enable devtools to inspect signals, stores, components, and view a
 * timeline of reactive events.
 *
 * Targeting **Stable** in 1.15.0: the surface is frozen for one minor cycle.
 * A versioned bridge protocol (`connectDevtoolsBridge` / `createBridgeServer`,
 * `BRIDGE_PROTOCOL_VERSION`) is the stable contract the DevTools browser
 * extension connects to. The extension lives in its own repository:
 * https://github.com/bQuery/devtools-extension
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
  subscribeTimeline,
} from './devtools';

// 1.14+ — Extension helpers
export {
  diffSignals,
  diffStores,
  exportDevtoolsSnapshot,
  filterTimeline,
  getPerformanceSummary,
  importDevtoolsSnapshot,
  inspectEffects,
  installBrowserBridge,
  measureRender,
  time,
  traceSignal,
  untraceSignal,
} from './extensions';

export type {
  DevtoolsSnapshot,
  DiffChange,
  EffectSnapshot,
  ImportedDevtoolsSnapshot,
  PerformanceSummary,
  TimelineFilter,
} from './extensions';

// 1.15+ — Stable bridge protocol for the DevTools browser extension
export {
  BRIDGE_CAPABILITIES,
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_SOURCE,
  connectDevtoolsBridge,
  createBridgeServer,
  serializeComponentTree,
} from './bridge';

export type {
  BridgeConnection,
  BridgeInboundMessage,
  BridgeMethod,
  BridgeOutboundMessage,
  BridgeServer,
  BridgeServerOptions,
  ComponentTreeNode,
  ConnectBridgeOptions,
} from './bridge';

# Devtools

::: tip What's new in 1.14.0
Devtools graduated to a batteries-included tier in 1.14.0 with a ring-buffered timeline (`maxTimelineEntries`, default 1000), expanded `TimelineEntry` payloads, new event types (`signal:create` / `signal:dispose`, `effect:dispose`, `component:mount` / `unmount` / `render`, `route:guard`, `error:caught`, `measure`, `mark`), filterable + subscribable timelines (`filterTimeline`, `subscribeTimeline`), structural `diffSignals` / `diffStores`, signal traces (`traceSignal` / `untraceSignal`), `inspectEffects`, snapshot import/export (`exportDevtoolsSnapshot` / `importDevtoolsSnapshot`), an `installBrowserBridge()` for extension panels, and performance helpers (`time`, `measureRender`, `getPerformanceSummary`). See the [1.14.0 release notes](/release-notes/1.14#devtools-batteries-included).
:::

The devtools module provides lightweight runtime inspection utilities for debugging signals, stores, custom elements, and event timelines during development. It is designed for diagnostics and development feedback — not production analytics.

```ts
import {
  clearTimeline,
  enableDevtools,
  generateSignalLabel,
  getDevtoolsState,
  getTimeline,
  inspectComponents,
  inspectSignals,
  inspectStores,
  isDevtoolsEnabled,
  logComponents,
  logSignals,
  logStores,
  logTimeline,
  recordEvent,
  trackSignal,
  untrackSignal,
  // 1.14+ extensions
  filterTimeline,
  subscribeTimeline,
  diffSignals,
  diffStores,
  traceSignal,
  untraceSignal,
  inspectEffects,
  exportDevtoolsSnapshot,
  importDevtoolsSnapshot,
  installBrowserBridge,
  time,
  measureRender,
  getPerformanceSummary,
} from '@bquery/bquery/devtools';
```

## What's new in 1.14

### Configurable ring buffer

The timeline is capped at `maxTimelineEntries` events (default 1000) so
long-running sessions never grow without bound.

```ts
enableDevtools(true, { maxTimelineEntries: 500 });
```

### Timeline filtering & subscriptions

```ts
const failures = filterTimeline({ types: ['error:caught'], since: Date.now() - 60_000 });
const off = subscribeTimeline((entry) => console.debug(entry));
```

Entries now carry optional `payload`, `source`, and `duration`. New event
types: `signal:create`, `signal:dispose`, `effect:dispose`, `component:mount`,
`component:unmount`, `component:render`, `route:guard`, `error:caught`,
`measure`, `mark`.

### Inspection upgrades

```ts
inspectSignals({ includeValues: false }); // privacy-friendly snapshot
diffSignals(prev, next); // structural diff
traceSignal('cart.total');
inspectEffects(); // reactive effects created with effect()
```

### Snapshot export / import

```ts
const snap = exportDevtoolsSnapshot();
// Save snap to a file, send with a bug report, etc.
const replay = importDevtoolsSnapshot(JSON.stringify(snap));
```

### Browser bridge

```ts
installBrowserBridge(); // mirrors events to window.__BQUERY_DEVTOOLS__.events
```

### Performance helpers

```ts
const value = time('expensive', () => compute());
measureRender('my-card', () => render());
getPerformanceSummary(); // counts + averages per event type
```

---

## Stability

`devtools` has been **Beta**, and its biggest gap versus React/Vue/Svelte DevTools was the absence of a real **browser extension** — `installBrowserBridge()` only mirrored events to an in-page global. The work to graduate it is tracked in [#146](https://github.com/bQuery/bQuery/issues/146): stabilize the **bridge protocol** as the public contract between app and extension, ship a reference extension (component tree + signal/store inspection + timeline), and freeze the `devtools` API. It **graduated to Stable in 1.15.0**, with the surface frozen under the no-breaking-changes-between-minors contract.

### Exit criteria

- [x] **Stabilized, versioned bridge protocol** ([#146](https://github.com/bQuery/bQuery/issues/146)) — `connectDevtoolsBridge()`, `createBridgeServer()`, `BRIDGE_PROTOCOL_VERSION`, and the message contract are the frozen app↔extension surface. See [Bridge protocol](#bridge-protocol-v1).
- [x] **Reference browser extension shipped** — a Manifest V3 extension (component tree, signal/store inspection, live timeline) lives in [`extension/`](https://github.com/bQuery/bQuery/tree/main/extension) and connects over the protocol.
- [x] **Public surface frozen for one minor** — see [Frozen surface reference](#frozen-surface-reference-1150). The bridge additions are additive; existing runtime helpers are unchanged.
- [x] **Surface frozen** (no breaking changes) — committed under the Stable contract from 1.15.0.

### Frozen surface reference (1.15.0)

The frozen public surface of `@bquery/bquery/devtools`:

- **Lifecycle:** `enableDevtools`, `isDevtoolsEnabled`, `getDevtoolsState`.
- **Inspection:** `inspectSignals`, `inspectStores`, `inspectComponents`, `inspectEffects`, `trackSignal`, `untrackSignal`, `traceSignal`, `untraceSignal`.
- **Timeline:** `recordEvent`, `getTimeline`, `clearTimeline`, `filterTimeline`, `subscribeTimeline`.
- **Snapshots / diffs / perf:** `exportDevtoolsSnapshot`, `importDevtoolsSnapshot`, `diffSignals`, `diffStores`, `time`, `measureRender`, `getPerformanceSummary`.
- **Bridge (new in 1.15.0, additive):** `installBrowserBridge`, `connectDevtoolsBridge`, `createBridgeServer`, `serializeComponentTree`, `BRIDGE_PROTOCOL_VERSION`, `BRIDGE_SOURCE`, `BRIDGE_CAPABILITIES`.

### Bridge protocol (v1)

`connectDevtoolsBridge()` exposes a small, **versioned** message protocol over `window.postMessage` that the DevTools extension connects to. It is the stable contract between your app and the extension.

```ts
import { enableDevtools, connectDevtoolsBridge } from '@bquery/bquery/devtools';

enableDevtools(true);
const bridge = connectDevtoolsBridge(); // protocol v1 over window.postMessage
// ...later
bridge.disconnect();
```

Every message carries `source: 'bquery-devtools'` and a protocol version `v`:

| Direction    | `kind`     | Purpose                                      |
| ------------ | ---------- | -------------------------------------------- |
| panel → page | `hello`    | Announce the panel; page replies with `init` |
| panel → page | `request`  | `{ id, method, params }`                     |
| page → panel | `init`     | `{ capabilities }` handshake                 |
| page → panel | `response` | `{ id, result \| error }`                    |
| page → panel | `event`    | A streamed timeline `entry`                  |

**Built-in methods:** `ping`, `getSnapshot` (signals + stores + components + state), `getTimeline` (`{ limit }`), `getComponentTree` (serialized custom-element tree + flat counts). Supply extra/override methods via `connectDevtoolsBridge({ methods })`. The transport-agnostic `createBridgeServer({ post, methods })` powers it and can be embedded in any transport (and unit-tested without a DOM).

Time-travel is built on these primitives plus the existing `exportDevtoolsSnapshot` / `diffSignals` / `diffStores` helpers — the panel diffs successive snapshots rather than the protocol carrying mutation commands.

### The reference extension

A Manifest V3 reference extension lives in [`extension/`](https://github.com/bQuery/bQuery/tree/main/extension): load it unpacked (`chrome://extensions` → Developer mode → Load unpacked), enable the bridge in your app, and open the **bQuery** DevTools panel. See [`extension/README.md`](https://github.com/bQuery/bQuery/tree/main/extension/README.md) for details. The panel renders the component tree, live signal/store values, and the reactive timeline. It is intentionally minimal — the **protocol** is the stable contract; the panel is a starting point to extend.

---

## Getting Started

Enable devtools once at the start of your application. All devtools functionality is gated by this toggle — tracking, recording, and logging only occur when devtools are active.

```ts
import { enableDevtools, isDevtoolsEnabled } from '@bquery/bquery/devtools';

enableDevtools(true, { logToConsole: true });

console.log(isDevtoolsEnabled()); // true
```

When `logToConsole` is `true`, every timeline event is also printed to `console.log` in real time.

---

## Signal Tracking

Register signals with human-readable labels so you can inspect them later. Tracked signals appear in `inspectSignals()` and `logSignals()`.

### `trackSignal(label, peek, subscriberCount)`

```ts
function trackSignal(label: string, peek: () => unknown, subscriberCount: () => number): void;
```

| Parameter         | Type            | Description                                                |
| ----------------- | --------------- | ---------------------------------------------------------- |
| `label`           | `string`        | A non-empty, human-readable label for the signal           |
| `peek`            | `() => unknown` | A function that returns the current value without tracking |
| `subscriberCount` | `() => number`  | A function returning the current subscriber count          |

**Throws:** If `label` is empty.

```ts
import { signal } from '@bquery/bquery/reactive';
import { trackSignal } from '@bquery/bquery/devtools';

const count = signal(0);

// Reusing a label replaces the previously tracked entry
trackSignal(
  'counter',
  () => count.peek(),
  () => 0
);
```

### `untrackSignal(label)`

```ts
function untrackSignal(label: string): void;
```

Removes a previously tracked signal by its label. Safe to call if the label was never tracked.

```ts
import { untrackSignal } from '@bquery/bquery/devtools';

untrackSignal('counter');
```

### `generateSignalLabel()`

```ts
function generateSignalLabel(): string;
```

Generates unique, auto-incrementing labels such as `signal_0`, `signal_1`, etc. Useful when you need to track signals programmatically without manually naming them.

```ts
import { generateSignalLabel, trackSignal } from '@bquery/bquery/devtools';
import { signal } from '@bquery/bquery/reactive';

const s = signal('hello');
const label = generateSignalLabel(); // 'signal_0'
trackSignal(
  label,
  () => s.peek(),
  () => 0
);
```

---

## Runtime Inspection

These functions return snapshot data about the current state of tracked signals, stores, and custom elements.

### `inspectSignals()`

```ts
function inspectSignals(): SignalSnapshot[];
```

Returns an array of all tracked signals with their current values.

```ts
import { inspectSignals } from '@bquery/bquery/devtools';

const signals = inspectSignals();
// [{ label: 'counter', value: 42, subscriberCount: 3 }]
```

### `inspectStores()`

```ts
function inspectStores(): StoreSnapshot[];
```

Lists all stores registered with `@bquery/bquery/store`, along with their current state.

```ts
import { inspectStores } from '@bquery/bquery/devtools';

const stores = inspectStores();
// [{ id: 'user', state: { name: 'Ada', loggedIn: true } }]
```

### `inspectComponents()`

```ts
function inspectComponents(): ComponentSnapshot[];
```

Lists custom elements that are both registered and currently instantiated in the DOM, along with instance counts.

```ts
import { inspectComponents } from '@bquery/bquery/devtools';

const components = inspectComponents();
// [{ tagName: 'ui-button', instanceCount: 7 }]
```

### `getDevtoolsState()`

```ts
function getDevtoolsState(): DevtoolsState;
```

Returns a complete snapshot of the devtools module state: whether it's enabled, the current options, and the full timeline.

```ts
import { getDevtoolsState } from '@bquery/bquery/devtools';

const state = getDevtoolsState();
console.log(state.enabled); // true
console.log(state.options.logToConsole); // true
console.log(state.timeline.length); // 5
```

---

## Console Logging

For quick debugging sessions, use the logging helpers which pretty-print data to the browser console as tables.

### `logSignals()`

```ts
function logSignals(): void;
```

Prints a formatted table of all tracked signals to the console.

```ts
import { logSignals } from '@bquery/bquery/devtools';

logSignals();
// Console table: label | value | subscriberCount
```

### `logStores()`

```ts
function logStores(): void;
```

Prints a formatted table of all stores and their state to the console.

```ts
import { logStores } from '@bquery/bquery/devtools';

logStores();
// Console table: id | state
```

### `logComponents()`

```ts
function logComponents(): void;
```

Prints a formatted table of all custom elements to the console.

```ts
import { logComponents } from '@bquery/bquery/devtools';

logComponents();
// Console table: tagName | instanceCount
```

---

## Timeline

The timeline records a log of reactive events in your application. This is useful for debugging complex signal/effect/store interactions and understanding the order of operations.

### `recordEvent(type, detail)`

```ts
function recordEvent(type: TimelineEventType, detail: string): void;
```

Records a custom event into the timeline. When `logToConsole` is enabled, the event is also printed immediately.

| Parameter | Type                | Description                                                                                   |
| --------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `type`    | `TimelineEventType` | One of `'signal:update'`, `'effect:run'`, `'store:patch'`, `'store:action'`, `'route:change'` |
| `detail`  | `string`            | A human-readable description of what happened                                                 |

```ts
import { recordEvent } from '@bquery/bquery/devtools';

recordEvent('signal:update', 'count changed from 0 to 1');
recordEvent('store:action', 'user/login called');
recordEvent('route:change', 'navigated to /dashboard');
```

### `getTimeline()`

```ts
function getTimeline(): readonly TimelineEntry[];
```

Returns the full timeline log as a read-only array.

```ts
import { getTimeline } from '@bquery/bquery/devtools';

const entries = getTimeline();
for (const entry of entries) {
  console.log(`[${entry.type}] ${entry.detail} @ ${entry.timestamp}`);
}
```

### `logTimeline(last?)`

```ts
function logTimeline(last?: number): void;
```

Pretty-prints the timeline to the console. Optionally limits output to the last `N` entries.

```ts
import { logTimeline } from '@bquery/bquery/devtools';

logTimeline(); // All entries
logTimeline(10); // Only the 10 most recent entries
```

### `clearTimeline()`

```ts
function clearTimeline(): void;
```

Removes all recorded timeline entries.

```ts
import { clearTimeline } from '@bquery/bquery/devtools';

clearTimeline();
```

---

## Type Definitions

### `SignalSnapshot`

```ts
interface SignalSnapshot {
  readonly label: string;
  readonly value: unknown;
  readonly subscriberCount: number;
}
```

### `StoreSnapshot`

```ts
interface StoreSnapshot {
  readonly id: string;
  readonly state: Record<string, unknown>;
}
```

### `ComponentSnapshot`

```ts
interface ComponentSnapshot {
  readonly tagName: string;
  readonly instanceCount: number;
}
```

### `TimelineEventType`

```ts
type TimelineEventType =
  | 'signal:update'
  | 'effect:run'
  | 'store:patch'
  | 'store:action'
  | 'route:change';
```

### `TimelineEntry`

```ts
interface TimelineEntry {
  readonly timestamp: number;
  readonly type: TimelineEventType;
  readonly detail: string;
}
```

### `DevtoolsOptions`

```ts
interface DevtoolsOptions {
  /** Whether to log timeline events to console in real time. Default: `false`. */
  logToConsole?: boolean;
}
```

### `DevtoolsState`

```ts
interface DevtoolsState {
  readonly enabled: boolean;
  readonly options: Readonly<DevtoolsOptions>;
  readonly timeline: readonly TimelineEntry[];
}
```

---

## Full Example

```ts
import { signal, effect } from '@bquery/bquery/reactive';
import {
  enableDevtools,
  trackSignal,
  recordEvent,
  inspectSignals,
  logTimeline,
  clearTimeline,
} from '@bquery/bquery/devtools';

// 1. Enable devtools with console logging
enableDevtools(true, { logToConsole: true });

// 2. Create and track a signal
const count = signal(0);
trackSignal(
  'count',
  () => count.peek(),
  () => 0
);

// 3. Record events as your app runs
effect(() => {
  recordEvent('signal:update', `count is now ${count.value}`);
});

count.value = 1;
count.value = 2;

// 4. Inspect and log
console.log(inspectSignals());
// [{ label: 'count', value: 2, subscriberCount: 0 }]

logTimeline();
// Prints all recorded events to the console

// 5. Clean up
clearTimeline();
```

## Notes

- Intended for development and diagnostics, not production analytics.
- Pairs nicely with `@bquery/bquery/testing` when you want assertions over reactive behavior.
- All inspection methods return snapshot copies, not live references.
- Timeline events include millisecond timestamps for performance analysis.

<!-- uniform-template-footer -->

## Pitfalls and gotchas

- Timeline uses a ring buffer (default 1000 entries via `maxTimelineEntries`); long sessions overwrite old events.
- `inspectSignals({ includeValues: false })` is the privacy-aware default — pass `true` only in trusted dev contexts.
- `installBrowserBridge()` opens a `postMessage` channel; remove it before going to production.
- Snapshot export/import is structural only — it cannot reattach reactive subscribers, just inspect their shape.
- Performance helpers (`time`, `measureRender`, `mark`, `measure`) use `performance.mark` / `performance.measure` — they show up in browser devtools.

## Performance notes

- Disable devtools in production via tree-shaking by importing only in `import.meta.env.DEV` branches.
- `filterTimeline({ types, since, until, search })` is far cheaper than iterating snapshots in user code.

## Testing this module

- Combine `traceSignal()` / `untraceSignal()` with `bun:test` assertions to verify reactive flow.
- `diffSignals` / `diffStores` make snapshot diffs reviewable.

## Related modules

- [Reactive](./reactive) — the signals being inspected.
- [Store](./store) — store inspection helpers.
- [Testing](./testing) — ships its own reactive harnesses.

## Version history

- **1.15.0** — **graduated to Stable**: surface frozen for one minor cycle ([#146](https://github.com/bQuery/bQuery/issues/146)). New stable, versioned bridge protocol (`connectDevtoolsBridge`, `createBridgeServer`, `serializeComponentTree`, `BRIDGE_PROTOCOL_VERSION`) and a reference Manifest V3 browser extension (component tree + signal/store inspection + timeline) in `extension/`.
- **1.14.0** — ring-buffered timeline, expanded `TimelineEntry`, new event types, `filterTimeline`, `subscribeTimeline`, privacy-aware `inspectSignals`, `diffSignals` / `diffStores`, `traceSignal` / `untraceSignal`, `inspectEffects`, snapshot import/export, `installBrowserBridge`, perf helpers.

# Devtools

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
} from '@bquery/bquery/devtools';
```

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
function trackSignal(
  label: string,
  peek: () => unknown,
  subscriberCount: () => number
): void;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `label` | `string` | A non-empty, human-readable label for the signal |
| `peek` | `() => unknown` | A function that returns the current value without tracking |
| `subscriberCount` | `() => number` | A function returning the current subscriber count |

**Throws:** If `label` is empty.

```ts
import { signal } from '@bquery/bquery/reactive';
import { trackSignal } from '@bquery/bquery/devtools';

const count = signal(0);

// Reusing a label replaces the previously tracked entry
trackSignal('counter', () => count.peek(), () => 0);
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
trackSignal(label, () => s.peek(), () => 0);
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
console.log(state.enabled);           // true
console.log(state.options.logToConsole); // true
console.log(state.timeline.length);   // 5
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

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `TimelineEventType` | One of `'signal:update'`, `'effect:run'`, `'store:patch'`, `'store:action'`, `'route:change'` |
| `detail` | `string` | A human-readable description of what happened |

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

logTimeline();    // All entries
logTimeline(10);  // Only the 10 most recent entries
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
trackSignal('count', () => count.peek(), () => 0);

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

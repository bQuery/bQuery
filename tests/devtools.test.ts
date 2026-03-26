import { afterEach, describe, expect, it } from 'bun:test';
import {
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
} from '../src/devtools/index';
import type {
  SignalSnapshot,
  StoreSnapshot,
  ComponentSnapshot,
  TimelineEntry,
  DevtoolsState,
  TimelineEventType,
} from '../src/devtools/index';

// ---------------------------------------------------------------------------
// Reset after every test
// ---------------------------------------------------------------------------

afterEach(() => {
  enableDevtools(false);
});

// ============================================================================
// enableDevtools / isDevtoolsEnabled
// ============================================================================

describe('enableDevtools / isDevtoolsEnabled', () => {
  it('should default to disabled', () => {
    expect(isDevtoolsEnabled()).toBe(false);
  });

  it('should enable devtools', () => {
    enableDevtools(true);
    expect(isDevtoolsEnabled()).toBe(true);
  });

  it('should disable devtools and clear state', () => {
    enableDevtools(true);
    trackSignal('x', () => 1, () => 0);
    recordEvent('signal:update', 'test');
    enableDevtools(false);
    expect(isDevtoolsEnabled()).toBe(false);
    expect(inspectSignals()).toEqual([]);
    expect(getTimeline()).toEqual([]);
  });

  it('should accept options', () => {
    enableDevtools(true, { logToConsole: true });
    const state = getDevtoolsState();
    expect(state.options.logToConsole).toBe(true);
  });

  it('should use default options when none provided', () => {
    enableDevtools(true);
    const state = getDevtoolsState();
    expect(state.options).toEqual({});
  });
});

// ============================================================================
// Signal tracking
// ============================================================================

describe('trackSignal / untrackSignal', () => {
  it('should register a signal when enabled', () => {
    enableDevtools(true);
    trackSignal('count', () => 42, () => 3);
    const snaps = inspectSignals();
    expect(snaps).toHaveLength(1);
    expect(snaps[0].label).toBe('count');
    expect(snaps[0].value).toBe(42);
    expect(snaps[0].subscriberCount).toBe(3);
  });

  it('should silently ignore tracking when disabled', () => {
    trackSignal('ignored', () => 0, () => 0);
    enableDevtools(true);
    expect(inspectSignals()).toHaveLength(0);
  });

  it('should overwrite same label', () => {
    enableDevtools(true);
    trackSignal('a', () => 1, () => 0);
    trackSignal('a', () => 2, () => 0);
    const snaps = inspectSignals();
    expect(snaps).toHaveLength(1);
    expect(snaps[0].value).toBe(2);
  });

  it('should throw for empty label', () => {
    enableDevtools(true);
    expect(() => trackSignal('', () => 0, () => 0)).toThrow('non-empty label');
  });

  it('should remove a tracked signal', () => {
    enableDevtools(true);
    trackSignal('temp', () => 0, () => 0);
    untrackSignal('temp');
    expect(inspectSignals()).toHaveLength(0);
  });

  it('should not throw when untracking non-existent label', () => {
    untrackSignal('nope');
  });
});

// ============================================================================
// generateSignalLabel
// ============================================================================

describe('generateSignalLabel', () => {
  it('should produce sequential labels', () => {
    enableDevtools(true);
    // Note: counter is reset on disable. Enable fresh.
    enableDevtools(false);
    enableDevtools(true);
    const a = generateSignalLabel();
    const b = generateSignalLabel();
    expect(a).toBe('signal_0');
    expect(b).toBe('signal_1');
  });
});

// ============================================================================
// inspectSignals
// ============================================================================

describe('inspectSignals', () => {
  it('should return empty array when no signals tracked', () => {
    enableDevtools(true);
    expect(inspectSignals()).toEqual([]);
  });

  it('should reflect live values', () => {
    enableDevtools(true);
    let v = 10;
    trackSignal('dynamic', () => v, () => 1);
    expect(inspectSignals()[0].value).toBe(10);
    v = 20;
    expect(inspectSignals()[0].value).toBe(20);
  });

  it('should return correct type shape', () => {
    enableDevtools(true);
    trackSignal('typed', () => 'hello', () => 2);
    const snap: SignalSnapshot = inspectSignals()[0];
    expect(typeof snap.label).toBe('string');
    expect(typeof snap.subscriberCount).toBe('number');
  });
});

// ============================================================================
// inspectStores
// ============================================================================

describe('inspectStores', () => {
  it('should return StoreSnapshot array', () => {
    const result: StoreSnapshot[] = inspectStores();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ============================================================================
// inspectComponents
// ============================================================================

describe('inspectComponents', () => {
  it('should return ComponentSnapshot array', () => {
    const result: ComponentSnapshot[] = inspectComponents();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should detect registered custom elements in the DOM', () => {
    // Register a simple custom element
    const tagName = 'bq-devtools-test-el';
    if (!customElements.get(tagName)) {
      customElements.define(tagName, class extends HTMLElement {});
    }
    const el = document.createElement(tagName);
    document.body.appendChild(el);
    try {
      const snaps = inspectComponents();
      const found = snaps.find((c) => c.tagName === tagName);
      expect(found).toBeDefined();
      expect(found!.instanceCount).toBe(1);
    } finally {
      el.remove();
    }
  });

  it('should not include plain elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    try {
      const snaps = inspectComponents();
      expect(snaps.find((c) => c.tagName === 'div')).toBeUndefined();
    } finally {
      div.remove();
    }
  });
});

// ============================================================================
// Timeline: recordEvent / getTimeline / clearTimeline
// ============================================================================

describe('timeline', () => {
  it('should not record when disabled', () => {
    recordEvent('signal:update', 'nope');
    enableDevtools(true);
    expect(getTimeline()).toHaveLength(0);
  });

  it('should record events when enabled', () => {
    enableDevtools(true);
    recordEvent('signal:update', 'count → 5');
    recordEvent('effect:run', 'logger effect');
    const tl = getTimeline();
    expect(tl).toHaveLength(2);
    expect(tl[0].type).toBe('signal:update');
    expect(tl[0].detail).toBe('count → 5');
    expect(tl[1].type).toBe('effect:run');
  });

  it('should include a timestamp', () => {
    enableDevtools(true);
    const before = Date.now();
    recordEvent('store:patch', 'patched');
    const after = Date.now();
    const entry = getTimeline()[0];
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
  });

  it('should clear the timeline', () => {
    enableDevtools(true);
    recordEvent('route:change', '/ → /about');
    clearTimeline();
    expect(getTimeline()).toHaveLength(0);
  });

  it('should accept all event types', () => {
    enableDevtools(true);
    const types: TimelineEventType[] = [
      'signal:update',
      'effect:run',
      'store:patch',
      'store:action',
      'route:change',
    ];
    for (const type of types) {
      recordEvent(type, `detail for ${type}`);
    }
    expect(getTimeline()).toHaveLength(types.length);
  });

  it('should log to console when logToConsole is true', () => {
    enableDevtools(true, { logToConsole: true });
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    try {
      recordEvent('signal:update', 'test log');
      expect(logs.some((l) => l.includes('signal:update') && l.includes('test log'))).toBe(true);
    } finally {
      console.log = orig;
    }
  });

  it('should not log to console by default', () => {
    enableDevtools(true);
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    try {
      recordEvent('signal:update', 'quiet');
      expect(logs).toHaveLength(0);
    } finally {
      console.log = orig;
    }
  });
});

// ============================================================================
// getDevtoolsState
// ============================================================================

describe('getDevtoolsState', () => {
  it('should return a snapshot of the current state', () => {
    enableDevtools(true, { logToConsole: true });
    recordEvent('effect:run', 'x');

    const state: DevtoolsState = getDevtoolsState();
    expect(state.enabled).toBe(true);
    expect(state.options.logToConsole).toBe(true);
    expect(state.timeline).toHaveLength(1);
    expect(state.timeline[0].type).toBe('effect:run');
  });

  it('should return a detached copy of options', () => {
    enableDevtools(true, { logToConsole: false });
    const s1 = getDevtoolsState();
    enableDevtools(true, { logToConsole: true });
    const s2 = getDevtoolsState();
    expect(s1.options.logToConsole).toBe(false);
    expect(s2.options.logToConsole).toBe(true);
  });
});

// ============================================================================
// logSignals / logStores / logComponents / logTimeline
// ============================================================================

describe('log helpers', () => {
  it('logSignals prints table when signals exist', () => {
    enableDevtools(true);
    trackSignal('a', () => 1, () => 0);
    const calls: unknown[][] = [];
    const origTable = console.table;
    console.table = (...args: unknown[]) => calls.push(args);
    try {
      logSignals();
      expect(calls.length).toBeGreaterThanOrEqual(1);
    } finally {
      console.table = origTable;
    }
  });

  it('logSignals prints message when empty', () => {
    enableDevtools(true);
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    try {
      logSignals();
      expect(logs.some((l) => l.includes('No tracked signals'))).toBe(true);
    } finally {
      console.log = orig;
    }
  });

  it('logStores does not throw', () => {
    // When run alongside store tests, stores may already be registered.
    // Just verify the function executes without errors.
    const orig = console.log;
    const origTable = console.table;
    console.log = () => {};
    console.table = () => {};
    try {
      expect(() => logStores()).not.toThrow();
    } finally {
      console.log = orig;
      console.table = origTable;
    }
  });

  it('logComponents does not throw', () => {
    expect(() => logComponents()).not.toThrow();
  });

  it('logTimeline prints message when empty', () => {
    enableDevtools(true);
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    try {
      logTimeline();
      expect(logs.some((l) => l.includes('empty'))).toBe(true);
    } finally {
      console.log = orig;
    }
  });

  it('logTimeline supports last param', () => {
    enableDevtools(true);
    for (let i = 0; i < 5; i++) {
      recordEvent('signal:update', `event ${i}`);
    }
    const calls: unknown[][] = [];
    const origTable = console.table;
    console.table = (...args: unknown[]) => calls.push(args);
    try {
      logTimeline(2);
      expect(calls).toHaveLength(1);
      const rows = calls[0][0] as Array<Record<string, string>>;
      expect(rows).toHaveLength(2);
      expect(rows[1].detail).toBe('event 4');
    } finally {
      console.table = origTable;
    }
  });
});

// ============================================================================
// Module exports
// ============================================================================

describe('devtools module exports', () => {
  it('exports all public functions from barrel', async () => {
    const mod = await import('../src/devtools/index');
    expect(typeof mod.enableDevtools).toBe('function');
    expect(typeof mod.isDevtoolsEnabled).toBe('function');
    expect(typeof mod.trackSignal).toBe('function');
    expect(typeof mod.untrackSignal).toBe('function');
    expect(typeof mod.generateSignalLabel).toBe('function');
    expect(typeof mod.inspectSignals).toBe('function');
    expect(typeof mod.inspectStores).toBe('function');
    expect(typeof mod.inspectComponents).toBe('function');
    expect(typeof mod.recordEvent).toBe('function');
    expect(typeof mod.getTimeline).toBe('function');
    expect(typeof mod.clearTimeline).toBe('function');
    expect(typeof mod.getDevtoolsState).toBe('function');
    expect(typeof mod.logSignals).toBe('function');
    expect(typeof mod.logStores).toBe('function');
    expect(typeof mod.logComponents).toBe('function');
    expect(typeof mod.logTimeline).toBe('function');
  });

  it('is re-exported from main index', async () => {
    const mod = await import('../src/index');
    expect(typeof mod.enableDevtools).toBe('function');
    expect(typeof mod.inspectSignals).toBe('function');
    expect(typeof mod.recordEvent).toBe('function');
  });

  it('is exported from full bundle', async () => {
    const mod = await import('../src/full');
    expect(typeof mod.enableDevtools).toBe('function');
    expect(typeof mod.inspectSignals).toBe('function');
    expect(typeof mod.logTimeline).toBe('function');
  });
});

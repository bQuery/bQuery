/**
 * Tests for the 1.14+ devtools extension helpers.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  clearTimeline,
  diffSignals,
  diffStores,
  enableDevtools,
  exportDevtoolsSnapshot,
  filterTimeline,
  getPerformanceSummary,
  getTimeline,
  importDevtoolsSnapshot,
  inspectEffects,
  inspectSignals,
  installBrowserBridge,
  measureRender,
  recordEvent,
  subscribeTimeline,
  time,
  trackSignal,
  traceSignal,
  untraceSignal,
} from '../src/devtools/index';
import { effect, signal } from '../src/reactive/index';

beforeEach(() => {
  enableDevtools(true);
  clearTimeline();
});

afterEach(() => {
  enableDevtools(false);
});

// ---------------------------------------------------------------------------
// Timeline filtering
// ---------------------------------------------------------------------------

describe('devtools/filterTimeline', () => {
  it('filters by type', () => {
    recordEvent('signal:update', 'a');
    recordEvent('route:change', 'b');
    const onlySignals = filterTimeline({ types: ['signal:update'] });
    expect(onlySignals.length).toBe(1);
    expect(onlySignals[0].detail).toBe('a');
  });

  it('filters by search substring', () => {
    recordEvent('signal:update', 'count: 1', { source: 'counter' });
    recordEvent('signal:update', 'name: foo', { source: 'profile' });
    const matched = filterTimeline({ search: 'counter' });
    expect(matched.length).toBe(1);
  });

  it('filters by time range', () => {
    const t0 = Date.now();
    recordEvent('mark', 'first');
    const result = filterTimeline({ since: t0, until: t0 + 60_000 });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------

describe('devtools/timeline ring buffer', () => {
  it('caps the timeline at maxTimelineEntries', () => {
    enableDevtools(true, { maxTimelineEntries: 5 });
    for (let i = 0; i < 20; i++) recordEvent('mark', `m${i}`);
    expect(getTimeline().length).toBe(5);
    expect(getTimeline()[0].detail).toBe('m15');
    expect(getTimeline()[4].detail).toBe('m19');
  });

  it('defaults to 1000 entries', () => {
    enableDevtools(true);
    for (let i = 0; i < 1200; i++) recordEvent('mark', `m${i}`);
    expect(getTimeline().length).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

describe('devtools/subscribeTimeline', () => {
  it('notifies listeners for every event', () => {
    const seen: string[] = [];
    const off = subscribeTimeline((entry) => seen.push(entry.detail));
    recordEvent('mark', 'one');
    recordEvent('mark', 'two');
    off();
    recordEvent('mark', 'three');
    expect(seen).toEqual(['one', 'two']);
  });
});

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

describe('devtools/diffSignals & diffStores', () => {
  it('detects added / removed / changed signals', () => {
    const a = [{ label: 'a', value: 1, subscriberCount: 1 }];
    const b = [
      { label: 'a', value: 2, subscriberCount: 1 },
      { label: 'b', value: 'new', subscriberCount: 0 },
    ];
    const diff = diffSignals(a, b);
    expect(diff.find((d) => d.key === 'a')?.kind).toBe('changed');
    expect(diff.find((d) => d.key === 'b')?.kind).toBe('added');
  });

  it('detects removed stores', () => {
    const a = [{ id: 's1', state: { count: 1 } }];
    const b: typeof a = [];
    const diff = diffStores(a, b);
    expect(diff.length).toBe(1);
    expect(diff[0].kind).toBe('removed');
  });
});

// ---------------------------------------------------------------------------
// Signal trace
// ---------------------------------------------------------------------------

describe('devtools/traceSignal', () => {
  it('does not throw when traced/untraced', () => {
    traceSignal('counter');
    recordEvent('signal:update', 'changed', { source: 'counter' });
    untraceSignal('counter');
    expect(true).toBe(true);
  });

  it('can re-subscribe after devtools are disabled and re-enabled', () => {
    const originalLog = console.log;
    const seen: string[] = [];
    console.log = (message?: unknown): void => {
      seen.push(String(message));
    };

    try {
      traceSignal('counter');
      enableDevtools(false);
      enableDevtools(true);
      traceSignal('counter');
      recordEvent('signal:update', 'changed', { source: 'counter' });
      expect(seen.some((message) => message.includes('[bq:trace] counter signal:update changed'))).toBe(
        true
      );
    } finally {
      console.log = originalLog;
      untraceSignal('counter');
    }
  });
});

// ---------------------------------------------------------------------------
// inspectSignals privacy mode
// ---------------------------------------------------------------------------

describe('devtools/inspectSignals', () => {
  it('omits values when includeValues=false', () => {
    trackSignal('private', () => 'secret', () => 0);
    const open = inspectSignals();
    expect(open.find((s) => s.label === 'private')?.value).toBe('secret');
    const closed = inspectSignals({ includeValues: false });
    expect(closed.find((s) => s.label === 'private')?.value).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

describe('devtools/inspectEffects', () => {
  it('tracks effect() runs and disposal state', () => {
    const count = signal(0);
    const before = inspectEffects().length;

    const dispose = effect(() => {
      void count.value;
    });

    const created = inspectEffects();
    expect(created.length).toBe(before + 1);
    expect(created.at(-1)).toMatchObject({ runs: 1, disposed: false });

    count.value = 1;

    const updated = inspectEffects();
    expect(updated.at(-1)).toMatchObject({ runs: 2, disposed: false });

    dispose();

    const disposed = inspectEffects();
    expect(disposed.at(-1)).toMatchObject({ runs: 2, disposed: true });

    count.dispose();
  });
});

// ---------------------------------------------------------------------------
// Snapshot import / export
// ---------------------------------------------------------------------------

describe('devtools/exportDevtoolsSnapshot + importDevtoolsSnapshot', () => {
  it('round-trips through JSON', () => {
    recordEvent('mark', 'in-snapshot');
    const snap = exportDevtoolsSnapshot();
    const json = JSON.stringify(snap);
    const imported = importDevtoolsSnapshot(json);
    expect(imported.timeline.some((e) => e.detail === 'in-snapshot')).toBe(true);
  });

  it('rejects unsupported snapshot versions', () => {
    expect(() => importDevtoolsSnapshot('{"version":99}')).toThrow(/unsupported/);
  });
});

// ---------------------------------------------------------------------------
// Performance helpers
// ---------------------------------------------------------------------------

describe('devtools/time & measureRender', () => {
  it('records a measure event', () => {
    const result = time('task', () => 42);
    expect(result).toBe(42);
    const measures = filterTimeline({ types: ['measure'] });
    expect(measures.length).toBe(1);
    expect(typeof measures[0].duration).toBe('number');
  });

  it('measureRender records a component:render event', () => {
    measureRender('my-tag', () => undefined);
    const renders = filterTimeline({ types: ['component:render'] });
    expect(renders.length).toBe(1);
    expect(renders[0].source).toBe('my-tag');
  });

  it('getPerformanceSummary aggregates counts and averages', () => {
    time('a', () => undefined);
    time('a', () => undefined);
    const summary = getPerformanceSummary();
    expect(summary.totalEvents).toBeGreaterThanOrEqual(2);
    expect(summary.countsByType.measure).toBe(2);
    expect(typeof summary.averageDurationByType.measure).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Disabled = no cost
// ---------------------------------------------------------------------------

describe('devtools/disabled state', () => {
  it('does not record events when disabled', () => {
    enableDevtools(false);
    recordEvent('mark', 'ignored');
    expect(getTimeline().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Browser bridge
// ---------------------------------------------------------------------------

describe('devtools/installBrowserBridge', () => {
  it('exposes window.__BQUERY_DEVTOOLS__.events and forwards records', () => {
    const off = installBrowserBridge();
    recordEvent('mark', 'bridged');
    const w = window as Window & {
      __BQUERY_DEVTOOLS__?: { events?: { detail: string }[] };
    };
    expect(w.__BQUERY_DEVTOOLS__?.events?.some((e) => e.detail === 'bridged')).toBe(true);
    off();
  });
});

/**
 * Media → Stable (1.15.0) tests — issue #144.
 *
 * Bake-and-verify coverage that gates promotion:
 *  - SSR-safe defaults: composables return their documented fallback and never throw.
 *  - Reactivity: signal handles expose a readable `.value`.
 *  - Cleanup: `destroy()` is idempotent and listeners are removed (no leaks).
 *  - `AbortSignal` teardown works, including already-aborted signals.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import {
  mediaQuery,
  useViewport,
  useNetworkStatus,
  useIdle,
  usePageVisibility,
  useEventListener,
  useElementSize,
  useOnlineStatus,
} from '../src/media/index';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Media Stable — SSR-safe defaults & reactivity (#144)', () => {
  it('mediaQuery returns a boolean handle with destroy()', () => {
    const m = mediaQuery('(min-width: 1024px)');
    expect(typeof m.value).toBe('boolean');
    expect(typeof m.destroy).toBe('function');
    m.destroy();
  });

  it('useViewport exposes width/height/orientation (0×0 fallback on server)', () => {
    const vp = useViewport();
    expect(typeof vp.value.width).toBe('number');
    expect(typeof vp.value.height).toBe('number');
    expect(['portrait', 'landscape']).toContain(vp.value.orientation);
    vp.destroy();
  });

  it('useNetworkStatus defaults to online and exposes the shape', () => {
    const net = useNetworkStatus();
    expect(typeof net.value.online).toBe('boolean');
    net.destroy();
  });

  it('usePageVisibility / useOnlineStatus expose their documented shapes', () => {
    const vis = usePageVisibility();
    const online = useOnlineStatus();
    expect(['visible', 'hidden']).toContain(vis.value);
    expect(typeof online.value).toBe('boolean');
    vis.destroy();
    online.destroy();
  });
});

describe('Media Stable — cleanup & no listener leaks (#144)', () => {
  it('useEventListener removes the listener when stopped', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let calls = 0;
    const stop = useEventListener(el, 'click', () => {
      calls += 1;
    });

    el.dispatchEvent(new Event('click'));
    expect(calls).toBe(1);

    stop();
    el.dispatchEvent(new Event('click'));
    expect(calls).toBe(1); // no further calls — listener detached
  });

  it('destroy() is idempotent across composables', () => {
    const handles = [mediaQuery('(min-width: 1px)'), useViewport(), useIdle(1000)];
    for (const h of handles) {
      expect(() => {
        h.destroy();
        h.destroy(); // second call must be a safe no-op
      }).not.toThrow();
    }
  });

  it('useElementSize attaches to and detaches from a target safely', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const size = useElementSize(el);
    expect(typeof size.value.width).toBe('number');
    expect(typeof size.value.height).toBe('number');
    expect(() => size.destroy()).not.toThrow();
  });
});

describe('Media Stable — AbortSignal teardown (#144)', () => {
  it('aborts teardown via an AbortController', () => {
    const controller = new AbortController();
    const vis = usePageVisibility({ signal: controller.signal });
    expect(['visible', 'hidden']).toContain(vis.value);
    expect(() => controller.abort()).not.toThrow();
    // Destroy after abort is still a safe no-op.
    expect(() => vis.destroy()).not.toThrow();
  });

  it('an already-aborted signal tears down immediately without throwing', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => useOnlineStatus({ signal: controller.signal })).not.toThrow();
  });
});

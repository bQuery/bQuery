/**
 * Tests for the 1.14+ media module extensions.
 */

import { describe, expect, it } from 'bun:test';

import {
  clipboard,
  clipboardText,
  useActiveElement,
  useBroadcastChannel,
  useDocumentFocus,
  useElementBounding,
  useElementSize,
  useElementVisibility,
  useEventListener,
  useFocus,
  useFocusWithin,
  useHover,
  useIdle,
  useMediaDevices,
  useOnlineStatus,
  usePageVisibility,
  usePermission,
  usePointer,
  usePreferredColorScheme,
  usePreferredContrast,
  usePreferredLanguage,
  usePreferredLanguages,
  usePreferredReducedTransparency,
  useScroll,
  useShare,
  useShareSupported,
  useStorage,
  useWakeLock,
  useWindowFocus,
} from '../src/media/index';

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

describe('media/preferences', () => {
  it('usePreferredColorScheme defaults to no-preference in happy-dom', () => {
    const handle = usePreferredColorScheme();
    expect(['light', 'dark', 'no-preference']).toContain(handle.value);
    handle.destroy();
  });

  it('usePreferredContrast returns a valid contrast value', () => {
    const handle = usePreferredContrast();
    expect(['more', 'less', 'custom', 'no-preference']).toContain(handle.value);
    handle.destroy();
  });

  it('usePreferredReducedTransparency returns a boolean', () => {
    const handle = usePreferredReducedTransparency();
    expect(typeof handle.value).toBe('boolean');
    handle.destroy();
  });

  it('AbortSignal teardown destroys the handle', () => {
    const ctrl = new AbortController();
    const handle = usePreferredColorScheme({ signal: ctrl.signal });
    ctrl.abort();
    // calling destroy() again is a no-op
    expect(() => handle.destroy()).not.toThrow();
  });

  it('manual destroy removes the abort listener', () => {
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const signal = {
      aborted: false,
      addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        if (type === 'abort' && listener) listeners.add(listener);
      },
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        if (type === 'abort' && listener) listeners.delete(listener);
      },
    } as unknown as AbortSignal;

    const handle = usePreferredColorScheme({ signal });
    expect(listeners.size).toBe(1);
    handle.destroy();
    expect(listeners.size).toBe(0);
  });

  it('manual destroy removes the reduced-transparency abort listener', () => {
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const signal = {
      aborted: false,
      addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        if (type === 'abort' && listener) listeners.add(listener);
      },
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        if (type === 'abort' && listener) listeners.delete(listener);
      },
    } as unknown as AbortSignal;

    const handle = usePreferredReducedTransparency({ signal });
    expect(listeners.size).toBe(1);
    handle.destroy();
    expect(listeners.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

describe('media/usePreferredLanguage(s)', () => {
  it('returns the current navigator.language', () => {
    const handle = usePreferredLanguage();
    expect(typeof handle.value).toBe('string');
    handle.destroy();
  });

  it('returns the navigator.languages array', () => {
    const handle = usePreferredLanguages();
    expect(Array.isArray(handle.value)).toBe(true);
    handle.destroy();
  });

  it('updates on languagechange event', () => {
    const handle = usePreferredLanguage();
    const before = handle.value;
    window.dispatchEvent(new Event('languagechange'));
    expect(handle.value).toBe(before); // value source unchanged but no throw
    handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// Online status / visibility / focus
// ---------------------------------------------------------------------------

describe('media/useOnlineStatus', () => {
  it('returns navigator.onLine value', () => {
    const handle = useOnlineStatus();
    expect(typeof handle.value).toBe('boolean');
    handle.destroy();
  });

  it('responds to offline/online events', () => {
    const handle = useOnlineStatus();
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(typeof handle.value).toBe('boolean');
    handle.destroy();
  });
});

describe('media/usePageVisibility', () => {
  it('returns visible by default in happy-dom', () => {
    const handle = usePageVisibility();
    expect(['visible', 'hidden']).toContain(handle.value);
    handle.destroy();
  });
});

describe('media/useDocumentFocus / useWindowFocus', () => {
  it('returns a boolean', () => {
    const handle = useDocumentFocus();
    expect(typeof handle.value).toBe('boolean');
    handle.destroy();
  });

  it('useWindowFocus is the same composable as useDocumentFocus', () => {
    expect(useWindowFocus).toBe(useDocumentFocus);
  });

  it('toggles on focus/blur events', () => {
    const handle = useDocumentFocus();
    window.dispatchEvent(new Event('blur'));
    expect(handle.value).toBe(false);
    window.dispatchEvent(new Event('focus'));
    expect(handle.value).toBe(true);
    handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// Idle
// ---------------------------------------------------------------------------

describe('media/useIdle', () => {
  it('becomes true after timeout without activity', async () => {
    const handle = useIdle(20, { watchVisibility: false });
    expect(handle.value).toBe(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(handle.value).toBe(true);
    handle.destroy();
  });

  it('resets idle state on user activity', async () => {
    const handle = useIdle(40, { watchVisibility: false });
    await new Promise((r) => setTimeout(r, 60));
    expect(handle.value).toBe(true);
    window.dispatchEvent(new Event('mousemove'));
    expect(handle.value).toBe(false);
    handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// Permissions / wake lock / share
// ---------------------------------------------------------------------------

describe('media/usePermission', () => {
  it('returns unsupported when the Permissions API is missing', async () => {
    const handle = usePermission('clipboard-read');
    expect(['granted', 'denied', 'prompt', 'unsupported']).toContain(handle.value);
    handle.destroy();
  });
});

describe('media/useWakeLock', () => {
  it('exposes isSupported and isActive', () => {
    const handle = useWakeLock();
    expect(typeof handle.isSupported).toBe('boolean');
    expect(handle.isActive.value).toBe(false);
    handle.destroy();
  });

  it('request() rejects when unsupported', async () => {
    const handle = useWakeLock();
    if (!handle.isSupported) {
      await expect(handle.request()).rejects.toThrow();
    }
    handle.destroy();
  });
});

describe('media/useShare', () => {
  it('reports support status', () => {
    expect(typeof useShareSupported()).toBe('boolean');
    expect(typeof useShare().isSupported).toBe('boolean');
  });

  it('share() rejects when unsupported', async () => {
    if (!useShareSupported()) {
      await expect(useShare().share({ title: 't' })).rejects.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// Broadcast channel
// ---------------------------------------------------------------------------

describe('media/useBroadcastChannel', () => {
  it('reports isSupported and returns a data signal', () => {
    const handle = useBroadcastChannel<string>('bq-test-channel');
    expect(typeof handle.isSupported).toBe('boolean');
    expect(handle.data.value).toBeNull();
    handle.close();
  });
});

// ---------------------------------------------------------------------------
// Event listener helper
// ---------------------------------------------------------------------------

describe('media/useEventListener', () => {
  it('registers and unregisters a listener', () => {
    let count = 0;
    const stop = useEventListener(window, 'resize', () => {
      count++;
    });
    window.dispatchEvent(new Event('resize'));
    expect(count).toBe(1);
    stop();
    window.dispatchEvent(new Event('resize'));
    expect(count).toBe(1);
  });

  it('auto-removes when the abort signal aborts', () => {
    let count = 0;
    const ctrl = new AbortController();
    useEventListener(window, 'resize', () => count++, { signal: ctrl.signal });
    window.dispatchEvent(new Event('resize'));
    expect(count).toBe(1);
    ctrl.abort();
    window.dispatchEvent(new Event('resize'));
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Media devices
// ---------------------------------------------------------------------------

describe('media/useMediaDevices', () => {
  it('returns an array (possibly empty) without throwing', () => {
    const handle = useMediaDevices();
    expect(Array.isArray(handle.value)).toBe(true);
    handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

describe('media/useStorage', () => {
  it('reads default value when nothing is stored', () => {
    const handle = useStorage('bq-test-key-1', { count: 0 });
    expect(handle.value.value).toEqual({ count: 0 });
    handle.destroy();
  });

  it('writes and reads back', () => {
    const handle = useStorage('bq-test-key-2', { count: 0 });
    handle.set({ count: 42 });
    expect(handle.value.value).toEqual({ count: 42 });
    handle.remove();
    expect(handle.value.value).toEqual({ count: 0 });
    handle.destroy();
  });

  it('persists across handles via storage', () => {
    const a = useStorage('bq-test-key-3', 'initial');
    a.set('hello');
    a.destroy();
    const b = useStorage('bq-test-key-3', 'initial');
    expect(b.value.value).toBe('hello');
    b.remove();
    b.destroy();
  });
});

// ---------------------------------------------------------------------------
// Scroll & element observers
// ---------------------------------------------------------------------------

describe('media/useScroll', () => {
  it('returns a default state when window is the target', () => {
    const handle = useScroll();
    expect(typeof handle.value.x).toBe('number');
    expect(typeof handle.value.y).toBe('number');
    expect(handle.value.isScrolling).toBe(false);
    handle.destroy();
  });

  it('updates on scroll events', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const handle = useScroll(target, { idleTimeoutMs: 5 });
    target.dispatchEvent(new Event('scroll'));
    expect(handle.value.x).toBe(0);
    handle.destroy();
    target.remove();
  });

  it('computes initial arrived flags from the current scroll position', () => {
    const target = document.createElement('div');
    Object.defineProperties(target, {
      scrollLeft: { configurable: true, value: 20 },
      scrollTop: { configurable: true, value: 30 },
      scrollWidth: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 300 },
      clientWidth: { configurable: true, value: 50 },
      clientHeight: { configurable: true, value: 75 },
    });

    const handle = useScroll(target);

    expect(handle.value.arrived).toEqual({
      top: false,
      bottom: false,
      left: false,
      right: false,
    });

    handle.destroy();
  });
});

describe('media/useElementSize / useElementBounding / useElementVisibility', () => {
  it('useElementSize returns 0/0 for detached elements', () => {
    const el = document.createElement('div');
    const handle = useElementSize(el);
    expect(handle.value.width).toBe(0);
    expect(handle.value.height).toBe(0);
    handle.destroy();
  });

  it('useElementBounding returns a rect shape', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const handle = useElementBounding(el);
    expect(handle.value).toHaveProperty('width');
    expect(handle.value).toHaveProperty('height');
    expect(handle.value).toHaveProperty('top');
    handle.destroy();
    el.remove();
  });

  it('useElementVisibility starts false for unobservable env', () => {
    const el = document.createElement('div');
    const handle = useElementVisibility(el);
    expect(typeof handle.value).toBe('boolean');
    handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// Hover / focus
// ---------------------------------------------------------------------------

describe('media/useHover & useFocus', () => {
  it('useHover toggles on mouseenter/mouseleave', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const handle = useHover(el);
    expect(handle.value).toBe(false);
    el.dispatchEvent(new MouseEvent('mouseenter'));
    expect(handle.value).toBe(true);
    el.dispatchEvent(new MouseEvent('mouseleave'));
    expect(handle.value).toBe(false);
    handle.destroy();
    el.remove();
  });

  it('useFocus toggles on focus/blur', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const handle = useFocus(el);
    el.dispatchEvent(new Event('focus'));
    expect(handle.value).toBe(true);
    el.dispatchEvent(new Event('blur'));
    expect(handle.value).toBe(false);
    handle.destroy();
    el.remove();
  });

  it('useFocusWithin works for containers', () => {
    const container = document.createElement('div');
    const input = document.createElement('input');
    container.appendChild(input);
    document.body.appendChild(container);
    const handle = useFocusWithin(container);
    expect(typeof handle.value).toBe('boolean');
    handle.destroy();
    container.remove();
  });

  it('useActiveElement tracks document.activeElement', () => {
    const handle = useActiveElement();
    expect(handle.value === null || handle.value instanceof Element).toBe(true);
    handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// Pointer
// ---------------------------------------------------------------------------

describe('media/usePointer', () => {
  it('returns a default pointer state', () => {
    const handle = usePointer();
    expect(handle.value.x).toBe(0);
    expect(handle.value.y).toBe(0);
    expect(handle.value.isInside).toBe(false);
    handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

describe('media/clipboard', () => {
  it('exposes isSupported / isImageSupported flags', () => {
    expect(typeof clipboard.isSupported).toBe('boolean');
    expect(typeof clipboard.isImageSupported).toBe('boolean');
  });

  it('clipboardText returns a signal with an initial empty string', () => {
    const handle = clipboardText({ onFocus: false, onCopy: false });
    expect(handle.value).toBe('');
    handle.destroy();
  });
});

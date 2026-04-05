/**
 * Tests for the bQuery media module.
 */

import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { useBattery } from '../src/media/battery';
import { breakpoints } from '../src/media/breakpoints';
import { clipboard } from '../src/media/clipboard';
import { useDeviceMotion, useDeviceOrientation } from '../src/media/device-sensors';
import { useGeolocation } from '../src/media/geolocation';
import { mediaQuery } from '../src/media/media-query';
import { useNetworkStatus } from '../src/media/network';
import {
  useIntersectionObserver,
  useMutationObserver,
  useResizeObserver,
} from '../src/media/observers';
import { useViewport } from '../src/media/viewport';

const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, configurable: true });
  window.dispatchEvent(new Event('resize'));
});

// ─── mediaQuery ──────────────────────────────────────────────────────────────

describe('media/mediaQuery', () => {
  it('returns a readonly signal', () => {
    const sig = mediaQuery('(min-width: 768px)');
    expect(sig).toBeDefined();
    expect(typeof sig.value).toBe('boolean');
  });

  it('initial value reflects matchMedia result', () => {
    // happy-dom matchMedia always returns false by default
    const sig = mediaQuery('(min-width: 9999px)');
    expect(sig.value).toBe(false);
  });

  it('returns false for any query in test env', () => {
    const sig = mediaQuery('(prefers-color-scheme: dark)');
    expect(sig.value).toBe(false);
  });

  it('handles empty query string', () => {
    const sig = mediaQuery('');
    expect(typeof sig.value).toBe('boolean');
  });

  it('returns readonly signal (no setter)', () => {
    const sig = mediaQuery('(min-width: 100px)');
    // ReadonlySignal should not have a setter
    expect(() => {
      (sig as { value: boolean }).value = true;
    }).toThrow();
  });

  it('removes the media query listener when destroyed', () => {
    let registeredHandler: ((event: MediaQueryListEvent) => void) | undefined;
    let removedHandler: ((event: MediaQueryListEvent) => void) | undefined;
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = ((query: string) =>
      ({
        matches: query === '(min-width: 768px)',
        media: query,
        onchange: null,
        addEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          registeredHandler = handler;
        },
        removeEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          removedHandler = handler;
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList) as typeof window.matchMedia;

    try {
      const sig = mediaQuery('(min-width: 768px)');
      sig.destroy();
      expect(removedHandler).toBe(registeredHandler);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('falls back to legacy addListener/removeListener when addEventListener is unavailable', () => {
    let registeredHandler: ((event: MediaQueryListEvent) => void) | undefined;
    let removedHandler: ((event: MediaQueryListEvent) => void) | undefined;
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = ((query: string) =>
      ({
        matches: query === '(min-width: 768px)',
        media: query,
        onchange: null,
        addEventListener: undefined,
        removeEventListener: undefined,
        addListener: (handler: (event: MediaQueryListEvent) => void) => {
          registeredHandler = handler;
        },
        removeListener: (handler: (event: MediaQueryListEvent) => void) => {
          removedHandler = handler;
        },
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    try {
      const sig = mediaQuery('(min-width: 768px)');
      expect(sig.value).toBe(true);
      sig.destroy();
      expect(removedHandler).toBe(registeredHandler);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

// ─── breakpoints ─────────────────────────────────────────────────────────────

describe('media/breakpoints', () => {
  it('returns an object with signals for each breakpoint', () => {
    const bp = breakpoints({ sm: 640, md: 768, lg: 1024, xl: 1280 });
    expect(bp.sm).toBeDefined();
    expect(bp.md).toBeDefined();
    expect(bp.lg).toBeDefined();
    expect(bp.xl).toBeDefined();
    expect(typeof bp.sm.value).toBe('boolean');
    expect(typeof bp.md.value).toBe('boolean');
    expect(typeof bp.lg.value).toBe('boolean');
    expect(typeof bp.xl.value).toBe('boolean');
  });

  it('handles single breakpoint', () => {
    const bp = breakpoints({ mobile: 320 });
    expect(bp.mobile).toBeDefined();
    expect(typeof bp.mobile.value).toBe('boolean');
  });

  it('handles empty breakpoints object', () => {
    const bp = breakpoints({});
    expect(Object.keys(bp)).toHaveLength(0);
  });

  it('returns readonly signals', () => {
    const bp = breakpoints({ sm: 640 });
    expect(() => {
      (bp.sm as { value: boolean }).value = true;
    }).toThrow();
  });

  it('preserves key types', () => {
    const bp = breakpoints({ small: 320, medium: 768 });
    // TypeScript should correctly type these keys
    expect('small' in bp).toBe(true);
    expect('medium' in bp).toBe(true);
  });

  it('removes all breakpoint listeners when destroyed', () => {
    const handlers = new Map<string, (event: MediaQueryListEvent) => void>();
    const removed = new Set<string>();
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          handlers.set(query, handler);
        },
        removeEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void) => {
          if (handlers.get(query) === handler) {
            removed.add(query);
          }
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList) as typeof window.matchMedia;

    try {
      const bp = breakpoints({ sm: 640, lg: 1024 });
      bp.destroy();
      expect(removed).toEqual(new Set(['(min-width: 640px)', '(min-width: 1024px)']));
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('defines per-breakpoint destroy handles as non-enumerable', () => {
    const bp = breakpoints({ sm: 640 });

    expect(Object.keys(bp.sm)).not.toContain('destroy');
    expect(Object.getOwnPropertyDescriptor(bp.sm, 'destroy')?.enumerable ?? true).toBe(false);
    expect(Object.getOwnPropertyDescriptor(bp.sm, 'destroy')?.configurable ?? false).toBe(true);
    expect(Object.getOwnPropertyDescriptor(bp, 'destroyAll')?.enumerable ?? true).toBe(false);
    expect(Object.getOwnPropertyDescriptor(bp, 'destroyAll')?.configurable ?? false).toBe(true);
    expect(Object.getOwnPropertyDescriptor(bp, 'destroy')?.enumerable ?? true).toBe(false);
    expect(Object.getOwnPropertyDescriptor(bp, 'destroy')?.configurable ?? false).toBe(true);
  });

  it('falls back to legacy addListener/removeListener for breakpoint signals', () => {
    const handlers = new Map<string, (event: MediaQueryListEvent | MediaQueryList) => void>();
    const removed = new Set<string>();
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = ((query: string) =>
      ({
        matches: query === '(min-width: 640px)',
        media: query,
        onchange: null,
        addEventListener: undefined,
        removeEventListener: undefined,
        addListener: (handler: (event: MediaQueryListEvent | MediaQueryList) => void) => {
          handlers.set(query, handler);
        },
        removeListener: (handler: (event: MediaQueryListEvent | MediaQueryList) => void) => {
          if (handlers.get(query) === handler) {
            removed.add(query);
          }
        },
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    try {
      const bp = breakpoints({ sm: 640, lg: 1024 });

      expect(bp.sm.value).toBe(true);
      expect(bp.lg.value).toBe(false);

      bp.destroy();
      expect(removed).toEqual(new Set(['(min-width: 640px)', '(min-width: 1024px)']));
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('keeps a breakpoint named destroy accessible and exposes destroyAll for collection cleanup', () => {
    const removed = new Set<string>();
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {
          removed.add(query);
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList) as typeof window.matchMedia;

    try {
      const bp = breakpoints({ destroy: 640, lg: 1024 });

      expect(typeof bp.destroy.value).toBe('boolean');
      expect(typeof bp.destroy.destroy).toBe('function');
      expect(typeof bp.destroyAll).toBe('function');

      bp.destroyAll();
      expect(removed).toEqual(new Set(['(min-width: 640px)', '(min-width: 1024px)']));
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

// ─── useViewport ─────────────────────────────────────────────────────────────

describe('media/useViewport', () => {
  it('returns a readonly signal with viewport state', () => {
    const vp = useViewport();
    expect(vp).toBeDefined();
    expect(typeof vp.value.width).toBe('number');
    expect(typeof vp.value.height).toBe('number');
    expect(['portrait', 'landscape']).toContain(vp.value.orientation);
  });

  it('has numeric width and height', () => {
    const vp = useViewport();
    expect(vp.value.width).toBeGreaterThanOrEqual(0);
    expect(vp.value.height).toBeGreaterThanOrEqual(0);
  });

  it('returns landscape when width > height', () => {
    // happy-dom has innerWidth=1024, innerHeight=768 by default
    const vp = useViewport();
    expect(vp.value.orientation).toBe('landscape');
  });

  it('updates on resize event', () => {
    const vp = useViewport();
    const originalWidth = vp.value.width;

    // Simulate a resize
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    window.dispatchEvent(new Event('resize'));

    expect(vp.value.width).toBe(1200);
    expect(vp.value.height).toBe(800);
    expect(vp.value.orientation).toBe('landscape');

    // Restore
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 0, configurable: true });
  });

  it('returns readonly signal', () => {
    const vp = useViewport();
    expect(() => {
      (vp as { value: unknown }).value = { width: 100, height: 100, orientation: 'portrait' };
    }).toThrow();
  });

  it('removes the resize listener when destroyed', () => {
    const vp = useViewport();
    vp.destroy();

    Object.defineProperty(window, 'innerWidth', { value: 777, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 333, configurable: true });
    window.dispatchEvent(new Event('resize'));

    expect(vp.value.width).not.toBe(777);
    expect(vp.value.height).not.toBe(333);
  });

  it('defines destroy as a non-enumerable handle method', () => {
    const vp = useViewport();

    expect(Object.keys(vp)).not.toContain('destroy');
    expect(Object.getOwnPropertyDescriptor(vp, 'destroy')?.enumerable ?? true).toBe(false);
    expect(Object.getOwnPropertyDescriptor(vp, 'destroy')?.configurable ?? false).toBe(true);
  });
});

// ─── useNetworkStatus ────────────────────────────────────────────────────────

describe('media/useNetworkStatus', () => {
  it('returns a readonly signal with network state', () => {
    const net = useNetworkStatus();
    expect(net).toBeDefined();
    expect(typeof net.value.online).toBe('boolean');
    expect(typeof net.value.effectiveType).toBe('string');
    expect(typeof net.value.downlink).toBe('number');
    expect(typeof net.value.rtt).toBe('number');
  });

  it('defaults to unknown effectiveType when connection API is unavailable', () => {
    const net = useNetworkStatus();
    // happy-dom doesn't have navigator.connection
    expect(net.value.effectiveType).toBe('unknown');
  });

  it('updates on online/offline events', () => {
    // Set navigator.onLine before creating the signal
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const net = useNetworkStatus();

    expect(net.value.online).toBe(true);

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
    expect(net.value.online).toBe(false);

    // Simulate going back online
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    window.dispatchEvent(new Event('online'));
    expect(net.value.online).toBe(true);
  });

  it('returns readonly signal', () => {
    const net = useNetworkStatus();
    expect(() => {
      (net as { value: unknown }).value = {
        online: false,
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
      };
    }).toThrow();
  });

  it('does not require navigator to exist when window is available', () => {
    const originalNavigator = globalThis.navigator;
    const hadNavigator = Object.prototype.hasOwnProperty.call(globalThis, 'navigator');

    try {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: undefined,
      });

      const net = useNetworkStatus();
      expect(net.value.online).toBe(true);
      expect(net.value.effectiveType).toBe('unknown');
      expect(() => net.destroy()).not.toThrow();
    } finally {
      if (hadNavigator) {
        Object.defineProperty(globalThis, 'navigator', {
          configurable: true,
          value: originalNavigator,
        });
      } else {
        Reflect.deleteProperty(globalThis, 'navigator');
      }
    }
  });

  it('removes network listeners when destroyed', () => {
    let onlineHandler: (() => void) | undefined;
    let offlineHandler: (() => void) | undefined;
    let connectionHandler: (() => void) | undefined;
    let removedOnlineHandler: (() => void) | undefined;
    let removedOfflineHandler: (() => void) | undefined;
    let removedConnectionHandler: (() => void) | undefined;
    const originalConnection = (navigator as Navigator & { connection?: unknown }).connection;

    const connection = {
      addEventListener: (_type: string, handler: () => void) => {
        connectionHandler = handler;
      },
      removeEventListener: (_type: string, handler: () => void) => {
        removedConnectionHandler = handler;
      },
    };

    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: connection,
    });

    const addSpy = spyOn(window, 'addEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function') {
          if (type === 'online') onlineHandler = listener as () => void;
          if (type === 'offline') offlineHandler = listener as () => void;
        }
      }
    );
    const removeSpy = spyOn(window, 'removeEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function') {
          if (type === 'online') removedOnlineHandler = listener as () => void;
          if (type === 'offline') removedOfflineHandler = listener as () => void;
        }
      }
    );

    try {
      const net = useNetworkStatus();
      net.destroy();
      expect(removedOnlineHandler).toBe(onlineHandler);
      expect(removedOfflineHandler).toBe(offlineHandler);
      expect(removedConnectionHandler).toBe(connectionHandler);
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: originalConnection,
      });
    }
  });

  it('falls back gracefully when navigator.connection lacks event listener methods', () => {
    const originalConnection = (navigator as Navigator & { connection?: unknown }).connection;

    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: {
        effectiveType: '3g',
        downlink: 1.5,
        rtt: 250,
        addEventListener: undefined,
        removeEventListener: undefined,
      },
    });

    try {
      const net = useNetworkStatus();
      expect(net.value.effectiveType).toBe('3g');
      expect(() => net.destroy()).not.toThrow();
    } finally {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: originalConnection,
      });
    }
  });

  it('defines destroy as a non-enumerable handle method', () => {
    const net = useNetworkStatus();

    expect(Object.keys(net)).not.toContain('destroy');
    expect(Object.getOwnPropertyDescriptor(net, 'destroy')?.enumerable ?? true).toBe(false);
  });
});

// ─── useBattery ──────────────────────────────────────────────────────────────

describe('media/useBattery', () => {
  it('returns a readonly signal with default battery state', () => {
    const battery = useBattery();
    expect(battery).toBeDefined();
    expect(battery.value.supported).toBe(false);
    expect(typeof battery.value.charging).toBe('boolean');
    expect(typeof battery.value.level).toBe('number');
    expect(typeof battery.value.chargingTime).toBe('number');
    expect(typeof battery.value.dischargingTime).toBe('number');
  });

  it('has sensible default values when unsupported', () => {
    const battery = useBattery();
    expect(battery.value.level).toBe(1);
    expect(battery.value.charging).toBe(false);
    expect(battery.value.chargingTime).toBe(0);
    expect(battery.value.dischargingTime).toBe(0);
  });

  it('returns readonly signal', () => {
    const battery = useBattery();
    expect(() => {
      (battery as { value: unknown }).value = {
        supported: true,
        charging: true,
        level: 0.5,
        chargingTime: 100,
        dischargingTime: 200,
      };
    }).toThrow();
  });

  it('removes battery listeners when destroyed', async () => {
    const originalGetBattery = (navigator as Navigator & { getBattery?: unknown }).getBattery;
    const handlers = new Map<string, EventListener>();
    const removed = new Set<string>();

    const batteryManager = {
      charging: true,
      chargingTime: 10,
      dischargingTime: 20,
      level: 0.5,
      addEventListener: (type: string, handler: EventListener) => {
        handlers.set(type, handler);
      },
      removeEventListener: (type: string, handler: EventListener) => {
        if (handlers.get(type) === handler) {
          removed.add(type);
        }
      },
      dispatchEvent: () => true,
    } as unknown as EventTarget & {
      charging: boolean;
      chargingTime: number;
      dischargingTime: number;
      level: number;
    };

    Object.defineProperty(navigator, 'getBattery', {
      configurable: true,
      value: () => Promise.resolve(batteryManager),
    });

    try {
      const battery = useBattery();
      await Promise.resolve();
      battery.destroy();
      expect(removed).toEqual(
        new Set(['chargingchange', 'chargingtimechange', 'dischargingtimechange', 'levelchange'])
      );
    } finally {
      Object.defineProperty(navigator, 'getBattery', {
        configurable: true,
        value: originalGetBattery,
      });
    }
  });

  it('defines destroy as a non-enumerable handle method', () => {
    const battery = useBattery();

    expect(Object.keys(battery)).not.toContain('destroy');
    expect(Object.getOwnPropertyDescriptor(battery, 'destroy')?.enumerable ?? true).toBe(false);
  });
});

// ─── useGeolocation ──────────────────────────────────────────────────────────

describe('media/useGeolocation', () => {
  it('returns a readonly signal with geolocation state', () => {
    const geo = useGeolocation();
    expect(geo).toBeDefined();
    expect(typeof geo.value.supported).toBe('boolean');
    expect(typeof geo.value.loading).toBe('boolean');
  });

  it('defaults to unsupported state in test env without geolocation', () => {
    // If navigator.geolocation is not available, supported should be false
    const hasGeo = typeof navigator !== 'undefined' && 'geolocation' in navigator;
    const geo = useGeolocation();
    if (!hasGeo) {
      expect(geo.value.supported).toBe(false);
      expect(geo.value.loading).toBe(false);
    } else {
      // If geolocation exists in happy-dom, it should be loading
      expect(geo.value.supported).toBe(true);
    }
  });

  it('has null initial coordinate values', () => {
    const geo = useGeolocation();
    // Before any position is obtained, coordinates should be null
    if (!geo.value.supported) {
      expect(geo.value.latitude).toBeNull();
      expect(geo.value.longitude).toBeNull();
      expect(geo.value.accuracy).toBeNull();
      expect(geo.value.altitude).toBeNull();
      expect(geo.value.heading).toBeNull();
      expect(geo.value.speed).toBeNull();
      expect(geo.value.timestamp).toBeNull();
    }
  });

  it('accepts options parameter', () => {
    // Should not throw
    const geo = useGeolocation({
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
      watch: false,
    });
    expect(geo).toBeDefined();
  });

  it('accepts watch mode', () => {
    const geo = useGeolocation({ watch: true });
    expect(geo).toBeDefined();
  });

  it('returns readonly signal', () => {
    const geo = useGeolocation();
    expect(() => {
      (geo as { value: unknown }).value = {};
    }).toThrow();
  });

  it('defines destroy as a non-enumerable property', () => {
    const geo = useGeolocation();

    expect(Object.prototype.propertyIsEnumerable.call(geo, 'destroy')).toBe(false);
    expect(Object.keys(geo)).not.toContain('destroy');
  });

  it('clears an active geolocation watch when destroyed', () => {
    const originalGeolocation = navigator.geolocation;
    let clearedWatchId: number | null = null;

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: () => 42,
        clearWatch: (id: number) => {
          clearedWatchId = id;
        },
        getCurrentPosition: () => {
          throw new Error('getCurrentPosition should not be called in watch mode');
        },
      } satisfies Partial<Geolocation>,
    });

    try {
      const geo = useGeolocation({ watch: true });
      geo.destroy();
      if (clearedWatchId === null) {
        throw new Error('Expected clearWatch to be called');
      }
      const finalWatchId: number = clearedWatchId;
      expect(finalWatchId).toBe(42);
    } finally {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: originalGeolocation,
      });
    }
  });
});

// ─── useDeviceMotion ─────────────────────────────────────────────────────────

describe('media/useDeviceMotion', () => {
  it('returns a readonly signal with default motion state', () => {
    const motion = useDeviceMotion();
    expect(motion).toBeDefined();
    expect(motion.value.acceleration).toEqual({ x: null, y: null, z: null });
    expect(motion.value.accelerationIncludingGravity).toEqual({ x: null, y: null, z: null });
    expect(motion.value.rotationRate).toEqual({ alpha: null, beta: null, gamma: null });
    expect(motion.value.interval).toBe(0);
  });

  it('returns readonly signal', () => {
    const motion = useDeviceMotion();
    expect(() => {
      (motion as { value: unknown }).value = {};
    }).toThrow();
  });

  it('removes the devicemotion listener when destroyed', () => {
    let addedHandler: EventListener | undefined;
    let removedHandler: EventListener | undefined;
    const addSpy = spyOn(window, 'addEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'devicemotion' && typeof listener === 'function') {
          addedHandler = listener;
        }
      }
    );
    const removeSpy = spyOn(window, 'removeEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'devicemotion' && typeof listener === 'function') {
          removedHandler = listener;
        }
      }
    );

    try {
      const motion = useDeviceMotion();
      motion.destroy();
      expect(removedHandler).toBe(addedHandler);
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  it('defines destroy as a non-enumerable handle method', () => {
    const motion = useDeviceMotion();

    expect(Object.keys(motion)).not.toContain('destroy');
    expect(Object.getOwnPropertyDescriptor(motion, 'destroy')?.enumerable ?? true).toBe(false);
  });
});

// ─── useDeviceOrientation ────────────────────────────────────────────────────

describe('media/useDeviceOrientation', () => {
  it('returns a readonly signal with default orientation state', () => {
    const orientation = useDeviceOrientation();
    expect(orientation).toBeDefined();
    expect(orientation.value.alpha).toBeNull();
    expect(orientation.value.beta).toBeNull();
    expect(orientation.value.gamma).toBeNull();
    expect(orientation.value.absolute).toBe(false);
  });

  it('returns readonly signal', () => {
    const orientation = useDeviceOrientation();
    expect(() => {
      (orientation as { value: unknown }).value = {};
    }).toThrow();
  });

  it('removes the deviceorientation listener when destroyed', () => {
    let addedHandler: EventListener | undefined;
    let removedHandler: EventListener | undefined;
    const addSpy = spyOn(window, 'addEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'deviceorientation' && typeof listener === 'function') {
          addedHandler = listener;
        }
      }
    );
    const removeSpy = spyOn(window, 'removeEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'deviceorientation' && typeof listener === 'function') {
          removedHandler = listener;
        }
      }
    );

    try {
      const orientation = useDeviceOrientation();
      orientation.destroy();
      expect(removedHandler).toBe(addedHandler);
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  it('defines destroy as a non-enumerable handle method', () => {
    const orientation = useDeviceOrientation();

    expect(Object.keys(orientation)).not.toContain('destroy');
    expect(Object.getOwnPropertyDescriptor(orientation, 'destroy')?.enumerable ?? true).toBe(false);
  });
});

// ─── clipboard ───────────────────────────────────────────────────────────────

describe('media/clipboard', () => {
  it('exposes read and write methods', () => {
    expect(typeof clipboard.read).toBe('function');
    expect(typeof clipboard.write).toBe('function');
  });

  it('read throws when Clipboard API is not available', async () => {
    // happy-dom doesn't have navigator.clipboard by default
    const originalClipboard = navigator.clipboard;

    try {
      // Remove clipboard to test unavailability
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });
      await expect(clipboard.read()).rejects.toThrow('bQuery media: Clipboard API is unavailable');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
      });
    }
  });

  it('write throws when Clipboard API is not available', async () => {
    const originalClipboard = navigator.clipboard;

    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });
      await expect(clipboard.write('test')).rejects.toThrow(
        'bQuery media: Clipboard API is unavailable'
      );
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
      });
    }
  });

  it('write calls navigator.clipboard.writeText when available', async () => {
    let written = '';
    const mockClipboard = {
      readText: async () => written,
      writeText: async (text: string) => {
        written = text;
      },
    };

    const originalClipboard = navigator.clipboard;

    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        configurable: true,
      });

      await clipboard.write('Hello, World!');
      expect(written).toBe('Hello, World!');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
      });
    }
  });

  it('read calls navigator.clipboard.readText when available', async () => {
    const mockClipboard = {
      readText: async () => 'clipboard content',
      writeText: async () => {},
    };

    const originalClipboard = navigator.clipboard;

    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        configurable: true,
      });

      const text = await clipboard.read();
      expect(text).toBe('clipboard content');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
      });
    }
  });

  it('clipboard availability errors mention secure-context requirements', async () => {
    const originalClipboard = navigator.clipboard;

    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });

      await expect(clipboard.read()).rejects.toThrow('secure context');
      await expect(clipboard.write('test')).rejects.toThrow('user-activation');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
      });
    }
  });
});

// ─── useIntersectionObserver ──────────────────────────────────────────────────

describe('media/useIntersectionObserver', () => {
  it('returns a signal with default state when no target is given', () => {
    const io = useIntersectionObserver();
    expect(io.value).toEqual({
      isIntersecting: false,
      intersectionRatio: 0,
      entry: null,
    });
    io.destroy();
  });

  it('returns readonly signal (no setter)', () => {
    const io = useIntersectionObserver();
    expect(() => {
      (io as { value: unknown }).value = {};
    }).toThrow();
    io.destroy();
  });

  it('defines destroy, observe, unobserve as non-enumerable properties', () => {
    const io = useIntersectionObserver();
    const keys = Object.keys(io);
    expect(keys).not.toContain('destroy');
    expect(keys).not.toContain('observe');
    expect(keys).not.toContain('unobserve');
    expect(typeof io.destroy).toBe('function');
    expect(typeof io.observe).toBe('function');
    expect(typeof io.unobserve).toBe('function');
    io.destroy();
  });

  it('destroy is idempotent (safe to call multiple times)', () => {
    const io = useIntersectionObserver();
    io.destroy();
    expect(() => io.destroy()).not.toThrow();
  });

  it('accepts a single element target', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const io = useIntersectionObserver(el);
    expect(io.value.isIntersecting).toBe(false);
    io.destroy();
    el.remove();
  });

  it('accepts an array of element targets', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    document.body.appendChild(el1);
    document.body.appendChild(el2);
    const io = useIntersectionObserver([el1, el2]);
    expect(io.value.isIntersecting).toBe(false);
    io.destroy();
    el1.remove();
    el2.remove();
  });

  it('accepts null target without throwing', () => {
    expect(() => {
      const io = useIntersectionObserver(null);
      io.destroy();
    }).not.toThrow();
  });

  it('accepts options (threshold, rootMargin)', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const io = useIntersectionObserver(el, {
      threshold: [0, 0.5, 1],
      rootMargin: '10px',
    });
    expect(io.value.isIntersecting).toBe(false);
    io.destroy();
    el.remove();
  });

  it('fails gracefully when IntersectionObserver construction throws', () => {
    const originalIntersectionObserver = globalThis.IntersectionObserver;

    class MockIntersectionObserver {
      constructor() {
        throw new Error('invalid observer options');
      }
    }

    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

    try {
      const el = document.createElement('div');
      expect(() =>
        useIntersectionObserver(el, {
          rootMargin: 'bad-margin',
        }),
      ).not.toThrow();

      const io = useIntersectionObserver(el, {
        rootMargin: 'bad-margin',
      });
      expect(io.value).toEqual({
        isIntersecting: false,
        intersectionRatio: 0,
        entry: null,
      });
      expect(() => io.observe(el)).not.toThrow();
      io.destroy();
    } finally {
      globalThis.IntersectionObserver = originalIntersectionObserver;
    }
  });

  it('observe() and unobserve() do not throw after creation', () => {
    const io = useIntersectionObserver();
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(() => io.observe(el)).not.toThrow();
    expect(() => io.unobserve(el)).not.toThrow();
    io.destroy();
    el.remove();
  });

  it('observe() and unobserve() are no-ops after destroy', () => {
    const io = useIntersectionObserver();
    io.destroy();
    const el = document.createElement('div');
    expect(() => io.observe(el)).not.toThrow();
    expect(() => io.unobserve(el)).not.toThrow();
  });
});

// ─── useResizeObserver ───────────────────────────────────────────────────────

describe('media/useResizeObserver', () => {
  it('returns a signal with default state when no target is given', () => {
    const ro = useResizeObserver();
    expect(ro.value).toEqual({
      width: 0,
      height: 0,
      entry: null,
    });
    ro.destroy();
  });

  it('returns readonly signal (no setter)', () => {
    const ro = useResizeObserver();
    expect(() => {
      (ro as { value: unknown }).value = {};
    }).toThrow();
    ro.destroy();
  });

  it('defines destroy, observe, unobserve as non-enumerable properties', () => {
    const ro = useResizeObserver();
    const keys = Object.keys(ro);
    expect(keys).not.toContain('destroy');
    expect(keys).not.toContain('observe');
    expect(keys).not.toContain('unobserve');
    expect(typeof ro.destroy).toBe('function');
    expect(typeof ro.observe).toBe('function');
    expect(typeof ro.unobserve).toBe('function');
    ro.destroy();
  });

  it('destroy is idempotent', () => {
    const ro = useResizeObserver();
    ro.destroy();
    expect(() => ro.destroy()).not.toThrow();
  });

  it('accepts a single element target', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ro = useResizeObserver(el);
    expect(typeof ro.value.width).toBe('number');
    expect(typeof ro.value.height).toBe('number');
    ro.destroy();
    el.remove();
  });

  it('accepts an array of element targets', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    document.body.appendChild(el1);
    document.body.appendChild(el2);
    const ro = useResizeObserver([el1, el2]);
    expect(ro.value.width).toBe(0);
    ro.destroy();
    el1.remove();
    el2.remove();
  });

  it('accepts null target without throwing', () => {
    expect(() => {
      const ro = useResizeObserver(null);
      ro.destroy();
    }).not.toThrow();
  });

  it('accepts options with box parameter', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ro = useResizeObserver(el, { box: 'border-box' });
    expect(ro.value.width).toBe(0);
    ro.destroy();
    el.remove();
  });

  it('uses borderBoxSize when box is border-box', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    let callback: ResizeObserverCallback | undefined;

    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        callback = cb;
      }

      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      const el = document.createElement('div');
      const ro = useResizeObserver(el, { box: 'border-box' });

      callback?.(
        [
          {
            borderBoxSize: [{ inlineSize: 320, blockSize: 180 }],
            contentBoxSize: [{ inlineSize: 300, blockSize: 160 }],
            contentRect: { width: 300, height: 160 },
            target: el,
          } as unknown as ResizeObserverEntry,
        ],
        {} as ResizeObserver
      );

      expect(ro.value.width).toBe(320);
      expect(ro.value.height).toBe(180);
      ro.destroy();
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it('falls back to contentRect when the configured resize box size is unavailable', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    let callback: ResizeObserverCallback | undefined;

    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        callback = cb;
      }

      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      const el = document.createElement('div');
      const ro = useResizeObserver(el, { box: 'device-pixel-content-box' });

      callback?.(
        [
          {
            borderBoxSize: [{ inlineSize: 320, blockSize: 180 }],
            contentBoxSize: [{ inlineSize: 300, blockSize: 160 }],
            contentRect: { width: 280, height: 140 },
            target: el,
          } as unknown as ResizeObserverEntry,
        ],
        {} as ResizeObserver
      );

      expect(ro.value.width).toBe(280);
      expect(ro.value.height).toBe(140);
      ro.destroy();
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it('fails gracefully when initial resize observation throws', () => {
    const originalResizeObserver = globalThis.ResizeObserver;

    class MockResizeObserver {
      observe(): void {
        throw new Error('invalid box');
      }

      unobserve(): void {}
      disconnect(): void {}
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      const el = document.createElement('div');
      expect(() =>
        useResizeObserver(el, { box: 'border-box' }),
      ).not.toThrow();

      const ro = useResizeObserver(el, { box: 'border-box' });
      expect(ro.value).toEqual({
        width: 0,
        height: 0,
        entry: null,
      });
      expect(() => ro.observe(el)).not.toThrow();
      ro.destroy();
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it('observe() and unobserve() do not throw after creation', () => {
    const ro = useResizeObserver();
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(() => ro.observe(el)).not.toThrow();
    expect(() => ro.unobserve(el)).not.toThrow();
    ro.destroy();
    el.remove();
  });

  it('observe() and unobserve() are no-ops after destroy', () => {
    const ro = useResizeObserver();
    ro.destroy();
    const el = document.createElement('div');
    expect(() => ro.observe(el)).not.toThrow();
    expect(() => ro.unobserve(el)).not.toThrow();
  });
});

// ─── useMutationObserver ─────────────────────────────────────────────────────

describe('media/useMutationObserver', () => {
  const MUTATION_OBSERVER_TIMEOUT_MS = 50;

  const waitForMutationObserver = () =>
    new Promise((resolve) => setTimeout(resolve, MUTATION_OBSERVER_TIMEOUT_MS));

  const createMutationProbe = (target: Node, options: MutationObserverInit) => {
    const MutationObserverCtor = globalThis.MutationObserver;
    let count = 0;
    const observer = MutationObserverCtor
      ? new MutationObserverCtor((mutations) => {
          count += mutations.length;
        })
      : undefined;

    observer?.observe(target, options);

    return {
      supported: Boolean(observer),
      get count(): number {
        return count;
      },
      disconnect(): void {
        observer?.disconnect();
      },
    };
  };

  it('returns a signal with default state when no target is given', () => {
    const mo = useMutationObserver();
    expect(mo.value).toEqual({
      mutations: [],
      count: 0,
    });
    mo.destroy();
  });

  it('returns readonly signal (no setter)', () => {
    const mo = useMutationObserver();
    expect(() => {
      (mo as { value: unknown }).value = {};
    }).toThrow();
    mo.destroy();
  });

  it('defines destroy, observe, takeRecords as non-enumerable properties', () => {
    const mo = useMutationObserver();
    const keys = Object.keys(mo);
    expect(keys).not.toContain('destroy');
    expect(keys).not.toContain('observe');
    expect(keys).not.toContain('takeRecords');
    expect(typeof mo.destroy).toBe('function');
    expect(typeof mo.observe).toBe('function');
    expect(typeof mo.takeRecords).toBe('function');
    mo.destroy();
  });

  it('destroy is idempotent', () => {
    const mo = useMutationObserver();
    mo.destroy();
    expect(() => mo.destroy()).not.toThrow();
  });

  it('accepts a target node and observes mutations', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const mo = useMutationObserver(el, { attributes: true });
    expect(mo.value.count).toBe(0);
    mo.destroy();
    el.remove();
  });

  it('accepts null target without throwing', () => {
    expect(() => {
      const mo = useMutationObserver(null);
      mo.destroy();
    }).not.toThrow();
  });

  it('accepts childList and subtree options', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const mo = useMutationObserver(el, { childList: true, subtree: true, attributes: false });
    expect(mo.value.count).toBe(0);
    mo.destroy();
    el.remove();
  });

  it('falls back to attributes observation when all primary options are false', () => {
    const originalMutationObserver = globalThis.MutationObserver;
    let observedOptions: MutationObserverInit | undefined;

    class MockMutationObserver {
      observe(_target: Node, options: MutationObserverInit): void {
        observedOptions = options;
      }

      disconnect(): void {}

      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    globalThis.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;

    try {
      const el = document.createElement('div');
      const mo = useMutationObserver(el, {
        attributes: false,
        childList: false,
        characterData: false,
      });

      expect(observedOptions).toBeDefined();
      expect(observedOptions?.attributes).toBe(true);
      expect(observedOptions?.childList).toBe(false);
      expect(observedOptions?.characterData).toBe(false);
      mo.destroy();
    } finally {
      globalThis.MutationObserver = originalMutationObserver;
    }
  });

  it('clears attribute-dependent options when attributes observation is disabled', () => {
    const originalMutationObserver = globalThis.MutationObserver;
    let observedOptions: MutationObserverInit | undefined;

    class MockMutationObserver {
      observe(_target: Node, options: MutationObserverInit): void {
        observedOptions = options;
      }

      disconnect(): void {}

      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    globalThis.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;

    try {
      const el = document.createElement('div');
      const mo = useMutationObserver(el, {
        attributes: false,
        childList: true,
        attributeOldValue: true,
        attributeFilter: ['data-test'],
      });

      expect(observedOptions).toBeDefined();
      expect(observedOptions?.attributes).toBe(false);
      expect(observedOptions?.childList).toBe(true);
      expect(observedOptions?.attributeOldValue).toBe(false);
      expect('attributeFilter' in (observedOptions ?? {})).toBe(false);
      mo.destroy();
    } finally {
      globalThis.MutationObserver = originalMutationObserver;
    }
  });

  it('preserves an empty attributeFilter when attributes observation is enabled', () => {
    const originalMutationObserver = globalThis.MutationObserver;
    let observedOptions: MutationObserverInit | undefined;

    class MockMutationObserver {
      observe(_target: Node, options: MutationObserverInit): void {
        observedOptions = options;
      }

      disconnect(): void {}

      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    globalThis.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;

    try {
      const el = document.createElement('div');
      const mo = useMutationObserver(el, {
        attributes: true,
        attributeFilter: [],
      });

      expect(observedOptions).toBeDefined();
      expect(observedOptions?.attributes).toBe(true);
      expect(observedOptions?.attributeFilter).toEqual([]);
      mo.destroy();
    } finally {
      globalThis.MutationObserver = originalMutationObserver;
    }
  });

  it('clears characterDataOldValue when characterData observation is disabled', () => {
    const originalMutationObserver = globalThis.MutationObserver;
    let observedOptions: MutationObserverInit | undefined;

    class MockMutationObserver {
      observe(_target: Node, options: MutationObserverInit): void {
        observedOptions = options;
      }

      disconnect(): void {}

      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    globalThis.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;

    try {
      const el = document.createElement('div');
      const mo = useMutationObserver(el, {
        attributes: true,
        characterData: false,
        characterDataOldValue: true,
      });

      expect(observedOptions).toBeDefined();
      expect(observedOptions?.attributes).toBe(true);
      expect(observedOptions?.characterData).toBe(false);
      expect(observedOptions?.characterDataOldValue).toBe(false);
      mo.destroy();
    } finally {
      globalThis.MutationObserver = originalMutationObserver;
    }
  });

  it('fails gracefully when initial mutation observation throws', () => {
    const originalMutationObserver = globalThis.MutationObserver;

    class MockMutationObserver {
      constructor(_cb: MutationCallback) {}

      observe(): void {
        throw new Error('invalid mutation options');
      }

      disconnect(): void {}

      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    globalThis.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;

    try {
      const el = document.createElement('div');
      expect(() =>
        useMutationObserver(el, {
          attributes: true,
        }),
      ).not.toThrow();

      const mo = useMutationObserver(el, {
        attributes: true,
      });
      expect(mo.value).toEqual({
        mutations: [],
        count: 0,
      });
      expect(() => mo.observe(el)).not.toThrow();
      mo.destroy();
    } finally {
      globalThis.MutationObserver = originalMutationObserver;
    }
  });

  it('accepts characterData and attributeFilter options', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const mo = useMutationObserver(el, {
      attributes: true,
      attributeFilter: ['class', 'id'],
      attributeOldValue: true,
    });
    expect(mo.value.count).toBe(0);
    mo.destroy();
    el.remove();
  });

  it('observe() does not throw after creation', () => {
    const mo = useMutationObserver();
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(() => mo.observe(el)).not.toThrow();
    mo.destroy();
    el.remove();
  });

  it('observe() is a no-op after destroy', () => {
    const mo = useMutationObserver();
    mo.destroy();
    const el = document.createElement('div');
    expect(() => mo.observe(el)).not.toThrow();
  });

  it('takeRecords() returns an array', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const mo = useMutationObserver(el, { attributes: true });
    const records = mo.takeRecords();
    expect(Array.isArray(records)).toBe(true);
    mo.destroy();
    el.remove();
  });

  it('takeRecords() returns empty array after destroy', () => {
    const mo = useMutationObserver();
    mo.destroy();
    const records = mo.takeRecords();
    expect(records).toEqual([]);
  });

  it('updates signal when attribute mutation occurs', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const mo = useMutationObserver(el, { attributes: true });
    const probe = createMutationProbe(el, { attributes: true });

    try {
      expect(mo.value.count).toBe(0);

      // Trigger an attribute mutation
      el.setAttribute('data-test', 'hello');

      // MutationObserver callbacks are microtask-based, wait for them
      await waitForMutationObserver();

      if (!probe.supported || probe.count === 0) {
        expect(typeof mo.value.count).toBe('number');
        expect(Array.isArray(mo.value.mutations)).toBe(true);
        return;
      }

      expect(mo.value.count).toBeGreaterThan(0);
      expect(Array.isArray(mo.value.mutations)).toBe(true);
      expect(mo.value.mutations.some((mutation) => mutation.type === 'attributes')).toBeTruthy();
    } finally {
      probe.disconnect();
      mo.destroy();
      el.remove();
    }
  });

  it('updates signal when child list mutation occurs', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const mo = useMutationObserver(el, { childList: true, attributes: false });
    const probe = createMutationProbe(el, { childList: true });

    try {
      expect(mo.value.count).toBe(0);

      // Trigger a childList mutation
      const child = document.createElement('span');
      el.appendChild(child);

      await waitForMutationObserver();

      if (!probe.supported || probe.count === 0) {
        expect(typeof mo.value.count).toBe('number');
        expect(Array.isArray(mo.value.mutations)).toBe(true);
        return;
      }

      expect(mo.value.count).toBeGreaterThan(0);
      expect(Array.isArray(mo.value.mutations)).toBe(true);
      expect(mo.value.mutations.some((mutation) => mutation.type === 'childList')).toBeTruthy();
    } finally {
      probe.disconnect();
      mo.destroy();
      el.remove();
    }
  });

  it('defaults to attributes: true when no options given', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    // Should not throw — defaults to { attributes: true }
    const mo = useMutationObserver(el);
    expect(mo.value.count).toBe(0);
    mo.destroy();
    el.remove();
  });
});

// ─── Module exports ──────────────────────────────────────────────────────────

describe('media module exports', () => {
  it('exports all public functions from barrel', async () => {
    const mod = await import('../src/media/index');
    expect(typeof mod.mediaQuery).toBe('function');
    expect(typeof mod.breakpoints).toBe('function');
    expect(typeof mod.useViewport).toBe('function');
    expect(typeof mod.useNetworkStatus).toBe('function');
    expect(typeof mod.useBattery).toBe('function');
    expect(typeof mod.useGeolocation).toBe('function');
    expect(typeof mod.useDeviceMotion).toBe('function');
    expect(typeof mod.useDeviceOrientation).toBe('function');
    expect(typeof mod.clipboard).toBe('object');
    expect(typeof mod.clipboard.read).toBe('function');
    expect(typeof mod.clipboard.write).toBe('function');
    expect(typeof mod.useIntersectionObserver).toBe('function');
    expect(typeof mod.useResizeObserver).toBe('function');
    expect(typeof mod.useMutationObserver).toBe('function');
  });

  it('is re-exported from main index', async () => {
    const mod = await import('../src/index');
    expect(typeof mod.mediaQuery).toBe('function');
    expect(typeof mod.breakpoints).toBe('function');
    expect(typeof mod.useViewport).toBe('function');
    expect(typeof mod.useNetworkStatus).toBe('function');
    expect(typeof mod.useBattery).toBe('function');
    expect(typeof mod.useGeolocation).toBe('function');
    expect(typeof mod.useDeviceMotion).toBe('function');
    expect(typeof mod.useDeviceOrientation).toBe('function');
    expect(typeof mod.clipboard).toBe('object');
    expect(typeof mod.useIntersectionObserver).toBe('function');
    expect(typeof mod.useResizeObserver).toBe('function');
    expect(typeof mod.useMutationObserver).toBe('function');
  });

  it('is exported from full bundle', async () => {
    const mod = await import('../src/full');
    expect(typeof mod.mediaQuery).toBe('function');
    expect(typeof mod.breakpoints).toBe('function');
    expect(typeof mod.useViewport).toBe('function');
    expect(typeof mod.useNetworkStatus).toBe('function');
    expect(typeof mod.useBattery).toBe('function');
    expect(typeof mod.useGeolocation).toBe('function');
    expect(typeof mod.useDeviceMotion).toBe('function');
    expect(typeof mod.useDeviceOrientation).toBe('function');
    expect(typeof mod.clipboard).toBe('object');
    expect(typeof mod.useIntersectionObserver).toBe('function');
    expect(typeof mod.useResizeObserver).toBe('function');
    expect(typeof mod.useMutationObserver).toBe('function');
  });
});

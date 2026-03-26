/**
 * Tests for the bQuery media module.
 */

import { describe, it, expect } from 'bun:test';
import { mediaQuery } from '../src/media/media-query';
import { breakpoints } from '../src/media/breakpoints';
import { useViewport } from '../src/media/viewport';
import { useNetworkStatus } from '../src/media/network';
import { useBattery } from '../src/media/battery';
import { useGeolocation } from '../src/media/geolocation';
import { useDeviceMotion, useDeviceOrientation } from '../src/media/device-sensors';
import { clipboard } from '../src/media/clipboard';

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
      (net as { value: unknown }).value = { online: false, effectiveType: '4g', downlink: 10, rtt: 50 };
    }).toThrow();
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
      (battery as { value: unknown }).value = { supported: true, charging: true, level: 0.5, chargingTime: 100, dischargingTime: 200 };
    }).toThrow();
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
      await expect(clipboard.read()).rejects.toThrow('Clipboard API is not available');
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
      await expect(clipboard.write('test')).rejects.toThrow('Clipboard API is not available');
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
      writeText: async (text: string) => { written = text; },
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
  });
});

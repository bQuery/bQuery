import { describe, expect, it, mock } from 'bun:test';
import {
  animate,
  capturePosition,
  easingPresets,
  flip,
  flipElements,
  keyframePresets,
  prefersReducedMotion,
  scrollAnimate,
  sequence,
  spring,
  springPresets,
  stagger,
  timeline,
  transition,
} from '../src/motion/index';

// Mock DOM elements for testing
const createMockElement = (bounds: DOMRect): Element => {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => bounds;
  (el as HTMLElement).animate = mock(() => ({
    onfinish: null as (() => void) | null,
    finished: Promise.resolve(),
  })) as unknown as Element['animate'];
  return el;
};

const createMockAnimation = () => ({
  onfinish: null as (() => void) | null,
  finished: Promise.resolve(),
  commitStyles: mock(() => {}),
  cancel: mock(() => {}),
  pause: mock(() => {}),
  play: mock(() => {}),
  currentTime: 0,
});

describe('motion/transition', () => {
  it('executes update function without view transition API', async () => {
    let updated = false;
    await transition(() => {
      updated = true;
    });
    expect(updated).toBe(true);
  });

  it('accepts options object with update property', async () => {
    let updated = false;
    await transition({
      update: () => {
        updated = true;
      },
    });
    expect(updated).toBe(true);
  });
});

describe('motion/capturePosition', () => {
  it('captures element bounds correctly', () => {
    const mockRect = {
      top: 10,
      left: 20,
      width: 100,
      height: 50,
      bottom: 60,
      right: 120,
      x: 20,
      y: 10,
      toJSON: () => ({}),
    };
    const el = createMockElement(mockRect);

    const bounds = capturePosition(el);

    expect(bounds.top).toBe(10);
    expect(bounds.left).toBe(20);
    expect(bounds.width).toBe(100);
    expect(bounds.height).toBe(50);
  });
});

describe('motion/flip', () => {
  it('resolves immediately when no position change', async () => {
    const mockRect = {
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      bottom: 100,
      right: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    const el = createMockElement(mockRect);

    await flip(el, { top: 0, left: 0, width: 100, height: 100 });
    // Should complete without error
    expect(true).toBe(true);
  });
});

describe('motion/flipElements', () => {
  it('animates a group without throwing', async () => {
    const mockRect = {
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      bottom: 100,
      right: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    const el = createMockElement(mockRect);

    await flipElements([el], () => {
      // no-op update
    });

    expect(true).toBe(true);
  });
});

describe('motion/prefersReducedMotion', () => {
  it('returns false when matchMedia is unavailable', () => {
    const original = window.matchMedia;
    // @ts-expect-error - test scenario
    window.matchMedia = undefined;

    expect(prefersReducedMotion()).toBe(false);

    window.matchMedia = original;
  });

  it('detects reduced motion preference', () => {
    const original = window.matchMedia;
    window.matchMedia = mock(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList
    ) as unknown as typeof window.matchMedia;

    expect(prefersReducedMotion()).toBe(true);

    window.matchMedia = original;
  });
});

describe('motion/animate', () => {
  it('resolves when animation finishes and commits styles', async () => {
    const animation = createMockAnimation();
    animation.finished = new Promise<void>(() => {});

    const el = document.createElement('div');
    (el as HTMLElement).animate = mock(() => animation) as unknown as Element['animate'];

    const promise = animate(el, {
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: 10 },
    });

    animation.onfinish?.();
    await promise;

    expect(animation.commitStyles).toHaveBeenCalled();
    expect(animation.cancel).toHaveBeenCalled();
  });

  it('applies final styles when reduced motion is preferred', async () => {
    const original = window.matchMedia;
    window.matchMedia = mock(
      () =>
        ({
          matches: true,
          media: '(prefers-reduced-motion: reduce)',
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList
    ) as unknown as typeof window.matchMedia;

    const el = document.createElement('div');
    await animate(el, {
      keyframes: [{ opacity: 0 }, { opacity: 0.5 }],
    });

    expect(el.style.opacity).toBe('0.5');

    window.matchMedia = original;
  });
});

describe('motion/sequence', () => {
  it('runs animations sequentially', async () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    (el1 as HTMLElement).animate = mock(() =>
      createMockAnimation()
    ) as unknown as Element['animate'];
    (el2 as HTMLElement).animate = mock(() =>
      createMockAnimation()
    ) as unknown as Element['animate'];

    await sequence([
      { target: el1, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
      { target: el2, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
    ]);

    expect(true).toBe(true);
  });
});

describe('motion/timeline', () => {
  it('plays timeline steps and commits styles', async () => {
    const el = document.createElement('div');
    const animation = createMockAnimation();
    (el as HTMLElement).animate = mock(() => animation) as unknown as Element['animate'];

    const tl = timeline([
      { target: el, keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 10 } },
    ]);

    await tl.play();

    expect(animation.commitStyles).toHaveBeenCalled();
    expect(animation.cancel).toHaveBeenCalled();
  });

  it('seeks to correct time including delay', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');

    // Create animations with writable currentTime
    const animation1 = {
      ...createMockAnimation(),
      currentTime: 0,
    };
    const animation2 = {
      ...createMockAnimation(),
      currentTime: 0,
    };

    let animateCallCount = 0;
    const mockAnimate = mock(() => {
      animateCallCount += 1;
      return animateCallCount === 1 ? animation1 : animation2;
    });

    (el1 as HTMLElement).animate = mockAnimate as unknown as Element['animate'];
    (el2 as HTMLElement).animate = mockAnimate as unknown as Element['animate'];

    const tl = timeline([
      {
        target: el1,
        keyframes: [{ opacity: 0 }, { opacity: 1 }],
        options: { duration: 100 },
        at: 0,
      },
      {
        target: el2,
        keyframes: [{ opacity: 0 }, { opacity: 1 }],
        options: { duration: 100 },
        at: 50,
      },
    ]);

    // Start playing to build animations
    tl.play();

    // Pause animations so we can seek
    tl.pause();

    // Seek to 75ms - both animations should be at 75ms (WAAPI currentTime includes delay)
    tl.seek(75);

    expect(animation1.currentTime).toBe(75);
    expect(animation2.currentTime).toBe(75);

    // Clean up
    tl.stop();
  });

  it('calculates duration correctly with iterations', () => {
    const el = document.createElement('div');
    const animation = createMockAnimation();
    (el as HTMLElement).animate = mock(() => animation) as unknown as Element['animate'];

    const tl = timeline([
      {
        target: el,
        keyframes: [{ opacity: 0 }, { opacity: 1 }],
        options: { duration: 100, iterations: 3 },
        at: 0,
      },
    ]);

    // Duration should be 100ms * 3 iterations = 300ms
    expect(tl.duration()).toBe(300);
  });

  it('accounts for iterations in scheduling relative steps', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    const animation1 = createMockAnimation();
    const animation2 = createMockAnimation();

    let animateCallCount = 0;
    const mockAnimate = mock(() => {
      animateCallCount += 1;
      return animateCallCount === 1 ? animation1 : animation2;
    });

    (el1 as HTMLElement).animate = mockAnimate as unknown as Element['animate'];
    (el2 as HTMLElement).animate = mockAnimate as unknown as Element['animate'];

    const tl = timeline([
      {
        target: el1,
        keyframes: [{ opacity: 0 }, { opacity: 1 }],
        options: { duration: 100, iterations: 2 },
        at: 0,
      },
      {
        target: el2,
        keyframes: [{ opacity: 0 }, { opacity: 1 }],
        options: { duration: 100 },
        // This should start after el1's 200ms (100ms * 2 iterations)
      },
    ]);

    // Total duration should be 200ms (el1) + 100ms (el2) = 300ms
    expect(tl.duration()).toBe(300);
  });

  it('handles iterations with endDelay correctly', () => {
    const el = document.createElement('div');
    const animation = createMockAnimation();
    (el as HTMLElement).animate = mock(() => animation) as unknown as Element['animate'];

    const tl = timeline([
      {
        target: el,
        keyframes: [{ opacity: 0 }, { opacity: 1 }],
        options: { duration: 100, iterations: 2, endDelay: 50 },
        at: 0,
      },
    ]);

    // Duration should be (100ms * 2 iterations) + 50ms endDelay = 250ms
    expect(tl.duration()).toBe(250);
  });

  it('handles infinite iterations gracefully', () => {
    const el = document.createElement('div');
    const animation = createMockAnimation();
    (el as HTMLElement).animate = mock(() => animation) as unknown as Element['animate'];

    const tl = timeline([
      {
        target: el,
        keyframes: [{ opacity: 0 }, { opacity: 1 }],
        options: { duration: 100, iterations: Infinity },
        at: 0,
      },
    ]);

    // Should return a very large number instead of Infinity
    const duration = tl.duration();
    expect(duration).toBe(Number.MAX_SAFE_INTEGER);
    expect(Number.isFinite(duration)).toBe(true);
  });
});

describe('motion/spring', () => {
  it('creates spring with initial value', () => {
    const s = spring(0);
    expect(s.current()).toBe(0);
  });

  it('allows subscribing to changes', () => {
    const s = spring(0);
    const values: number[] = [];

    const unsubscribe = s.onChange((v) => values.push(v));
    expect(typeof unsubscribe).toBe('function');

    // Clean up
    unsubscribe();
  });

  it('can be stopped', () => {
    const s = spring(0);
    s.to(100);
    s.stop();
    // Should not throw
    expect(s.current()).toBeDefined();
  });
});

describe('motion/springPresets', () => {
  it('provides gentle preset', () => {
    expect(springPresets.gentle.stiffness).toBe(80);
    expect(springPresets.gentle.damping).toBe(15);
  });

  it('provides snappy preset', () => {
    expect(springPresets.snappy.stiffness).toBe(200);
    expect(springPresets.snappy.damping).toBe(20);
  });

  it('provides bouncy preset', () => {
    expect(springPresets.bouncy.stiffness).toBe(300);
    expect(springPresets.bouncy.damping).toBe(8);
  });

  it('provides stiff preset', () => {
    expect(springPresets.stiff.stiffness).toBe(400);
    expect(springPresets.stiff.damping).toBe(30);
  });
});

describe('motion/easingPresets', () => {
  it('provides easing functions', () => {
    expect(easingPresets.linear(0)).toBe(0);
    expect(easingPresets.easeOutQuad(1)).toBe(1);
  });
});

describe('motion/keyframePresets', () => {
  it('creates fadeIn frames', () => {
    const frames = keyframePresets.fadeIn();
    expect(frames[0].opacity).toBe(0);
    expect(frames[1].opacity).toBe(1);
  });
});

describe('motion/stagger', () => {
  it('creates linear delays from start', () => {
    const delay = stagger(100);
    expect(delay(0, 3)).toBe(0);
    expect(delay(1, 3)).toBe(100);
    expect(delay(2, 3)).toBe(200);
  });

  it('supports center origin', () => {
    const delay = stagger(50, { from: 'center' });
    expect(delay(0, 3)).toBe(50);
    expect(delay(1, 3)).toBe(0);
    expect(delay(2, 3)).toBe(50);
  });
});

describe('motion/scrollAnimate', () => {
  it('falls back when IntersectionObserver is unavailable', () => {
    const original = globalThis.IntersectionObserver;
    // @ts-expect-error - test scenario
    globalThis.IntersectionObserver = undefined;

    const el = document.createElement('div');
    (el as HTMLElement).animate = mock(() =>
      createMockAnimation()
    ) as unknown as Element['animate'];

    const cleanup = scrollAnimate(el, {
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
    });

    expect(typeof cleanup).toBe('function');

    globalThis.IntersectionObserver = original;
  });
});

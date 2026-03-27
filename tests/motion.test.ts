import { afterEach, describe, expect, it, mock } from 'bun:test';
import {
  animate,
  capturePosition,
  easingPresets,
  flip,
  flipElements,
  keyframePresets,
  morphElement,
  parallax,
  prefersReducedMotion,
  scrollAnimate,
  sequence,
  setReducedMotion,
  spring,
  springPresets,
  stagger,
  timeline,
  transition,
  typewriter,
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

const mockViewTransition = (
  updateCallbackDone: Promise<void>,
  onReady?: () => void,
  onType?: (value: string) => void
): ViewTransition =>
  ({
    finished: updateCallbackDone.then(() => undefined),
    ready: Promise.resolve().then(() => {
      onReady?.();
    }),
    updateCallbackDone,
    skipTransition: () => {},
    types: {
      add: (value: string) => {
        onType?.(value);
      },
    },
  }) as ViewTransition;

describe('motion/transition', () => {
  it('executes update function without view transition API', async () => {
    let updated = false;
    await transition(() => {
      updated = true;
    });
    expect(updated).toBe(true);
  });

  it('accepts async update functions directly', async () => {
    let updated = false;
    await transition(async () => {
      await Promise.resolve();
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

  it('supports async updates and transition classes', async () => {
    const original = (
      document as Document & {
        startViewTransition?: Document['startViewTransition'];
      }
    ).startViewTransition;
    const calls: string[] = [];

    (
      document as Document & {
        startViewTransition?: Document['startViewTransition'];
      }
    ).startViewTransition = ((callbackOrOptions) => {
      const update =
        typeof callbackOrOptions === 'function' ? callbackOrOptions : callbackOrOptions?.update;
      const updateCallbackDone = Promise.resolve(update?.()).then(() => {
        calls.push('updated');
      });

      return mockViewTransition(
        updateCallbackDone,
        () => {
          calls.push('ready');
        },
        (value) => {
          calls.push(`type:${value}`);
        }
      );
    }) as Document['startViewTransition'];

    try {
      await transition({
        update: async () => {
          calls.push('start');
          await Promise.resolve();
        },
        classes: ['is-transitioning'],
        types: ['navigation'],
      });

      expect(calls).toContain('start');
      expect(calls).toContain('ready');
      expect(calls).toContain('updated');
      expect(calls).toContain('type:navigation');
      expect(document.documentElement.classList.contains('is-transitioning')).toBe(false);
    } finally {
      (
        document as Document & {
          startViewTransition?: Document['startViewTransition'];
        }
      ).startViewTransition = original;
    }
  });

  it('ignores empty and whitespace transition class/type tokens', async () => {
    const original = (
      document as Document & {
        startViewTransition?: Document['startViewTransition'];
      }
    ).startViewTransition;
    const calls: string[] = [];

    (
      document as Document & {
        startViewTransition?: Document['startViewTransition'];
      }
    ).startViewTransition = ((callbackOrOptions) => {
      const update =
        typeof callbackOrOptions === 'function' ? callbackOrOptions : callbackOrOptions?.update;
      const updateCallbackDone = Promise.resolve(update?.());

      return mockViewTransition(updateCallbackDone, undefined, (value) => {
        calls.push(`type:${value}`);
      });
    }) as Document['startViewTransition'];

    try {
      await transition({
        update: () => {
          calls.push('updated');
        },
        classes: ['', '   ', ' is-transitioning '],
        types: ['', '   ', ' navigation '],
      });

      expect(calls).toContain('updated');
      expect(calls).toContain('type:navigation');
      expect(calls).not.toContain('type:');
      expect(document.documentElement.classList.contains('is-transitioning')).toBe(false);
    } finally {
      (
        document as Document & {
          startViewTransition?: Document['startViewTransition'];
        }
      ).startViewTransition = original;
    }
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

  it('handles zero iterations correctly', () => {
    const el = document.createElement('div');
    const animation = createMockAnimation();
    (el as HTMLElement).animate = mock(() => animation) as unknown as Element['animate'];

    const tl = timeline([
      {
        target: el,
        keyframes: [{ opacity: 0 }, { opacity: 1 }],
        options: { duration: 100, iterations: 0, endDelay: 50 },
        at: 0,
      },
    ]);

    // With 0 iterations, duration should be only the endDelay
    expect(tl.duration()).toBe(50);
  });

  it('handles negative iterations gracefully', () => {
    const el = document.createElement('div');
    const animation = createMockAnimation();
    (el as HTMLElement).animate = mock(() => animation) as unknown as Element['animate'];

    const tl = timeline([
      {
        target: el,
        keyframes: [{ opacity: 0 }, { opacity: 1 }],
        options: { duration: 100, iterations: -5, endDelay: 25 },
        at: 0,
      },
    ]);

    // Negative iterations should be treated as 0, so only endDelay remains
    expect(tl.duration()).toBe(25);
  });

  it('accounts for iterations with delay option in scheduling', () => {
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
        options: { duration: 100, iterations: 2, delay: 50 },
        at: 0,
      },
      {
        target: el2,
        keyframes: [{ opacity: 0 }, { opacity: 1 }],
        options: { duration: 100 },
        // Should start after el1 completes: delay(50) + duration*iterations(200) = 250ms
      },
    ]);

    // Total timeline duration: el1 (50 delay + 200ms) + el2 (100ms) = 350ms
    expect(tl.duration()).toBe(350);
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

// ============================================================================
// setReducedMotion (global toggle)
// ============================================================================

describe('motion/setReducedMotion', () => {
  afterEach(() => {
    setReducedMotion(null);
  });

  it('overrides to true forces reduced motion', () => {
    setReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('overrides to false forces full motion', () => {
    setReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('null restores system preference detection', () => {
    setReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);

    setReducedMotion(null);
    // Now it should use system preference (which is false in test env)
    expect(prefersReducedMotion()).toBe(false);
  });

  it('affects animate function behavior', async () => {
    setReducedMotion(true);

    const el = document.createElement('div');
    let finishCalled = false;
    await animate(el, {
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: 1000 },
      onFinish: () => {
        finishCalled = true;
      },
    });

    // Should resolve instantly because reduced motion is forced
    expect(finishCalled).toBe(true);
    expect(el.style.opacity).toBe('1');
  });
});

// ============================================================================
// morphElement
// ============================================================================

describe('motion/morphElement', () => {
  const createPositionedElement = (
    rect: Partial<DOMRect>,
    opts: { display?: string } = {}
  ): HTMLElement => {
    const el = document.createElement('div');
    const fullRect: DOMRect = {
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      bottom: 100,
      right: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    };
    el.getBoundingClientRect = () => fullRect;
    if (opts.display) {
      el.style.display = opts.display;
    }
    return el;
  };

  afterEach(() => {
    setReducedMotion(null);
  });

  it('hides from element and shows to element', async () => {
    const from = createPositionedElement({ top: 0, left: 0, width: 100, height: 100 });
    const to = createPositionedElement({ top: 50, left: 50, width: 200, height: 200 });

    // Mock animate on the target
    const mockAnim = createMockAnimation();
    to.animate = mock(() => mockAnim) as unknown as Element['animate'];

    const promise = morphElement(from, to);
    mockAnim.onfinish?.();
    await promise;

    expect(from.style.display).toBe('none');
    expect(to.style.opacity).toBe('');
  });

  it('forces a measurable display when destination is hidden via computed styles', async () => {
    const from = createPositionedElement({ top: 0, left: 0, width: 100, height: 100 });
    const to = document.createElement('div');
    const hiddenRect: DOMRect = {
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    const visibleRect: DOMRect = {
      top: 50,
      left: 50,
      width: 200,
      height: 200,
      bottom: 250,
      right: 250,
      x: 50,
      y: 50,
      toJSON: () => ({}),
    };
    to.getBoundingClientRect = () => (to.style.display === 'block' ? visibleRect : hiddenRect);

    const mockAnim = createMockAnimation();
    let capturedKeyframes: Keyframe[] | undefined;
    const animateMock = mock((keyframes: Keyframe[]) => {
      capturedKeyframes = keyframes;
      return mockAnim;
    });
    to.animate = animateMock as unknown as Element['animate'];

    const originalGetComputedStyle = globalThis.getComputedStyle.bind(globalThis);
    const mockGetComputedStyle = ((element: Element) => {
      const style = originalGetComputedStyle(element);
      if (element === to && (to as HTMLElement).style.display === '') {
        const hiddenStyle = Object.create(style) as CSSStyleDeclaration;
        Object.defineProperty(hiddenStyle, 'display', {
          configurable: true,
          enumerable: true,
          value: 'none',
        });
        return hiddenStyle;
      }
      return style;
    }) as typeof globalThis.getComputedStyle;
    window.getComputedStyle = mockGetComputedStyle;
    globalThis.getComputedStyle = mockGetComputedStyle;

    try {
      const promise = morphElement(from, to);
      mockAnim.onfinish?.();
      await promise;
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      globalThis.getComputedStyle = originalGetComputedStyle;
    }

    expect(capturedKeyframes).toEqual([
      {
        transform: 'translate(-50px, -50px) scale(0.5, 0.5)',
        opacity: '0.5',
      },
      {
        transform: 'translate(0, 0) scale(1, 1)',
        opacity: '1',
      },
    ]);
    expect((to as HTMLElement).style.display).toBe('block');
  });

  it('resolves immediately when no position change', async () => {
    const from = createPositionedElement({ top: 10, left: 20, width: 100, height: 100 });
    const to = createPositionedElement({ top: 10, left: 20, width: 100, height: 100 });

    await morphElement(from, to);
    expect(to.style.opacity).toBe('');
  });

  it('skips animation when reduced motion is active', async () => {
    setReducedMotion(true);

    const from = createPositionedElement({ top: 0, left: 0 });
    const to = createPositionedElement({ top: 100, left: 100 });

    await morphElement(from, to);
    expect(to.style.opacity).toBe('');
  });

  it('calls onComplete callback', async () => {
    const from = createPositionedElement({ top: 0, left: 0 });
    const to = createPositionedElement({ top: 0, left: 0 });
    let completed = false;

    await morphElement(from, to, { onComplete: () => (completed = true) });
    expect(completed).toBe(true);
  });

  it('falls back when animate API is unavailable', async () => {
    const from = createPositionedElement({ top: 0, left: 0 });
    const to = createPositionedElement({ top: 50, left: 50 });
    // Remove animate function
    // @ts-expect-error - test scenario
    to.animate = undefined;

    let completed = false;
    await morphElement(from, to, { onComplete: () => (completed = true) });
    expect(completed).toBe(true);
  });

  it('restores existing inline transform and opacity after animation completes', async () => {
    const from = createPositionedElement({ top: 0, left: 0, width: 100, height: 100 });
    const to = createPositionedElement({ top: 50, left: 50, width: 200, height: 200 });
    to.style.transform = 'rotate(12deg)';
    to.style.opacity = '0.4';

    const mockAnim = createMockAnimation();
    to.animate = mock(() => mockAnim) as unknown as Element['animate'];

    const promise = morphElement(from, to);
    mockAnim.onfinish?.();
    await promise;

    expect(to.style.transform).toBe('rotate(12deg)');
    expect(to.style.opacity).toBe('0.4');
  });

  it('restores existing inline transform and opacity when reduced motion skips animation', async () => {
    setReducedMotion(true);

    const from = createPositionedElement({ top: 0, left: 0, width: 100, height: 100 });
    const to = createPositionedElement({ top: 50, left: 50, width: 200, height: 200 });
    to.style.transform = 'scale(1.1)';
    to.style.opacity = '0.7';

    await morphElement(from, to);

    expect(to.style.transform).toBe('scale(1.1)');
    expect(to.style.opacity).toBe('0.7');
  });

  it('restores existing inline transform and opacity when no morph is needed', async () => {
    const from = createPositionedElement({ top: 10, left: 20, width: 100, height: 100 });
    const to = createPositionedElement({ top: 10, left: 20, width: 100, height: 100 });
    to.style.transform = 'translateX(5px)';
    to.style.opacity = '0.8';

    await morphElement(from, to);

    expect(to.style.transform).toBe('translateX(5px)');
    expect(to.style.opacity).toBe('0.8');
  });

  it('restores existing inline transform and opacity when animate API is unavailable', async () => {
    const from = createPositionedElement({ top: 0, left: 0, width: 100, height: 100 });
    const to = createPositionedElement({ top: 50, left: 50, width: 200, height: 200 });
    to.style.transform = 'skewX(4deg)';
    to.style.opacity = '0.6';
    // @ts-expect-error - test scenario
    to.animate = undefined;

    await morphElement(from, to);

    expect(to.style.transform).toBe('skewX(4deg)');
    expect(to.style.opacity).toBe('0.6');
  });
});

// ============================================================================
// parallax
// ============================================================================

describe('motion/parallax', () => {
  afterEach(() => {
    setReducedMotion(null);
  });

  it('returns a cleanup function', () => {
    const el = document.createElement('div');
    const cleanup = parallax(el, { speed: 0.5 });
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('applies initial transform', () => {
    const el = document.createElement('div');
    const cleanup = parallax(el, { speed: 0.5, direction: 'vertical' });
    // Initial scroll is 0, so transform should be translate3d(0px, 0px, 0)
    expect(el.style.transform).toBe('translate3d(0px, 0px, 0)');
    cleanup();
  });

  it('returns no-op cleanup when reduced motion is active', () => {
    setReducedMotion(true);
    const el = document.createElement('div');
    const cleanup = parallax(el);
    expect(typeof cleanup).toBe('function');
    // Should not set transform
    expect(el.style.transform).toBe('');
    cleanup();
  });

  it('cleans up transform on cleanup call', () => {
    const el = document.createElement('div');
    const cleanup = parallax(el, { speed: 0.3 });
    expect(el.style.transform).not.toBe('');
    cleanup();
    expect(el.style.transform).toBe('');
  });

  it('preserves and restores an existing inline transform', () => {
    const el = document.createElement('div');
    el.style.transform = 'scale(1.2)';

    const cleanup = parallax(el, { speed: 0.3 });

    expect(el.style.transform).toBe('scale(1.2) translate3d(0px, 0px, 0)');

    cleanup();

    expect(el.style.transform).toBe('scale(1.2)');
  });

  it('cancels queued animation work on cleanup', () => {
    const el = document.createElement('div');
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    let queuedFrame: FrameRequestCallback | undefined;
    let cancelledFrame: number | undefined;

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      queuedFrame = callback;
      return 123;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) => {
      cancelledFrame = id;
    }) as typeof globalThis.cancelAnimationFrame;

    try {
      const cleanup = parallax(el, { speed: 0.3 });
      window.dispatchEvent(new Event('scroll'));
      cleanup();

      expect(cancelledFrame).toBe(123);
      el.style.transform = 'rotate(1deg)';
      queuedFrame?.(Date.now());
      expect(el.style.transform).toBe('rotate(1deg)');
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }
  });

  it('supports horizontal direction', () => {
    const el = document.createElement('div');
    const cleanup = parallax(el, { speed: 0.5, direction: 'horizontal' });
    expect(el.style.transform).toBe('translate3d(0px, 0px, 0)');
    cleanup();
  });

  it('supports both direction', () => {
    const el = document.createElement('div');
    const cleanup = parallax(el, { speed: 1, direction: 'both' });
    expect(el.style.transform).toBe('translate3d(0px, 0px, 0)');
    cleanup();
  });

  it('returns a no-op cleanup when window is unavailable', () => {
    const el = document.createElement('div');
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

    try {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: undefined,
      });
      const cleanup = parallax(el, { speed: 0.5 });
      expect(typeof cleanup).toBe('function');
      expect(el.style.transform).toBe('');
      cleanup();
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
      }
    }
  });

  it('returns a no-op cleanup when RAF APIs are unavailable', () => {
    const el = document.createElement('div');
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;

    try {
      Object.defineProperty(globalThis, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: undefined,
      });
      Object.defineProperty(globalThis, 'cancelAnimationFrame', {
        configurable: true,
        writable: true,
        value: undefined,
      });

      const cleanup = parallax(el, { speed: 0.5 });
      expect(typeof cleanup).toBe('function');
      expect(el.style.transform).toBe('');
      cleanup();
    } finally {
      Object.defineProperty(globalThis, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: originalRaf,
      });
      Object.defineProperty(globalThis, 'cancelAnimationFrame', {
        configurable: true,
        writable: true,
        value: originalCancelRaf,
      });
    }
  });
});

// ============================================================================
// typewriter
// ============================================================================

describe('motion/typewriter', () => {
  afterEach(() => {
    setReducedMotion(null);
  });

  it('types text character by character', async () => {
    const el = document.createElement('div');
    const tw = typewriter(el, 'Hi', { speed: 5 });
    await tw.done;
    expect(el.textContent).toBe('Hi');
  });

  it('returns controls with stop and done', () => {
    const el = document.createElement('div');
    const tw = typewriter(el, 'Hello');
    expect(typeof tw.stop).toBe('function');
    expect(tw.done).toBeInstanceOf(Promise);
    tw.stop();
  });

  it('shows text instantly when reduced motion is active', async () => {
    setReducedMotion(true);
    const el = document.createElement('div');
    let completed = false;
    const tw = typewriter(el, 'Instant!', {
      speed: 1000,
      onComplete: () => (completed = true),
    });
    await tw.done;
    expect(el.textContent).toBe('Instant!');
    expect(completed).toBe(true);
  });

  it('calls onComplete when typing finishes', async () => {
    const el = document.createElement('div');
    let completed = false;
    const tw = typewriter(el, 'OK', {
      speed: 5,
      onComplete: () => (completed = true),
    });
    await tw.done;
    expect(completed).toBe(true);
  });

  it('supports initial delay', async () => {
    const el = document.createElement('div');
    const start = Date.now();
    const tw = typewriter(el, 'X', { speed: 1, delay: 50 });
    await tw.done;
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
    expect(el.textContent).toBe('X');
  });

  it('can be stopped mid-animation', async () => {
    const el = document.createElement('div');
    const tw = typewriter(el, 'Hello World!!!', { speed: 20 });

    // Stop after a short delay (enough for some chars but not all)
    await new Promise((r) => setTimeout(r, 60));
    tw.stop();
    await tw.done;

    // Should have partial text (less than full)
    const text = el.textContent ?? '';
    expect(text.length).toBeLessThan('Hello World!!!'.length);
  });

  it('handles empty text', async () => {
    const el = document.createElement('div');
    const tw = typewriter(el, '', { speed: 5 });
    await tw.done;
    expect(el.textContent).toBe('');
  });

  it('adds and removes cursor element', async () => {
    const el = document.createElement('div');
    const tw = typewriter(el, 'AB', { speed: 5, cursor: true, cursorChar: '_' });

    // Wait briefly for cursor to be added
    await new Promise((r) => setTimeout(r, 10));
    const cursorSpan = el.querySelector('span[aria-hidden="true"]');
    expect(cursorSpan).not.toBeNull();
    expect(cursorSpan?.textContent).toBe('_');

    await tw.done;
    // Cursor should be removed after completion
    expect(el.querySelector('span[aria-hidden="true"]')).toBeNull();
  });

  it('returns resolved controls when document is unavailable', async () => {
    const el = document.createElement('div');
    const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

    try {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: undefined,
      });
      const tw = typewriter(el, 'Hi', { speed: 5, cursor: true });
      await tw.done;
      expect(el.textContent).toBe('');
    } finally {
      if (originalDocumentDescriptor) {
        Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
      }
    }
  });
});

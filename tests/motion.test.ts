import { describe, expect, it, mock } from 'bun:test';
import { capturePosition, flip, spring, springPresets, transition } from '../src/motion/index';

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

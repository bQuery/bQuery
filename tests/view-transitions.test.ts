/**
 * View declarative transitions tests — issue #137.
 *
 * happy-dom has no Web Animations API, so transitions resolve as no-ops on a
 * microtask. These tests cover the orchestration (enter/leave/move, race
 * safety, reduced-motion, passive-attribute handling) and use a lightweight
 * `animate` mock to assert the `motion`-delegating keyframe path.
 */

import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { signal } from '../src/reactive/index';
import { mount } from '../src/view/index';
import { resolveTransition, TRANSITION_ATTRS } from '../src/view/directives/index';
import { setReducedMotion } from '../src/motion/reduced-motion';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type AnimateCall = { keyframes: unknown; options: Record<string, unknown> };

const installAnimateMock = (): { calls: AnimateCall[]; restore: () => void } => {
  const proto = (globalThis as unknown as { HTMLElement: { prototype: Record<string, unknown> } })
    .HTMLElement.prototype;
  const original = proto.animate;
  const calls: AnimateCall[] = [];
  proto.animate = function (keyframes: unknown, options: Record<string, unknown>) {
    calls.push({ keyframes, options });
    const anim: {
      onfinish: null | (() => void);
      oncancel: null | (() => void);
      finished: Promise<void>;
      cancel: () => void;
    } = {
      onfinish: null,
      oncancel: null,
      finished: Promise.resolve(),
      cancel() {},
    };
    queueMicrotask(() => anim.onfinish?.());
    return anim;
  };
  return {
    calls,
    restore: () => {
      proto.animate = original;
    },
  };
};

afterEach(() => setReducedMotion(null));

describe('resolveTransition (#137)', () => {
  it('returns null without transition attributes', () => {
    const el = document.createElement('div');
    expect(resolveTransition(el, 'bq')).toBeNull();
  });

  it('resolves bq-transition to symmetric enter/leave + defaults', () => {
    const el = document.createElement('div');
    el.setAttribute('bq-transition', 'fade');
    const config = resolveTransition(el, 'bq')!;
    expect(config).not.toBeNull();
    expect(config.enter).not.toBeNull();
    expect(config.leave).not.toBeNull();
    expect(config.duration).toBe(200);
    expect(config.easing).toBe('ease');
  });

  it('honours bq-transition-duration / bq-transition-easing', () => {
    const el = document.createElement('div');
    el.setAttribute('bq-transition', 'slide-up');
    el.setAttribute('bq-transition-duration', '350');
    el.setAttribute('bq-transition-easing', 'ease-in-out');
    const config = resolveTransition(el, 'bq')!;
    expect(config.duration).toBe(350);
    expect(config.easing).toBe('ease-in-out');
  });

  it('supports separate bq-in / bq-out', () => {
    const el = document.createElement('div');
    el.setAttribute('bq-in', 'slide-up');
    const inOnly = resolveTransition(el, 'bq')!;
    expect(inOnly.enter).not.toBeNull();
    expect(inOnly.leave).toBeNull();

    const el2 = document.createElement('div');
    el2.setAttribute('bq-out', 'fade');
    const outOnly = resolveTransition(el2, 'bq')!;
    expect(outOnly.enter).toBeNull();
    expect(outOnly.leave).not.toBeNull();
  });

  it('exposes the passive companion attribute names', () => {
    expect(TRANSITION_ATTRS).toContain('transition');
    expect(TRANSITION_ATTRS).toContain('in');
    expect(TRANSITION_ATTRS).toContain('out');
    expect(TRANSITION_ATTRS).toContain('animate');
  });
});

describe('passive transition attributes do not warn (#137)', () => {
  it('never reports transition attributes as unknown directives', () => {
    (globalThis as Record<string, unknown>).__BQUERY_DEV__ = true;
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const root = document.createElement('div');
      root.innerHTML =
        '<div bq-if="open" bq-transition="fade" bq-transition-duration="120" bq-transition-easing="ease">' +
        '<ul><li bq-for="i in items" bq-key="i" bq-animate="flip" bq-in="slide-up" bq-out="fade" bq-text="i"></li></ul>' +
        '</div>';
      document.body.appendChild(root);
      const view = mount(root, { open: signal(true), items: signal([1, 2]) });
      const unknownWarnings = warn.mock.calls.filter((c) =>
        String(c[0]).includes('Unknown directive')
      );
      expect(unknownWarnings.length).toBe(0);
      view.destroy();
    } finally {
      warn.mockRestore();
      delete (globalThis as Record<string, unknown>).__BQUERY_DEV__;
    }
  });
});

describe('bq-if transitions (#137)', () => {
  it('does not animate the initial paint and hides when initially false', () => {
    const mock = installAnimateMock();
    try {
      const root = document.createElement('div');
      root.innerHTML = '<p bq-if="open" bq-transition="fade" bq-text="msg"></p>';
      document.body.appendChild(root);
      const open = signal(false);
      mount(root, { open, msg: signal('hi') });
      // Initially false → removed synchronously, no enter animation.
      expect(root.querySelector('p')).toBeNull();
      expect(mock.calls.length).toBe(0);
    } finally {
      mock.restore();
    }
  });

  it('runs the enter keyframes on insert (delegating to the motion path)', () => {
    const mock = installAnimateMock();
    try {
      const root = document.createElement('div');
      root.innerHTML = '<p bq-if="open" bq-transition="fade" bq-text="msg"></p>';
      document.body.appendChild(root);
      const open = signal(false);
      mount(root, { open, msg: signal('hi') });
      open.value = true;
      expect(root.querySelector('p')).not.toBeNull();
      expect(mock.calls.length).toBe(1);
      expect(mock.calls[0].options.fill).toBe('none');
      expect(mock.calls[0].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    } finally {
      mock.restore();
    }
  });

  it('defers removal until the leave transition resolves', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p bq-if="open" bq-transition="fade" bq-text="msg"></p>';
    document.body.appendChild(root);
    const open = signal(true);
    mount(root, { open, msg: signal('hi') });
    expect(root.querySelector('p')).not.toBeNull();

    open.value = false;
    // Still present synchronously (leave in flight).
    expect(root.querySelector('p')).not.toBeNull();
    await flush();
    // Removed after the leave resolves.
    expect(root.querySelector('p')).toBeNull();
  });

  it('is race-safe: re-entering during a leave keeps the element', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p bq-if="open" bq-transition="fade" bq-text="msg"></p>';
    document.body.appendChild(root);
    const open = signal(true);
    mount(root, { open, msg: signal('hi') });

    open.value = false; // start leaving
    open.value = true; // re-enter before the leave commits
    await flush();
    expect(root.querySelector('p')).not.toBeNull();
  });

  it('respects reduced motion (no animation calls)', () => {
    setReducedMotion(true);
    const mock = installAnimateMock();
    try {
      const root = document.createElement('div');
      root.innerHTML = '<p bq-if="open" bq-transition="fade" bq-text="msg"></p>';
      document.body.appendChild(root);
      const open = signal(false);
      mount(root, { open, msg: signal('hi') });
      open.value = true;
      expect(root.querySelector('p')).not.toBeNull();
      expect(mock.calls.length).toBe(0);
    } finally {
      mock.restore();
    }
  });
});

describe('bq-show transitions (#137)', () => {
  it('hides synchronously on first paint when condition is false', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p bq-show="open" bq-transition="fade">x</p>';
    document.body.appendChild(root);
    mount(root, { open: signal(false) });
    expect((root.querySelector('p') as HTMLElement).style.display).toBe('none');
  });

  it('defers display:none until the leave resolves', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p bq-show="open" bq-transition="fade">x</p>';
    document.body.appendChild(root);
    const open = signal(true);
    mount(root, { open });
    const p = root.querySelector('p') as HTMLElement;

    open.value = false;
    expect(p.style.display).not.toBe('none'); // still visible while leaving
    await flush();
    expect(p.style.display).toBe('none');
  });
});

describe('bq-for move + item transitions (#137)', () => {
  it('reorders correctly with bq-animate="flip"', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<ul><li bq-for="n in nums" bq-key="n" bq-animate="flip" bq-text="n"></li></ul>';
    document.body.appendChild(root);
    const nums = signal([1, 2, 3]);
    mount(root, { nums });
    expect(Array.from(root.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      '1',
      '2',
      '3',
    ]);

    nums.value = [3, 1, 2];
    expect(Array.from(root.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      '3',
      '1',
      '2',
    ]);
  });

  it('skips FLIP capture under reduced motion (honours the preference)', () => {
    const proto = (
      globalThis as unknown as { Element: { prototype: { getBoundingClientRect: () => DOMRect } } }
    ).Element.prototype;
    const original = proto.getBoundingClientRect;
    let calls = 0;
    proto.getBoundingClientRect = function (this: Element) {
      calls++;
      return original.call(this);
    };
    try {
      const root = document.createElement('div');
      root.innerHTML =
        '<ul><li bq-for="n in nums" bq-key="n" bq-animate="flip" bq-text="n"></li></ul>';
      document.body.appendChild(root);
      const nums = signal([1, 2, 3]);
      mount(root, { nums });

      setReducedMotion(true);
      calls = 0;
      nums.value = [3, 1, 2];
      expect(calls).toBe(0); // no FLIP capture under reduced motion

      setReducedMotion(false);
      calls = 0;
      nums.value = [1, 2, 3];
      expect(calls).toBeGreaterThan(0); // capture runs when motion is allowed
    } finally {
      proto.getBoundingClientRect = original;
    }
  });

  it('adds and removes items with enter/leave without corrupting the list', async () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<ul><li bq-for="n in nums" bq-key="n" bq-in="slide-up" bq-out="fade" bq-text="n"></li></ul>';
    document.body.appendChild(root);
    const nums = signal([1, 2]);
    mount(root, { nums });

    nums.value = [1, 2, 3]; // add
    expect(Array.from(root.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      '1',
      '2',
      '3',
    ]);

    nums.value = [2, 3]; // remove the first
    await flush();
    expect(Array.from(root.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['2', '3']);
  });
});

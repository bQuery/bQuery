import { describe, expect, it } from 'bun:test';
import { signal } from '../src/reactive/index';
import { mount } from '../src/view/index';

// Controlled animate mock: leave animations DO NOT finish until we call release().
const installHeldAnimateMock = () => {
  const proto = (globalThis as unknown as { HTMLElement: { prototype: Record<string, unknown> } })
    .HTMLElement.prototype;
  const original = proto.animate;
  const finishers: Array<() => void> = [];
  proto.animate = function (_keyframes: unknown, _options: Record<string, unknown>) {
    let resolveFinished!: () => void;
    const finished = new Promise<void>((r) => (resolveFinished = r));
    const anim = {
      onfinish: null as null | (() => void),
      oncancel: null as null | (() => void),
      finished,
      cancel() {},
    };
    finishers.push(() => {
      resolveFinished();
      anim.onfinish?.();
    });
    return anim;
  };
  return {
    releaseAll: () => finishers.splice(0).forEach((f) => f()),
    restore: () => {
      proto.animate = original;
    },
  };
};

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('repro re-add during leave', () => {
  it('counts DOM nodes when a key is re-added mid-leave', async () => {
    const mock = installHeldAnimateMock();
    try {
      const root = document.createElement('div');
      root.innerHTML =
        '<ul><li bq-for="n in nums" bq-key="n" bq-in="slide-up" bq-out="fade" bq-text="n"></li></ul>';
      document.body.appendChild(root);
      const nums = signal([1, 2, 3]);
      mount(root, { nums });

      // Remove key 2 -> leave animation starts, deferred remove pending.
      nums.value = [1, 3];
      // Re-add key 2 before leave settled.
      nums.value = [1, 2, 3];

      const texts = Array.from(root.querySelectorAll('li')).map((li) => li.textContent);
      const twos = texts.filter((t) => t === '2').length;

      mock.releaseAll();
      await flush();
      const after = Array.from(root.querySelectorAll('li')).map((li) => li.textContent);
      const twosAfter = after.filter((t) => t === '2').length;

      // Re-adding a key while its leave animation is still in flight must not
      // leave a duplicate node behind (the stale leaving element is dropped).
      expect(twos).toBe(1);
      expect(twosAfter).toBe(1);
    } finally {
      mock.restore();
    }
  });
});

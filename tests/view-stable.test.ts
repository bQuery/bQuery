/**
 * View → Stable (1.15.0) tests — issue #136.
 *
 * Covers the resolved parser edge cases that gate promotion:
 *  - `bq-for` duplicate-key handling (deterministic fallback, deduped + dev-gated warnings)
 *  - object-expression shorthand parsing (`{ active }` ≡ `{ active: active }`)
 */

import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { signal } from '../src/reactive/index';
import { mount } from '../src/view/index';
import { parseObjectExpression } from '../src/view/evaluate';

const DEV_GLOBAL = '__BQUERY_DEV__';

const setDev = (value: boolean | undefined): void => {
  if (value === undefined) {
    delete (globalThis as Record<string, unknown>)[DEV_GLOBAL];
  } else {
    (globalThis as Record<string, unknown>)[DEV_GLOBAL] = value;
  }
};

describe('View Stable — bq-for duplicate keys (#136)', () => {
  afterEach(() => setDev(undefined));

  it('renders every row even when keys collide', () => {
    setDev(false);
    const root = document.createElement('div');
    root.innerHTML =
      '<ul><li bq-for="item in items" bq-key="item.id" bq-text="item.label"></li></ul>';
    document.body.appendChild(root);

    const items = signal([
      { id: 1, label: 'a' },
      { id: 1, label: 'b' },
      { id: 2, label: 'c' },
    ]);
    const view = mount(root, { items });

    const labels = Array.from(root.querySelectorAll('li')).map((li) => li.textContent);
    expect(labels).toEqual(['a', 'b', 'c']);
    view.destroy();
  });

  it('warns once per duplicate key in dev, not on every re-render', () => {
    setDev(true);
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const root = document.createElement('div');
      root.innerHTML =
        '<ul><li bq-for="item in items" bq-key="item.id" bq-text="item.id"></li></ul>';
      document.body.appendChild(root);

      const items = signal([{ id: 1 }, { id: 1 }]);
      const view = mount(root, { items });

      const afterFirst = warn.mock.calls.length;
      expect(afterFirst).toBe(1);

      // Re-render the same colliding list a few times.
      items.value = [{ id: 1 }, { id: 1 }];
      items.value = [{ id: 1 }, { id: 1 }];

      expect(warn.mock.calls.length).toBe(afterFirst);
      view.destroy();
    } finally {
      warn.mockRestore();
    }
  });

  it('stays silent about duplicates outside dev', () => {
    setDev(false);
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const root = document.createElement('div');
      root.innerHTML =
        '<ul><li bq-for="item in items" bq-key="item.id" bq-text="item.id"></li></ul>';
      document.body.appendChild(root);
      const items = signal([{ id: 7 }, { id: 7 }]);
      const view = mount(root, { items });
      expect(warn.mock.calls.length).toBe(0);
      view.destroy();
    } finally {
      warn.mockRestore();
    }
  });

  it('reuses duplicate-row DOM nodes across re-renders (stable fallback key)', () => {
    setDev(false);
    const root = document.createElement('div');
    root.innerHTML = '<ul><li bq-for="item in items" bq-key="item.id" bq-text="item.id"></li></ul>';
    document.body.appendChild(root);

    const items = signal([{ id: 5 }, { id: 5 }]);
    const view = mount(root, { items });
    const firstNodes = Array.from(root.querySelectorAll('li'));
    firstNodes.forEach((li, i) => li.setAttribute('data-mark', String(i)));

    // Re-render with the same colliding keys — nodes should be reused, not recreated.
    items.value = [{ id: 5 }, { id: 5 }];
    const secondNodes = Array.from(root.querySelectorAll('li'));
    expect(secondNodes.map((li) => li.getAttribute('data-mark'))).toEqual(['0', '1']);
    view.destroy();
  });
});

describe('View Stable — object-expression shorthand (#136)', () => {
  it('parses shorthand properties like JS object shorthand', () => {
    expect(parseObjectExpression('{ active }')).toEqual({ active: 'active' });
    expect(parseObjectExpression('{ active, disabled }')).toEqual({
      active: 'active',
      disabled: 'disabled',
    });
    expect(parseObjectExpression('{ active: isActive, disabled }')).toEqual({
      active: 'isActive',
      disabled: 'disabled',
    });
  });

  it('ignores non-identifier shorthand fragments', () => {
    // A bare call/expression with no colon is not a valid shorthand key.
    expect(parseObjectExpression('{ doThing() }')).toEqual({});
  });

  it('applies shorthand classes through bq-class', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span bq-class="{ active }"></span>';
    document.body.appendChild(root);

    const active = signal(true);
    const view = mount(root, { active });
    const span = root.querySelector('span')!;
    expect(span.classList.contains('active')).toBe(true);

    active.value = false;
    expect(span.classList.contains('active')).toBe(false);
    view.destroy();
  });
});

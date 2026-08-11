/**
 * Regression tests for directive processing order and subscription hygiene:
 * - bq-for wins over sibling directives regardless of attribute order
 * - bq-once / bq-init / bq-memo do not subscribe an enclosing bq-for effect
 * - bq-html children are author-opaque and never processed
 */

import { describe, expect, it } from 'bun:test';
import { signal } from '../src/reactive/index';
import { mount } from '../src/view/index';

describe('view processing order', () => {
  it('binds directives declared before bq-for to the rows, not the template', () => {
    const root = document.createElement('div');
    // bq-text appears BEFORE bq-for on the same element: it must bind per-row
    // against the item scope instead of once against the discarded template.
    root.innerHTML = '<ul><li bq-text="item.name" bq-for="item in items"></li></ul>';
    document.body.appendChild(root);

    const items = signal([{ name: 'a' }, { name: 'b' }]);
    const view = mount(root, { items });

    const texts = [...root.querySelectorAll('li')].map((li) => li.textContent);
    expect(texts).toEqual(['a', 'b']);

    items.value = [{ name: 'c' }];
    expect([...root.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['c']);

    view.destroy();
    root.remove();
  });

  it('does not re-render a bq-for list when a bq-once dependency changes', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<ul><li bq-for="item in items" bq-key="item.id"><span bq-once="label"></span></li></ul>';
    document.body.appendChild(root);

    const items = signal([{ id: 1 }]);
    const label = signal('static');
    const view = mount(root, { items, label });

    const firstLi = root.querySelector('li')!;
    expect(firstLi.querySelector('span')!.textContent).toBe('static');

    // Changing the bq-once dependency must not wake the list reconciler:
    // the rendered <li> keeps its identity and its one-time text.
    label.value = 'changed';
    expect(root.querySelector('li')).toBe(firstLi);
    expect(firstLi.querySelector('span')!.textContent).toBe('static');

    view.destroy();
    root.remove();
  });

  it('does not process children of a bq-html element', () => {
    const root = document.createElement('div');
    // The child bq-init would run if children were processed — the first
    // reactive HTML write replaces them, so binding them only leaks effects.
    root.innerHTML = '<div bq-html="content"><span bq-init="count.value++"></span></div>';
    document.body.appendChild(root);

    const content = signal('<em>fresh</em>');
    const count = signal(0);
    const view = mount(root, { content, count });

    expect(count.value).toBe(0);
    expect(root.querySelector('em')!.textContent).toBe('fresh');

    view.destroy();
    root.remove();
  });

  it('binds every original child even when a directive removes a sibling', () => {
    const root = document.createElement('div');
    // The bq-init handler detaches the <i> that the traversal would otherwise
    // stand on when looking for the next sibling — the <b> after it must still
    // be bound.
    root.innerHTML =
      '<div><span bq-init="dropNext($el)"></span><i class="tip">tip</i><b bq-text="msg"></b></div>';
    document.body.appendChild(root);

    const msg = signal('hello');
    const view = mount(root, {
      msg,
      dropNext: (el: Element) => el.nextElementSibling?.remove(),
    });

    expect(root.querySelector('.tip')).toBeNull();
    expect(root.querySelector('b')!.textContent).toBe('hello');

    // Bound reactively, not just written once.
    msg.value = 'bye';
    expect(root.querySelector('b')!.textContent).toBe('bye');

    view.destroy();
    root.remove();
  });

  it('keeps parsing directives correctly after the parse memo is recycled', () => {
    const root = document.createElement('div');
    // More distinct attribute names than the memo bound, so it is cleared at
    // least once mid-mount and the entries have to be re-derived.
    const attrs = Array.from({ length: 600 }, (_, i) => `bq-bind:data-n${i}="label"`).join(' ');
    root.innerHTML = `<span ${attrs}></span>`;
    document.body.appendChild(root);

    const label = signal('a');
    const view = mount(root, { label });

    const span = root.querySelector('span')!;
    expect(span.getAttribute('data-n0')).toBe('a');
    expect(span.getAttribute('data-n599')).toBe('a');

    label.value = 'b';
    expect(span.getAttribute('data-n0')).toBe('b');
    expect(span.getAttribute('data-n599')).toBe('b');

    view.destroy();
    root.remove();
  });
});

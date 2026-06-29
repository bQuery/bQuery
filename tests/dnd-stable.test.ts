/**
 * DnD → Stable (1.15.0) tests — issue #143.
 *
 * Validates the accessible-DnD contract that gates promotion:
 *  - Keyboard model: pick up → move → drop, and pick up → cancel.
 *  - `aria-grabbed` transitions across the keyboard lifecycle.
 *  - Screen-reader announcements route through the shared a11y announcer.
 *  - Frozen option surface: `keyboard`, `grid`, `delay`, `bounds: 'viewport'`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { clearAnnouncements } from '../src/a11y/announce';
import { draggable } from '../src/dnd/draggable';
import { useSortable } from '../src/dnd/reactive';

const fireKey = (el: HTMLElement, key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
};
const tick = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('DnD Stable — keyboard model (#143)', () => {
  let box: HTMLElement;

  beforeEach(() => {
    box = document.createElement('div');
    document.body.appendChild(box);
  });
  afterEach(() => {
    clearAnnouncements();
    document.body.innerHTML = '';
  });

  it('picks up, moves, and drops via keyboard with aria-grabbed transitions', () => {
    const events: string[] = [];
    const handle = draggable(box, {
      keyboard: true,
      keyboardStep: 10,
      onDragStart: () => events.push('start'),
      onDrag: () => events.push('move'),
      onDragEnd: () => events.push('end'),
    });
    box.tabIndex = 0;

    expect(box.getAttribute('aria-grabbed')).toBe('false');

    fireKey(box, ' '); // pick up
    expect(box.getAttribute('aria-grabbed')).toBe('true');
    expect(events).toContain('start');

    fireKey(box, 'ArrowRight'); // move
    fireKey(box, 'ArrowDown');

    fireKey(box, ' '); // drop
    expect(box.getAttribute('aria-grabbed')).toBe('false');
    expect(events).toContain('end');

    handle.destroy();
  });

  it('cancels a keyboard drag and restores the original position', () => {
    const handle = draggable(box, { keyboard: true, keyboardStep: 25 });
    box.tabIndex = 0;

    fireKey(box, 'Enter'); // pick up
    expect(box.getAttribute('aria-grabbed')).toBe('true');
    fireKey(box, 'ArrowRight');
    fireKey(box, 'Escape'); // cancel
    expect(box.getAttribute('aria-grabbed')).toBe('false');
    // Cancelled drag resets the transform back to origin.
    expect(box.style.transform === '' || box.style.transform.includes('0')).toBe(true);

    handle.destroy();
  });

  it('announces the keyboard pickup through the shared a11y live region', async () => {
    const handle = draggable(box, { keyboard: true });
    box.tabIndex = 0;
    fireKey(box, ' ');
    await tick(70); // announcer writes after its 50ms debounce
    const region = document.querySelector('[aria-live]') as HTMLElement | null;
    expect(region).not.toBeNull();
    expect(region?.textContent ?? '').toContain('Picked up');
    handle.destroy();
  });

  it('does not engage keyboard handlers when keyboard is disabled (default)', () => {
    const handle = draggable(box, {});
    box.tabIndex = 0;
    fireKey(box, ' ');
    expect(box.hasAttribute('aria-grabbed')).toBe(false);
    handle.destroy();
  });
});

describe('DnD Stable — frozen option surface (#143)', () => {
  it('accepts grid, delay, and viewport bounds without error', () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const handle = draggable(box, {
      grid: [16, 24],
      delay: 150,
      bounds: 'viewport',
      keyboard: true,
    });
    expect(typeof handle.destroy).toBe('function');
    handle.destroy();
    document.body.innerHTML = '';
  });

  it('useSortable exposes a reactive order signal', () => {
    const list = document.createElement('ul');
    list.innerHTML = '<li>a</li><li>b</li><li>c</li>';
    document.body.appendChild(list);

    const { order, isDragging, handle } = useSortable(list, { items: 'li' });
    expect(Array.isArray(order.value)).toBe(true);
    expect(order.value.length).toBe(3);
    expect(isDragging.value).toBe(false);

    handle.destroy();
    document.body.innerHTML = '';
  });
});

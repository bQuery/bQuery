/**
 * Tests for keyboard accessibility on draggable elements (M1).
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { clearAnnouncements } from '../src/a11y/announce';
import { draggable, getActiveDrag } from '../src/dnd/draggable';

const fireKey = (el: HTMLElement, key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
};

const firePointerEvent = (
  target: EventTarget,
  type: string,
  options: Partial<PointerEventInit> = {}
): PointerEvent => {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
};

describe('dnd/draggable keyboard support', () => {
  let box: HTMLElement;

  beforeEach(() => {
    box = document.createElement('div');
    document.body.appendChild(box);
  });

  afterEach(() => {
    clearAnnouncements();
    box.remove();
  });

  it('does not respond to keyboard input when keyboard: false (default)', () => {
    const handle = draggable(box);
    fireKey(box, ' ');
    fireKey(box, 'ArrowRight');
    expect(handle.getPosition()).toEqual({ x: 0, y: 0 });
    handle.destroy();
  });

  it('opts into focusability and aria-grabbed when keyboard: true', () => {
    const handle = draggable(box, { keyboard: true });
    expect(box.getAttribute('tabindex')).toBe('0');
    expect(box.getAttribute('aria-grabbed')).toBe('false');
    handle.destroy();
    expect(box.hasAttribute('tabindex')).toBe(false);
    expect(box.hasAttribute('aria-grabbed')).toBe(false);
  });

  it('preserves an existing tabindex on destroy', () => {
    box.setAttribute('tabindex', '-1');
    const handle = draggable(box, { keyboard: true });
    expect(box.getAttribute('tabindex')).toBe('-1');
    handle.destroy();
    expect(box.getAttribute('tabindex')).toBe('-1');
  });

  it('picks up on Space and updates aria-grabbed', () => {
    let startCount = 0;
    const handle = draggable(box, {
      keyboard: true,
      onDragStart: () => {
        startCount += 1;
      },
    });
    fireKey(box, ' ');
    expect(box.getAttribute('aria-grabbed')).toBe('true');
    expect(getActiveDrag()).toEqual({ element: box, position: { x: 0, y: 0 } });
    expect(startCount).toBe(1);
    handle.destroy();
  });

  it('moves the element with arrow keys', () => {
    const handle = draggable(box, { keyboard: true, keyboardStep: 5 });
    fireKey(box, ' '); // pick up
    fireKey(box, 'ArrowRight');
    fireKey(box, 'ArrowRight');
    fireKey(box, 'ArrowDown');
    expect(handle.getPosition()).toEqual({ x: 10, y: 5 });
    handle.destroy();
  });

  it('drops on Space after pickup', () => {
    let endCount = 0;
    const handle = draggable(box, {
      keyboard: true,
      onDragEnd: () => {
        endCount += 1;
      },
    });
    fireKey(box, ' ');
    fireKey(box, 'ArrowRight');
    expect(getActiveDrag()?.element).toBe(box);
    fireKey(box, ' ');
    expect(endCount).toBe(1);
    expect(box.getAttribute('aria-grabbed')).toBe('false');
    expect(getActiveDrag()).toBeUndefined();
    handle.destroy();
  });

  it('cancels on Escape and returns to pickup position', () => {
    const handle = draggable(box, { keyboard: true, keyboardStep: 10 });
    fireKey(box, ' ');
    fireKey(box, 'ArrowRight');
    fireKey(box, 'ArrowDown');
    expect(handle.getPosition()).toEqual({ x: 10, y: 10 });
    expect(getActiveDrag()?.element).toBe(box);
    fireKey(box, 'Escape');
    expect(handle.getPosition()).toEqual({ x: 0, y: 0 });
    expect(box.getAttribute('aria-grabbed')).toBe('false');
    expect(getActiveDrag()).toBeUndefined();
    handle.destroy();
  });

  it('respects the bounds constraint when moving with the keyboard', () => {
    const handle = draggable(box, {
      keyboard: true,
      keyboardStep: 100,
      bounds: { left: -10, top: -10, right: 30, bottom: 30 },
    });
    fireKey(box, ' ');
    fireKey(box, 'ArrowRight');
    fireKey(box, 'ArrowRight');
    expect(handle.getPosition().x).toBeLessThanOrEqual(30);
    handle.destroy();
  });

  it('snaps keyboard movement to grid when configured', () => {
    const handle = draggable(box, { keyboard: true, keyboardStep: 7, grid: 5 });
    fireKey(box, ' ');
    fireKey(box, 'ArrowRight');
    // 7 snaps to nearest multiple of 5 → 5.
    expect(handle.getPosition().x).toBe(5);
    handle.destroy();
  });

  it('ignores keyboard pickup while a pointer drag is active or pending', () => {
    let startCount = 0;
    const handle = draggable(box, {
      keyboard: true,
      touchStartThreshold: 10,
      onDragStart: () => {
        startCount += 1;
      },
    });

    firePointerEvent(box, 'pointerdown', { clientX: 0, clientY: 0 });
    fireKey(box, ' ');
    fireKey(box, 'ArrowRight');
    expect(startCount).toBe(0);
    expect(handle.getPosition()).toEqual({ x: 0, y: 0 });

    firePointerEvent(box, 'pointermove', { clientX: 20, clientY: 0 });
    expect(startCount).toBe(1);
    fireKey(box, ' ');
    fireKey(box, 'ArrowRight');
    expect(startCount).toBe(1);
    expect(handle.getPosition()).toEqual({ x: 20, y: 0 });

    firePointerEvent(box, 'pointerup', { clientX: 20, clientY: 0 });
    handle.destroy();
  });
});

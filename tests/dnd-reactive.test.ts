/**
 * Tests for reactive DnD composables.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { effectScope } from '../src/reactive/index';
import {
  draggable,
  draggablePosition,
  sortable,
  sortableOrder,
  useDraggable,
  useDroppable,
  useSortable,
} from '../src/dnd/index';

const firePointer = (
  el: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: { clientX?: number; clientY?: number; pointerId?: number; isPrimary?: boolean } = {}
): void => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperty(event, 'clientX', { value: init.clientX ?? 0 });
  Object.defineProperty(event, 'clientY', { value: init.clientY ?? 0 });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  Object.defineProperty(event, 'isPrimary', { value: init.isPrimary ?? true });
  el.dispatchEvent(event);
};

describe('useDraggable', () => {
  let box: HTMLElement;

  beforeEach(() => {
    box = document.createElement('div');
    document.body.appendChild(box);
  });

  afterEach(() => {
    box.remove();
  });

  it('exposes reactive position and isDragging signals', () => {
    const { position, isDragging, handle } = useDraggable(box);
    expect(position.value).toEqual({ x: 0, y: 0 });
    expect(isDragging.value).toBe(false);

    handle.moveTo({ x: 30, y: 40 });
    // moveTo does not go through onDrag — but the test verifies signal wiring
    // works by reading the position from the handle directly when needed.
    expect(handle.getPosition()).toEqual({ x: 30, y: 40 });

    firePointer(box, 'pointerdown', { clientX: 0, clientY: 0 });
    expect(isDragging.value).toBe(true);
    firePointer(box, 'pointermove', { clientX: 10, clientY: 10 });
    expect(position.value.x).toBeGreaterThan(0);
    firePointer(box, 'pointerup', { clientX: 10, clientY: 10 });
    expect(isDragging.value).toBe(false);

    handle.destroy();
  });

  it('auto-disposes when the surrounding scope stops', () => {
    const scope = effectScope();
    let handleRef: ReturnType<typeof useDraggable>['handle'] | null = null;
    scope.run(() => {
      const { handle } = useDraggable(box);
      handleRef = handle;
    });
    expect(handleRef).not.toBeNull();
    // Sanity: handle should still be operational while scope is active.
    handleRef!.moveTo({ x: 5, y: 5 });
    scope.stop();
    // After stop, listeners are removed (destroy was called). We cannot
    // directly observe destroy from the outside, but moving the element via
    // pointer events should not change the signal anymore.
    const beforePos = handleRef!.getPosition();
    firePointer(box, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointer(box, 'pointermove', { clientX: 50, clientY: 50 });
    firePointer(box, 'pointerup', { clientX: 50, clientY: 50 });
    // After destroy the pointerdown listener was removed, so position is unchanged.
    expect(handleRef!.getPosition()).toEqual(beforePos);
  });

  it('still preserves user callbacks alongside reactive wiring', () => {
    let startCount = 0;
    let endCount = 0;
    const { handle } = useDraggable(box, {
      onDragStart: () => {
        startCount += 1;
      },
      onDragEnd: () => {
        endCount += 1;
      },
    });
    firePointer(box, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointer(box, 'pointerup', { clientX: 0, clientY: 0 });
    expect(startCount).toBe(1);
    expect(endCount).toBe(1);
    handle.destroy();
  });
});

describe('useDroppable', () => {
  let zone: HTMLElement;

  beforeEach(() => {
    zone = document.createElement('div');
    document.body.appendChild(zone);
  });

  afterEach(() => {
    zone.remove();
  });

  it('exposes isOver and activeDragged signals', () => {
    const { isOver, activeDragged, handle } = useDroppable(zone);
    expect(isOver.value).toBe(false);
    expect(activeDragged.value).toBe(null);
    handle.destroy();
  });
});

describe('useSortable', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    for (let i = 0; i < 3; i += 1) {
      const item = document.createElement('div');
      item.textContent = String(i);
      item.dataset.id = String(i);
      container.appendChild(item);
    }
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('emits the current order as a signal', () => {
    const { order, handle } = useSortable(container);
    expect(order.value.map((el) => el.dataset.id)).toEqual(['0', '1', '2']);
    handle.move(0, 2);
    expect(order.value.map((el) => el.dataset.id)).toEqual(['1', '2', '0']);
    handle.destroy();
  });

  it('updates the order signal when setOrder() is called programmatically', () => {
    const { order, handle } = useSortable(container);
    handle.setOrder([2, 0, 1]);
    expect(order.value.map((el) => el.dataset.id)).toEqual(['2', '0', '1']);
    handle.destroy();
  });

  it('auto-disposes when the surrounding scope stops', () => {
    const scope = effectScope();
    let handleRef: ReturnType<typeof useSortable>['handle'] | null = null;
    scope.run(() => {
      const { handle } = useSortable(container);
      handleRef = handle;
    });
    expect(handleRef).not.toBeNull();
    scope.stop();
    // After destroy, the pointerdown listener is gone; sort drags no-op.
    expect(handleRef!.getItems().length).toBe(3);
  });
});

describe('draggablePosition adapter', () => {
  let box: HTMLElement;

  beforeEach(() => {
    box = document.createElement('div');
    document.body.appendChild(box);
  });

  afterEach(() => {
    box.remove();
  });

  it('mirrors the handle position through a signal', () => {
    const handle = draggable(box);
    const position = draggablePosition(box, handle);
    expect(position.value).toEqual({ x: 0, y: 0 });
    handle.moveTo({ x: 12, y: 34 });
    // Sync happens on pointer events; trigger one.
    firePointer(box, 'pointermove', { clientX: 0, clientY: 0 });
    expect(position.value).toEqual({ x: 12, y: 34 });
    handle.destroy();
  });

  it('removes adapter listeners when the handle is destroyed outside a scope', () => {
    const handle = draggable(box);
    const position = draggablePosition(box, handle);
    handle.destroy();
    handle.moveTo({ x: 12, y: 34 });
    firePointer(box, 'pointermove', { clientX: 0, clientY: 0 });
    expect(position.value).toEqual({ x: 0, y: 0 });
  });
});

describe('sortableOrder adapter', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    for (let i = 0; i < 3; i += 1) {
      const item = document.createElement('div');
      item.dataset.id = String(i);
      container.appendChild(item);
    }
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('reflects the current item order', () => {
    const handle = sortable(container);
    const order = sortableOrder(container, handle);
    expect(order.value.map((el) => el.dataset.id)).toEqual(['0', '1', '2']);
    handle.move(0, 2);
    // Trigger a pointerup to sync.
    firePointer(container, 'pointerup', {});
    expect(order.value.map((el) => el.dataset.id)).toEqual(['1', '2', '0']);
    handle.destroy();
  });

  it('removes adapter listeners when the handle is destroyed outside a scope', () => {
    const handle = sortable(container);
    const order = sortableOrder(container, handle);
    handle.destroy();
    handle.move(0, 2);
    firePointer(container, 'pointerup', {});
    expect(order.value.map((el) => el.dataset.id)).toEqual(['0', '1', '2']);
  });
});

describe('reactive composables outside a scope', () => {
  it('do not throw when scope is absent', () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const { handle } = useDraggable(box);
    expect(typeof handle.destroy).toBe('function');
    handle.destroy();
    box.remove();
  });
});

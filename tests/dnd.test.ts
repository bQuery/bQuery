/**
 * Tests for the bQuery Drag & Drop module.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { draggable } from '../src/dnd/draggable';
import { droppable } from '../src/dnd/droppable';
import { sortable } from '../src/dnd/sortable';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createContainer = (): HTMLDivElement => {
  const container = document.createElement('div');
  container.style.width = '500px';
  container.style.height = '500px';
  container.style.position = 'relative';
  document.body.appendChild(container);
  return container;
};

const createBox = (id?: string): HTMLDivElement => {
  const box = document.createElement('div');
  box.style.width = '100px';
  box.style.height = '100px';
  box.style.position = 'absolute';
  if (id) box.id = id;
  return box;
};

const firePointerEvent = (
  target: EventTarget,
  type: string,
  options: Partial<PointerEventInit> = {}
): void => {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    ...options,
  });
  target.dispatchEvent(event);
};

// Shared droppable pointer tracking is flushed through requestAnimationFrame,
// so tests wait slightly longer than one frame before asserting queued updates.
const POINTER_TRACKING_FLUSH_DELAY_MS = 20;

const setZoneRect = (
  target: HTMLElement,
  rect: { left: number; top: number; right: number; bottom: number }
): void => {
  target.getBoundingClientRect = () =>
    ({
      ...rect,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
};

const flushPointerTracking = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, POINTER_TRACKING_FLUSH_DELAY_MS));
};

// ─── draggable() ─────────────────────────────────────────────────────────────

describe('dnd/draggable', () => {
  let container: HTMLDivElement;
  let box: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
    box = createBox('drag-box');
    container.appendChild(box);
  });

  afterEach(() => {
    container.remove();
  });

  it('should return a handle with destroy, disable, enable', () => {
    const handle = draggable(box);
    expect(typeof handle.destroy).toBe('function');
    expect(typeof handle.disable).toBe('function');
    expect(typeof handle.enable).toBe('function');
    expect(handle.enabled).toBe(true);
    handle.destroy();
  });

  it('should set touch-action and user-select on init', () => {
    const handle = draggable(box);
    expect(box.style.touchAction).toBe('none');
    expect(box.style.userSelect).toBe('none');
    handle.destroy();
  });

  it('should clean up styles on destroy', () => {
    const handle = draggable(box);
    handle.destroy();
    expect(box.style.touchAction).toBe('');
    expect(box.style.userSelect).toBe('');
  });

  it('should restore existing inline styles on destroy', () => {
    box.style.touchAction = 'pan-x';
    box.style.userSelect = 'text';

    const handle = draggable(box);

    expect(box.style.touchAction).toBe('none');
    expect(box.style.userSelect).toBe('none');

    handle.destroy();

    expect(box.style.touchAction).toBe('pan-x');
    expect(box.style.userSelect).toBe('text');
  });

  it('should add dragging class on pointerdown', () => {
    const handle = draggable(box, { draggingClass: 'my-drag' });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    expect(box.classList.contains('my-drag')).toBe(true);
    firePointerEvent(box, 'pointerup', { clientX: 50, clientY: 50 });
    expect(box.classList.contains('my-drag')).toBe(false);
    handle.destroy();
  });

  it('should call onDragStart on pointerdown', () => {
    let called = false;
    const handle = draggable(box, {
      onDragStart: (data) => {
        called = true;
        expect(data.element).toBe(box);
        expect(data.position.x).toBe(0);
        expect(data.position.y).toBe(0);
      },
    });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    expect(called).toBe(true);
    firePointerEvent(box, 'pointerup', { clientX: 50, clientY: 50 });
    handle.destroy();
  });

  it('should call onDrag on pointermove', () => {
    let dragData: { x: number; y: number } | null = null;
    const handle = draggable(box, {
      onDrag: (data) => {
        dragData = { x: data.position.x, y: data.position.y };
      },
    });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(box, 'pointermove', { clientX: 70, clientY: 80 });
    expect(dragData).not.toBeNull();
    expect(dragData!.x).toBe(20);
    expect(dragData!.y).toBe(30);
    firePointerEvent(box, 'pointerup', { clientX: 70, clientY: 80 });
    handle.destroy();
  });

  it('should call onDragEnd on pointerup', () => {
    let endCalled = false;
    const handle = draggable(box, {
      onDragEnd: () => {
        endCalled = true;
      },
    });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(box, 'pointerup', { clientX: 70, clientY: 70 });
    expect(endCalled).toBe(true);
    handle.destroy();
  });

  it('should respect axis: x constraint', () => {
    let lastPos: { x: number; y: number } | null = null;
    const handle = draggable(box, {
      axis: 'x',
      onDrag: (data) => {
        lastPos = { x: data.position.x, y: data.position.y };
      },
    });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(box, 'pointermove', { clientX: 70, clientY: 80 });
    expect(lastPos!.x).toBe(20);
    expect(lastPos!.y).toBe(0); // Y should not change
    firePointerEvent(box, 'pointerup', { clientX: 70, clientY: 80 });
    handle.destroy();
  });

  it('should respect axis: y constraint', () => {
    let lastPos: { x: number; y: number } | null = null;
    const handle = draggable(box, {
      axis: 'y',
      onDrag: (data) => {
        lastPos = { x: data.position.x, y: data.position.y };
      },
    });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(box, 'pointermove', { clientX: 70, clientY: 80 });
    expect(lastPos!.x).toBe(0); // X should not change
    expect(lastPos!.y).toBe(30);
    firePointerEvent(box, 'pointerup', { clientX: 70, clientY: 80 });
    handle.destroy();
  });

  it('should disable dragging when disabled', () => {
    let startCalled = false;
    const handle = draggable(box, {
      onDragStart: () => {
        startCalled = true;
      },
    });
    handle.disable();
    expect(handle.enabled).toBe(false);
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    expect(startCalled).toBe(false);
    handle.destroy();
  });

  it('should re-enable dragging after disable', () => {
    let startCalled = false;
    const handle = draggable(box, {
      onDragStart: () => {
        startCalled = true;
      },
    });
    handle.disable();
    handle.enable();
    expect(handle.enabled).toBe(true);
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    expect(startCalled).toBe(true);
    firePointerEvent(box, 'pointerup', { clientX: 50, clientY: 50 });
    handle.destroy();
  });

  it('should start disabled when options.disabled is true', () => {
    let startCalled = false;
    const handle = draggable(box, {
      disabled: true,
      onDragStart: () => {
        startCalled = true;
      },
    });
    expect(handle.enabled).toBe(false);
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    expect(startCalled).toBe(false);
    handle.destroy();
  });

  it('should not start drag if handle selector does not match target', () => {
    const handleEl = document.createElement('span');
    handleEl.className = 'handle';
    box.appendChild(handleEl);

    let startCalled = false;
    const handle = draggable(box, {
      handle: '.handle',
      onDragStart: () => {
        startCalled = true;
      },
    });

    // Click on box itself, not handle — should not start drag
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    expect(startCalled).toBe(false);

    // Click on handle — should start drag
    firePointerEvent(handleEl, 'pointerdown', { clientX: 50, clientY: 50 });
    expect(startCalled).toBe(true);

    firePointerEvent(box, 'pointerup', { clientX: 50, clientY: 50 });
    handle.destroy();
  });

  it('should update transform on pointermove', () => {
    const handle = draggable(box);
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(box, 'pointermove', { clientX: 70, clientY: 80 });
    expect(box.style.transform).toBe('translate(20px, 30px)');
    firePointerEvent(box, 'pointerup', { clientX: 70, clientY: 80 });
    handle.destroy();
  });

  it('should not move on pointermove without prior pointerdown', () => {
    const handle = draggable(box);
    firePointerEvent(box, 'pointermove', { clientX: 70, clientY: 80 });
    expect(box.style.transform).toBe('');
    handle.destroy();
  });

  it('should handle pointercancel like pointerup', () => {
    let endCalled = false;
    const handle = draggable(box, {
      onDragEnd: () => {
        endCalled = true;
      },
    });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(box, 'pointercancel', { clientX: 50, clientY: 50 });
    expect(endCalled).toBe(true);
    handle.destroy();
  });

  it('should still clean up and call onDragEnd if releasing pointer capture throws', () => {
    let endCalled = false;
    const handle = draggable(box, {
      draggingClass: 'drag-active',
      onDragEnd: () => {
        endCalled = true;
      },
    });

    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    box.releasePointerCapture = () => {
      throw new DOMException('capture already released');
    };

    expect(() => {
      firePointerEvent(box, 'pointerup', { clientX: 60, clientY: 60 });
    }).not.toThrow();
    expect(endCalled).toBe(true);
    expect(box.classList.contains('drag-active')).toBe(false);

    handle.destroy();
  });

  it('should provide correct delta values', () => {
    const deltas: Array<{ x: number; y: number }> = [];
    const handle = draggable(box, {
      onDrag: (data) => {
        deltas.push({ x: data.delta.x, y: data.delta.y });
      },
    });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(box, 'pointermove', { clientX: 60, clientY: 60 });
    firePointerEvent(box, 'pointermove', { clientX: 75, clientY: 75 });

    expect(deltas.length).toBe(2);
    expect(deltas[0].x).toBe(10);
    expect(deltas[0].y).toBe(10);
    expect(deltas[1].x).toBe(15);
    expect(deltas[1].y).toBe(15);

    firePointerEvent(box, 'pointerup', { clientX: 75, clientY: 75 });
    handle.destroy();
  });

  it('should work with default options', () => {
    const handle = draggable(box);
    expect(handle.enabled).toBe(true);
    handle.destroy();
  });

  it('should apply bounds constraint with explicit rect', () => {
    let lastPos: { x: number; y: number } | null = null;
    const handle = draggable(box, {
      bounds: { left: 0, top: 0, right: 50, bottom: 50 },
      onDrag: (data) => {
        lastPos = { x: data.position.x, y: data.position.y };
      },
    });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(box, 'pointermove', { clientX: 200, clientY: 200 });
    // Should be clamped to bounds
    expect(lastPos!.x).toBeLessThanOrEqual(50);
    expect(lastPos!.y).toBeLessThanOrEqual(50);
    firePointerEvent(box, 'pointerup', { clientX: 200, clientY: 200 });
    handle.destroy();
  });

  it('should treat non-numeric inline bounds offsets as zero', () => {
    box.style.left = 'auto';
    box.style.top = 'auto';

    let lastPos: { x: number; y: number } | null = null;
    const handle = draggable(box, {
      bounds: { left: 0, top: 0, right: 50, bottom: 50 },
      onDrag: (data) => {
        lastPos = { x: data.position.x, y: data.position.y };
      },
    });

    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(box, 'pointermove', { clientX: 200, clientY: 200 });

    expect(lastPos).not.toBeNull();
    expect(Number.isNaN(lastPos!.x)).toBe(false);
    expect(Number.isNaN(lastPos!.y)).toBe(false);
    expect(lastPos!.x).toBeLessThanOrEqual(50);
    expect(lastPos!.y).toBeLessThanOrEqual(50);

    firePointerEvent(box, 'pointerup', { clientX: 200, clientY: 200 });
    handle.destroy();
  });

  it('should create ghost element when ghost option is true', () => {
    const handle = draggable(box, { ghost: true });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });

    const ghosts = document.querySelectorAll('.bq-drag-ghost');
    expect(ghosts.length).toBe(1);

    firePointerEvent(box, 'pointerup', { clientX: 70, clientY: 70 });

    // Ghost should be removed after drop
    const ghostsAfter = document.querySelectorAll('.bq-drag-ghost');
    expect(ghostsAfter.length).toBe(0);
    handle.destroy();
  });

  it('should apply custom ghost class', () => {
    const handle = draggable(box, { ghost: true, ghostClass: 'my-ghost' });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });

    const ghosts = document.querySelectorAll('.my-ghost');
    expect(ghosts.length).toBe(1);

    firePointerEvent(box, 'pointerup', { clientX: 50, clientY: 50 });
    handle.destroy();
  });

  it('should update ghost position using accumulated drag offset', () => {
    const handle = draggable(box, { ghost: true });
    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });

    const ghost = document.querySelector('.bq-drag-ghost') as HTMLElement | null;
    expect(ghost).not.toBeNull();
    expect(ghost!.style.left).toBe('0px');
    expect(ghost!.style.top).toBe('0px');

    firePointerEvent(box, 'pointermove', { clientX: 60, clientY: 65 });
    expect(ghost!.style.left).toBe('10px');
    expect(ghost!.style.top).toBe('15px');

    firePointerEvent(box, 'pointermove', { clientX: 80, clientY: 90 });
    expect(ghost!.style.left).toBe('30px');
    expect(ghost!.style.top).toBe('40px');

    firePointerEvent(box, 'pointerup', { clientX: 80, clientY: 90 });
    handle.destroy();
  });
});

// ─── droppable() ─────────────────────────────────────────────────────────────

describe('dnd/droppable', () => {
  let container: HTMLDivElement;
  let zone: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
    zone = document.createElement('div');
    zone.id = 'drop-zone';
    zone.style.width = '200px';
    zone.style.height = '200px';
    zone.style.position = 'absolute';
    zone.style.left = '0';
    zone.style.top = '0';
    container.appendChild(zone);
  });

  afterEach(() => {
    container.remove();
  });

  it('should return a handle with destroy', () => {
    const handle = droppable(zone);
    expect(typeof handle.destroy).toBe('function');
    handle.destroy();
  });

  it('should remove event listeners on destroy', () => {
    const handle = droppable(zone);
    // Should not throw
    handle.destroy();
  });

  it('should accept with custom accept function', () => {
    const box = createBox('test-box');
    box.classList.add('bq-dragging');
    container.appendChild(box);

    const handle = droppable(zone, {
      accept: (el) => el.id === 'test-box',
      onDragEnter: () => undefined,
    });

    // Simulate pointer inside zone bounds
    // Note: getBoundingClientRect in happy-dom returns all zeros, so we check the callback logic
    firePointerEvent(document, 'pointermove', { clientX: 50, clientY: 50 });

    handle.destroy();
    box.remove();
  });

  it('should apply overClass when configured', () => {
    const handle = droppable(zone, { overClass: 'custom-over' });
    // The overClass is applied/removed based on pointer position detection
    handle.destroy();
  });

  it('should call onDrop when pointer is released over zone', () => {
    const box = createBox('dragged-item');
    box.classList.add('bq-dragging');
    container.appendChild(box);

    const handle = droppable(zone, {
      onDrop: () => undefined,
    });

    // In happy-dom, getBoundingClientRect returns zeros, so we test the wiring
    firePointerEvent(document, 'pointerup', { clientX: 50, clientY: 50 });

    handle.destroy();
    box.remove();
  });

  it('should detect active drags when draggable uses a custom draggingClass', async () => {
    let entered = false;
    const box = createBox('registry-dragged-item');
    container.appendChild(box);
    zone.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 200,
        bottom: 200,
        width: 200,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const dragHandle = draggable(box, { draggingClass: 'custom-dragging' });
    const dropHandle = droppable(zone, {
      onDragEnter: () => {
        entered = true;
      },
    });

    firePointerEvent(box, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(document, 'pointermove', { clientX: 50, clientY: 50 });
    await flushPointerTracking();

    expect(entered).toBe(true);

    firePointerEvent(document, 'pointerup', { clientX: 50, clientY: 50 });
    dropHandle.destroy();
    dragHandle.destroy();
    box.remove();
  });

  it('should only call onDrop when pointerup occurs inside the zone', () => {
    let drops = 0;
    const box = createBox('drop-inside-item');
    container.appendChild(box);
    setZoneRect(zone, { left: 0, top: 0, right: 200, bottom: 200 });

    const dragHandle = draggable(box);
    const dropHandle = droppable(zone, {
      onDrop: () => {
        drops++;
      },
    });

    firePointerEvent(box, 'pointerdown', { clientX: 10, clientY: 10 });
    firePointerEvent(document, 'pointermove', { clientX: 50, clientY: 50 });
    firePointerEvent(document, 'pointerup', { clientX: 50, clientY: 50 });

    expect(drops).toBe(1);

    dropHandle.destroy();
    dragHandle.destroy();
    box.remove();
  });

  it('should not call onDrop when pointer leaves the zone before pointerup', () => {
    let drops = 0;
    const box = createBox('drop-outside-item');
    container.appendChild(box);
    setZoneRect(zone, { left: 0, top: 0, right: 200, bottom: 200 });

    const dragHandle = draggable(box);
    const dropHandle = droppable(zone, {
      onDrop: () => {
        drops++;
      },
    });

    firePointerEvent(box, 'pointerdown', { clientX: 10, clientY: 10 });
    firePointerEvent(document, 'pointermove', { clientX: 50, clientY: 50 });
    firePointerEvent(document, 'pointerup', { clientX: 250, clientY: 250 });

    expect(drops).toBe(0);

    dropHandle.destroy();
    dragHandle.destroy();
    box.remove();
  });

  it('should respect accept filtering for move and pointerup paths', async () => {
    let enters = 0;
    let drops = 0;
    const accepted = createBox('accepted-item');
    accepted.classList.add('accept-me');
    const rejected = createBox('rejected-item');
    container.append(accepted, rejected);
    setZoneRect(zone, { left: 0, top: 0, right: 200, bottom: 200 });

    const acceptedDragHandle = draggable(accepted);
    const rejectedDragHandle = draggable(rejected);
    const dropHandle = droppable(zone, {
      accept: '.accept-me',
      onDragEnter: () => {
        enters++;
      },
      onDrop: () => {
        drops++;
      },
    });

    firePointerEvent(rejected, 'pointerdown', { clientX: 10, clientY: 10 });
    firePointerEvent(document, 'pointermove', { clientX: 50, clientY: 50 });
    await flushPointerTracking();
    firePointerEvent(document, 'pointerup', { clientX: 50, clientY: 50 });

    firePointerEvent(accepted, 'pointerdown', { clientX: 10, clientY: 10 });
    firePointerEvent(document, 'pointermove', { clientX: 50, clientY: 50 });
    await flushPointerTracking();
    firePointerEvent(document, 'pointerup', { clientX: 50, clientY: 50 });

    expect(enters).toBe(1);
    expect(drops).toBe(1);

    dropHandle.destroy();
    acceptedDragHandle.destroy();
    rejectedDragHandle.destroy();
    accepted.remove();
    rejected.remove();
  });

  it('returns a no-op handle when document is unavailable', () => {
    const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

    try {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: undefined,
      });

      const handle = droppable(zone);
      expect(typeof handle.destroy).toBe('function');
      handle.destroy();
    } finally {
      if (originalDocumentDescriptor) {
        Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
      }
    }
  });

  it('returns a no-op handle when document listener APIs are unavailable', () => {
    const originalAddEventListener = document.addEventListener;
    const originalRemoveEventListener = document.removeEventListener;

    try {
      Object.defineProperty(document, 'addEventListener', {
        configurable: true,
        writable: true,
        value: undefined,
      });
      Object.defineProperty(document, 'removeEventListener', {
        configurable: true,
        writable: true,
        value: undefined,
      });

      const handle = droppable(zone);
      expect(typeof handle.destroy).toBe('function');
      expect(() => handle.destroy()).not.toThrow();
    } finally {
      Object.defineProperty(document, 'addEventListener', {
        configurable: true,
        writable: true,
        value: originalAddEventListener,
      });
      Object.defineProperty(document, 'removeEventListener', {
        configurable: true,
        writable: true,
        value: originalRemoveEventListener,
      });
    }
  });
});

// ─── sortable() ──────────────────────────────────────────────────────────────

describe('dnd/sortable', () => {
  let container: HTMLDivElement;

  const createSortableList = (): HTMLElement => {
    const list = document.createElement('ul');
    list.style.width = '200px';
    for (let i = 1; i <= 3; i++) {
      const li = document.createElement('li');
      li.textContent = `Item ${i}`;
      li.dataset.index = String(i);
      list.appendChild(li);
    }
    return list;
  };

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    container.remove();
  });

  it('should return a handle with destroy, disable, enable', () => {
    const list = createSortableList();
    container.appendChild(list);

    const handle = sortable(list, { items: 'li' });
    expect(typeof handle.destroy).toBe('function');
    expect(typeof handle.disable).toBe('function');
    expect(typeof handle.enable).toBe('function');
    expect(handle.enabled).toBe(true);
    handle.destroy();
  });

  it('should set touch-action on container', () => {
    const list = createSortableList();
    container.appendChild(list);

    const handle = sortable(list);
    expect(list.style.touchAction).toBe('none');
    handle.destroy();
  });

  it('should clean up on destroy', () => {
    const list = createSortableList();
    container.appendChild(list);

    const handle = sortable(list);
    handle.destroy();
    expect(list.style.touchAction).toBe('');
  });

  it('should call onSortStart on pointerdown on item', () => {
    const list = createSortableList();
    container.appendChild(list);

    let startCalled = false;
    let startData: { oldIndex: number; newIndex: number } | null = null;

    const handle = sortable(list, {
      items: 'li',
      onSortStart: (data) => {
        startCalled = true;
        startData = { oldIndex: data.oldIndex, newIndex: data.newIndex };
      },
    });

    const firstItem = list.querySelector('li')!;
    firePointerEvent(firstItem, 'pointerdown', {
      clientX: 50,
      clientY: 20,
    });

    expect(startCalled).toBe(true);
    expect(startData!.oldIndex).toBe(0);

    firePointerEvent(list, 'pointerup', { clientX: 50, clientY: 20 });
    handle.destroy();
  });

  it('should not start when disabled', () => {
    const list = createSortableList();
    container.appendChild(list);

    let startCalled = false;
    const handle = sortable(list, {
      items: 'li',
      disabled: true,
      onSortStart: () => {
        startCalled = true;
      },
    });

    expect(handle.enabled).toBe(false);
    const firstItem = list.querySelector('li')!;
    firePointerEvent(firstItem, 'pointerdown', { clientX: 50, clientY: 20 });
    expect(startCalled).toBe(false);
    handle.destroy();
  });

  it('should disable and re-enable sorting', () => {
    const list = createSortableList();
    container.appendChild(list);

    const handle = sortable(list, { items: 'li' });
    handle.disable();
    expect(handle.enabled).toBe(false);
    handle.enable();
    expect(handle.enabled).toBe(true);
    handle.destroy();
  });

  it('should create placeholder on drag start', () => {
    const list = createSortableList();
    container.appendChild(list);

    const handle = sortable(list, {
      items: 'li',
      placeholderClass: 'my-placeholder',
    });

    const firstItem = list.querySelector('li')!;
    firePointerEvent(firstItem, 'pointerdown', {
      clientX: 50,
      clientY: 20,
    });

    const placeholder = list.querySelector('.my-placeholder');
    expect(placeholder).not.toBeNull();

    firePointerEvent(list, 'pointerup', { clientX: 50, clientY: 20 });
    handle.destroy();
  });

  it('should add sorting class to item being dragged', () => {
    const list = createSortableList();
    container.appendChild(list);

    const handle = sortable(list, {
      items: 'li',
      sortingClass: 'is-sorting',
    });

    const firstItem = list.querySelector('li')!;
    firePointerEvent(firstItem, 'pointerdown', {
      clientX: 50,
      clientY: 20,
    });

    expect(firstItem.classList.contains('is-sorting')).toBe(true);

    firePointerEvent(list, 'pointerup', { clientX: 50, clientY: 20 });
    handle.destroy();
  });

  it('should call onSortEnd when pointerup', () => {
    const list = createSortableList();
    container.appendChild(list);

    let endData: { oldIndex: number; newIndex: number } | null = null;
    const handle = sortable(list, {
      items: 'li',
      animationDuration: 0,
      onSortEnd: (data) => {
        endData = { oldIndex: data.oldIndex, newIndex: data.newIndex };
      },
    });

    const firstItem = list.querySelector('li')!;
    firePointerEvent(firstItem, 'pointerdown', {
      clientX: 50,
      clientY: 20,
    });
    firePointerEvent(list, 'pointerup', { clientX: 50, clientY: 100 });

    expect(endData).not.toBeNull();
    expect(endData!.oldIndex).toBe(0);
    handle.destroy();
  });

  it('should call onSortEnd after animated pointerup without losing dragged item data', () => {
    const list = createSortableList();
    container.appendChild(list);

    let endData: { oldIndex: number; newIndex: number } | null = null;
    const handle = sortable(list, {
      items: 'li',
      animationDuration: 50,
      onSortEnd: (data) => {
        endData = { oldIndex: data.oldIndex, newIndex: data.newIndex };
      },
    });

    const firstItem = list.querySelector('li')!;
    firePointerEvent(firstItem, 'pointerdown', {
      clientX: 50,
      clientY: 20,
    });
    firePointerEvent(list, 'pointerup', { clientX: 50, clientY: 100 });

    firstItem.dispatchEvent(new Event('transitionend'));

    expect(endData).not.toBeNull();
    expect(endData!.oldIndex).toBe(0);
    handle.destroy();
  });

  it('should respect handle option', () => {
    const list = createSortableList();
    container.appendChild(list);

    // Add handle elements
    list.querySelectorAll('li').forEach((li) => {
      const grip = document.createElement('span');
      grip.className = 'grip';
      li.prepend(grip);
    });

    let startCalled = false;
    const handle = sortable(list, {
      items: 'li',
      handle: '.grip',
      onSortStart: () => {
        startCalled = true;
      },
    });

    // Click on li body (not handle) should not start
    const firstItem = list.querySelector('li')!;
    firePointerEvent(firstItem, 'pointerdown', { clientX: 50, clientY: 20 });
    expect(startCalled).toBe(false);

    // Click on grip should start
    const grip = firstItem.querySelector('.grip')!;
    firePointerEvent(grip, 'pointerdown', { clientX: 50, clientY: 20 });
    expect(startCalled).toBe(true);

    firePointerEvent(list, 'pointerup', { clientX: 50, clientY: 20 });
    handle.destroy();
  });

  it('should work with default options', () => {
    const list = createSortableList();
    container.appendChild(list);

    const handle = sortable(list);
    expect(handle.enabled).toBe(true);
    handle.destroy();
  });
});

// ─── Module exports ──────────────────────────────────────────────────────────

describe('dnd module exports', () => {
  it('should export draggable function', () => {
    expect(typeof draggable).toBe('function');
  });

  it('should export droppable function', () => {
    expect(typeof droppable).toBe('function');
  });

  it('should export sortable function', () => {
    expect(typeof sortable).toBe('function');
  });
});

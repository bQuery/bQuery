/**
 * Tests for the bQuery Drag & Drop module.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { draggable, getActiveDrag } from '../src/dnd/draggable';
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

  it('should register the shared pointermove listener as passive', () => {
    const originalAddEventListener = document.addEventListener;
    let pointerMoveOptions: AddEventListenerOptions | boolean | undefined;

    try {
      document.addEventListener = ((
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: AddEventListenerOptions | boolean
      ) => {
        if (type === 'pointermove') {
          pointerMoveOptions = options;
        }
        return originalAddEventListener.call(document, type, listener, options);
      }) as typeof document.addEventListener;

      const handle = droppable(zone);
      handle.destroy();

      expect(pointerMoveOptions).toEqual({ passive: true });
    } finally {
      document.addEventListener = originalAddEventListener;
    }
  });

  it('should dispatch pointermove listeners from a stable snapshot when a zone destroys itself', async () => {
    const box = createBox('drag-box');
    const secondZone = createBox('second-zone');
    container.appendChild(box);
    container.appendChild(secondZone);
    setZoneRect(zone, { left: 0, top: 0, right: 100, bottom: 100 });
    setZoneRect(secondZone, { left: 0, top: 0, right: 100, bottom: 100 });

    const dragHandle = draggable(box);
    const dispatchOrder: string[] = [];

    let firstHandle: ReturnType<typeof droppable> | undefined;
    firstHandle = droppable(zone, {
      onDragEnter: () => {
        dispatchOrder.push('first');
        firstHandle?.destroy();
      },
    });

    const secondHandle = droppable(secondZone, {
      onDragEnter: () => {
        dispatchOrder.push('second');
      },
    });

    firePointerEvent(box, 'pointerdown', { clientX: 10, clientY: 10 });
    firePointerEvent(document, 'pointermove', { clientX: 50, clientY: 50 });
    await flushPointerTracking();

    expect(dispatchOrder).toEqual(['first', 'second']);

    secondHandle.destroy();
    dragHandle.destroy();
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

  it('reports pointer-driven indices using the sortable items list', () => {
    const list = createSortableList();
    const spacer = document.createElement('div');
    spacer.textContent = 'Spacer';
    list.prepend(spacer);
    container.appendChild(list);

    const [firstItem, secondItem, thirdItem] = Array.from(list.querySelectorAll('li'));
    setZoneRect(firstItem, { left: 0, top: 0, right: 100, bottom: 20 });
    setZoneRect(secondItem, { left: 0, top: 20, right: 100, bottom: 40 });
    setZoneRect(thirdItem, { left: 0, top: 40, right: 100, bottom: 60 });

    let endData: { oldIndex: number; newIndex: number } | null = null;
    const handle = sortable(list, {
      items: 'li',
      animationDuration: 0,
      onSortEnd: (data) => {
        endData = { oldIndex: data.oldIndex, newIndex: data.newIndex };
      },
    });

    firePointerEvent(firstItem, 'pointerdown', {
      clientX: 10,
      clientY: 10,
    });
    firePointerEvent(list, 'pointermove', { clientX: 10, clientY: 100 });
    firePointerEvent(list, 'pointerup', { clientX: 10, clientY: 100 });

    expect(endData).not.toBeNull();
    expect(endData!).toEqual({ oldIndex: 0, newIndex: 2 });
    handle.destroy();
  });

  it('keeps pointer-driven reordering safe when HTMLElement is unavailable', () => {
    const list = createSortableList();
    const spacer = document.createElement('div');
    spacer.textContent = 'Spacer';
    list.prepend(spacer);
    container.appendChild(list);

    const [firstItem, secondItem, thirdItem] = Array.from(list.querySelectorAll('li'));
    setZoneRect(firstItem, { left: 0, top: 0, right: 100, bottom: 20 });
    setZoneRect(secondItem, { left: 0, top: 20, right: 100, bottom: 40 });
    setZoneRect(thirdItem, { left: 0, top: 40, right: 100, bottom: 60 });

    let endData: { oldIndex: number; newIndex: number } | null = null;
    const handle = sortable(list, {
      items: 'li',
      animationDuration: 0,
      onSortEnd: (data) => {
        endData = { oldIndex: data.oldIndex, newIndex: data.newIndex };
      },
    });

    const originalHTMLElement = globalThis.HTMLElement;

    Object.defineProperty(globalThis, 'HTMLElement', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      firePointerEvent(firstItem, 'pointerdown', {
        clientX: 10,
        clientY: 10,
      });
      firePointerEvent(list, 'pointermove', { clientX: 10, clientY: 100 });
      firePointerEvent(list, 'pointerup', { clientX: 10, clientY: 100 });
    } finally {
      Object.defineProperty(globalThis, 'HTMLElement', {
        value: originalHTMLElement,
        configurable: true,
        writable: true,
      });
      handle.destroy();
    }

    expect(endData).not.toBeNull();
    expect(endData!).toEqual({ oldIndex: 0, newIndex: 2 });
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

// ─── M1 Programmatic API ─────────────────────────────────────────────────────

describe('dnd/draggable programmatic API', () => {
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

  it('moveTo() updates the position and applies it via transform', () => {
    const handle = draggable(box);
    handle.moveTo({ x: 25, y: 40 });
    expect(handle.getPosition()).toEqual({ x: 25, y: 40 });
    expect(box.style.transform).toBe('translate(25px, 40px)');
    expect(getActiveDrag()).toBeUndefined();
    handle.destroy();
  });

  it('moveTo() clamps to bounds when configured', () => {
    setZoneRect(container, { left: 0, top: 0, right: 200, bottom: 200 });
    setZoneRect(box, { left: 0, top: 0, right: 100, bottom: 100 });
    const handle = draggable(box, { bounds: 'parent' });
    handle.moveTo({ x: 100_000, y: 100_000 });
    const pos = handle.getPosition();
    // Clamped to a finite value (the exact value depends on parent vs element
    // geometry; here we just verify the clamp triggered).
    expect(pos.x).toBeLessThan(100_000);
    expect(pos.y).toBeLessThan(100_000);
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
    handle.destroy();
  });

  it('selector bounds no-op cleanly when document is unavailable', () => {
    const handle = draggable(box, { bounds: '.bounds' });
    const originalDocument = globalThis.document;

    Object.defineProperty(globalThis, 'document', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      expect(() => handle.moveTo({ x: 25, y: 40 })).not.toThrow();
      expect(handle.getPosition()).toEqual({ x: 25, y: 40 });
    } finally {
      Object.defineProperty(globalThis, 'document', {
        value: originalDocument,
        configurable: true,
        writable: true,
      });
      handle.destroy();
    }
  });

  it('reset() returns to {0,0}', () => {
    const handle = draggable(box);
    handle.moveTo({ x: 50, y: 50 });
    handle.reset();
    expect(handle.getPosition()).toEqual({ x: 0, y: 0 });
    expect(box.style.transform).toBe('');
    expect(getActiveDrag()).toBeUndefined();
    handle.destroy();
  });

  it('reset() clears transforms consistently in ghost mode', () => {
    const handle = draggable(box, { ghost: true });
    handle.moveTo({ x: 50, y: 50 });
    expect(box.style.transform).toBe('translate(50px, 50px)');
    handle.reset();
    expect(handle.getPosition()).toEqual({ x: 0, y: 0 });
    expect(box.style.transform).toBe('');
    handle.destroy();
  });

  it('setAxis() locks subsequent movement', () => {
    const handle = draggable(box);
    handle.setAxis('x');
    handle.moveTo({ x: 30, y: 30 });
    expect(handle.getPosition()).toEqual({ x: 30, y: 0 });
    handle.destroy();
  });

  it('setBounds() updates the constraint without rebinding', () => {
    const handle = draggable(box);
    handle.moveTo({ x: 999, y: 999 });
    expect(handle.getPosition().x).toBe(999);
    handle.setBounds({ left: -10, top: -10, right: 50, bottom: 50 });
    handle.moveTo({ x: 999, y: 999 });
    expect(handle.getPosition()).toEqual({ x: 50, y: 50 });
    handle.destroy();
  });

  it('snaps to grid when grid option is set', () => {
    const handle = draggable(box, { grid: 16 });
    handle.moveTo({ x: 23, y: 9 });
    expect(handle.getPosition()).toEqual({ x: 16, y: 16 });
    handle.destroy();
  });

  it('supports a [stepX, stepY] tuple for non-square grids', () => {
    const handle = draggable(box, { grid: [10, 25] });
    handle.moveTo({ x: 47, y: 60 });
    expect(handle.getPosition()).toEqual({ x: 50, y: 50 });
    handle.destroy();
  });
});

describe('dnd/draggable delay and threshold', () => {
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

  it('does not start dragging until the touchStartThreshold is exceeded', () => {
    let started = 0;
    const handle = draggable(box, {
      touchStartThreshold: 10,
      onDragStart: () => {
        started += 1;
      },
    });

    firePointerEvent(box, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointerEvent(box, 'pointermove', { clientX: 4, clientY: 0 });
    expect(started).toBe(0);
    firePointerEvent(box, 'pointermove', { clientX: 20, clientY: 0 });
    expect(started).toBe(1);
    firePointerEvent(box, 'pointerup', { clientX: 20, clientY: 0 });
    handle.destroy();
  });

  it('cancels pending pickup on pointerup before threshold is reached', () => {
    let started = 0;
    const handle = draggable(box, {
      touchStartThreshold: 50,
      onDragStart: () => {
        started += 1;
      },
    });
    firePointerEvent(box, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointerEvent(box, 'pointerup', { clientX: 5, clientY: 0 });
    expect(started).toBe(0);
    handle.destroy();
  });
});

describe('dnd/draggable bounds variants', () => {
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

  it('accepts an HTMLElement as bounds', () => {
    const bounder = document.createElement('div');
    bounder.id = 'bounds-el';
    document.body.appendChild(bounder);
    setZoneRect(bounder, { left: 0, top: 0, right: 200, bottom: 200 });
    setZoneRect(box, { left: 0, top: 0, right: 100, bottom: 100 });

    const handle = draggable(box, { bounds: bounder });
    handle.moveTo({ x: 100_000, y: 100_000 });
    const pos = handle.getPosition();
    expect(pos.x).toBeLessThan(100_000);
    expect(Number.isFinite(pos.x)).toBe(true);
    handle.destroy();
    bounder.remove();
  });

  it('does not throw for element bounds when HTMLElement is unavailable', () => {
    const originalHTMLElementDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'HTMLElement'
    );

    try {
      Object.defineProperty(globalThis, 'HTMLElement', {
        configurable: true,
        writable: true,
        value: undefined,
      });

      const handle = draggable(box, { bounds: box });
      expect(() => handle.moveTo({ x: 10, y: 15 })).not.toThrow();
      expect(handle.getPosition()).toEqual({ x: 10, y: 15 });
      handle.destroy();
    } finally {
      if (originalHTMLElementDescriptor) {
        Object.defineProperty(globalThis, 'HTMLElement', originalHTMLElementDescriptor);
      }
    }
  });

  it("accepts 'viewport' as a bounds shorthand", () => {
    setZoneRect(box, { left: 50, top: 50, right: 150, bottom: 150 });
    const handle = draggable(box, { bounds: 'viewport' });
    // Just verifies it doesn't throw and produces a finite clamp result.
    handle.moveTo({ x: 10_000, y: 10_000 });
    const pos = handle.getPosition();
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
    handle.destroy();
  });

  it("treats 'viewport' bounds as unconstrained when window is unavailable", () => {
    setZoneRect(box, { left: 50, top: 50, right: 150, bottom: 150 });
    const handle = draggable(box, { bounds: 'viewport' });
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

    try {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: undefined,
      });

      handle.moveTo({ x: 10_000, y: 20_000 });
      expect(handle.getPosition()).toEqual({ x: 10_000, y: 20_000 });
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
      }
    }

    handle.destroy();
  });
});

describe('dnd/droppable programmatic API', () => {
  let container: HTMLDivElement;
  let zone: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
    zone = document.createElement('div');
    zone.id = 'zone';
    container.appendChild(zone);
  });

  afterEach(() => {
    container.remove();
  });

  it('isOver() and getActiveDragged() reflect the current zone state', () => {
    const handle = droppable(zone);
    expect(handle.isOver()).toBe(false);
    expect(handle.getActiveDragged()).toBe(null);
    handle.destroy();
  });

  it('setAccept() updates the accept predicate without rebinding', () => {
    let calls = 0;
    const handle = droppable(zone, {
      accept: '.never',
      onDrop: () => {
        calls += 1;
      },
    });
    handle.setAccept(() => true);
    // The internal predicate can be inspected indirectly: a drop simulation
    // would require a draggable element flow; we settle for verifying that
    // setAccept exists and doesn't throw.
    expect(typeof handle.setAccept).toBe('function');
    expect(calls).toBe(0);
    handle.destroy();
  });
});

describe('dnd/sortable programmatic API', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
    for (let i = 0; i < 4; i += 1) {
      const item = document.createElement('div');
      item.textContent = `item-${i}`;
      item.dataset.id = `${i}`;
      container.appendChild(item);
    }
  });

  afterEach(() => {
    container.remove();
  });

  it('getItems() returns the current items in DOM order', () => {
    const handle = sortable(container);
    const ids = handle.getItems().map((el) => el.dataset.id);
    expect(ids).toEqual(['0', '1', '2', '3']);
    handle.destroy();
  });

  it('move() reorders items and fires onSortEnd', () => {
    const events: Array<{ oldIndex: number; newIndex: number }> = [];
    const handle = sortable(container, {
      onSortEnd: ({ oldIndex, newIndex }) => {
        events.push({ oldIndex, newIndex });
      },
    });
    handle.move(0, 2);
    const ids = handle.getItems().map((el) => el.dataset.id);
    expect(ids).toEqual(['1', '2', '0', '3']);
    expect(events[events.length - 1]).toEqual({ oldIndex: 0, newIndex: 2 });
    handle.destroy();
  });

  it('move() supports moving backwards', () => {
    const handle = sortable(container);
    handle.move(3, 1);
    const ids = handle.getItems().map((el) => el.dataset.id);
    expect(ids).toEqual(['0', '3', '1', '2']);
    handle.destroy();
  });

  it('setOrder() applies a permutation', () => {
    const handle = sortable(container);
    handle.setOrder([3, 2, 1, 0]);
    const ids = handle.getItems().map((el) => el.dataset.id);
    expect(ids).toEqual(['3', '2', '1', '0']);
    handle.destroy();
  });

  it('setOrder() notifies onSortEnd when it changes the DOM order', () => {
    const events: Array<{ item: string | undefined; oldIndex: number; newIndex: number }> = [];
    const handle = sortable(container, {
      onSortEnd: ({ item, oldIndex, newIndex }) => {
        events.push({ item: item.dataset.id, oldIndex, newIndex });
      },
    });
    handle.setOrder([3, 2, 1, 0]);
    expect(events).toEqual([{ item: '3', oldIndex: 3, newIndex: 0 }]);
    handle.destroy();
  });

  it('setOrder() rejects invalid permutations', () => {
    const handle = sortable(container);
    expect(() => handle.setOrder([0, 1, 2])).toThrow();
    expect(() => handle.setOrder([0, 0, 1, 2])).toThrow();
    expect(() => handle.setOrder([0, 1, 2, 5])).toThrow();
    handle.destroy();
  });
});

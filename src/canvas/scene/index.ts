/**
 * Retained-mode scene graph for `@bquery/bquery/canvas`.
 *
 * The scene is opt-in: import its factories explicitly when you want a
 * declarative node tree on top of the immediate-mode `BQueryCanvas` API.
 *
 * @module bquery/canvas
 */

import { effect } from '../../reactive/index';
import type { BQueryCanvas } from '../bquery-canvas';
import { createPathBuilder } from '../path-builder';
import type {
  CanvasPaint,
  CanvasPointerEvent,
  CircleNode,
  CreateSceneOptions,
  GroupNode,
  ImageNode,
  LayerNode,
  PathNode,
  Point,
  RectNode,
  Scene,
  SceneNode,
  SceneNodeBase,
  TextNode,
} from '../types';
import { peekImage, loadImage } from '../image';

const defaultBase: Required<Pick<SceneNodeBase, 'visible' | 'opacity' | 'zIndex' | 'interactive'>> = {
  visible: true,
  opacity: 1,
  zIndex: 0,
  interactive: false,
};

/** Construct a {@link RectNode}. */
export const rectNode = (props: Omit<RectNode, 'type'>): RectNode => ({
  type: 'rect',
  ...defaultBase,
  ...props,
});

/** Construct a {@link CircleNode}. */
export const circleNode = (props: Omit<CircleNode, 'type'>): CircleNode => ({
  type: 'circle',
  ...defaultBase,
  ...props,
});

/** Construct a {@link PathNode}. */
export const pathNode = (props: Omit<PathNode, 'type'>): PathNode => ({
  type: 'path',
  ...defaultBase,
  ...props,
});

/** Construct a {@link TextNode}. */
export const textNode = (props: Omit<TextNode, 'type'>): TextNode => ({
  type: 'text',
  ...defaultBase,
  ...props,
});

/** Construct an {@link ImageNode}. */
export const imageNode = (props: Omit<ImageNode, 'type'>): ImageNode => ({
  type: 'image',
  ...defaultBase,
  ...props,
});

/** Construct a {@link GroupNode}. */
export const groupNode = (props: Omit<GroupNode, 'type'>): GroupNode => ({
  type: 'group',
  ...defaultBase,
  ...props,
});

/** Construct a {@link LayerNode}. */
export const layerNode = (props: Omit<LayerNode, 'type'>): LayerNode => ({
  type: 'layer',
  ...defaultBase,
  ...props,
});

const getTransform = (node: SceneNode): Required<NonNullable<SceneNodeBase['transform']>> => {
  const t = node.transform ?? {};
  return {
    translateX: t.translateX ?? 0,
    translateY: t.translateY ?? 0,
    rotate: t.rotate ?? 0,
    scaleX: t.scaleX ?? 1,
    scaleY: t.scaleY ?? 1,
  };
};

const drawNode = (ctx: CanvasRenderingContext2D, node: SceneNode): void => {
  if (node.visible === false) return;
  const opacity = node.opacity ?? 1;
  if (opacity <= 0) return;

  ctx.save();
  ctx.globalAlpha *= opacity;
  const t = getTransform(node);
  if (t.translateX !== 0 || t.translateY !== 0) ctx.translate(t.translateX, t.translateY);
  if (t.rotate !== 0) ctx.rotate(t.rotate);
  if (t.scaleX !== 1 || t.scaleY !== 1) ctx.scale(t.scaleX, t.scaleY);

  switch (node.type) {
    case 'rect': {
      drawRect(ctx, node);
      break;
    }
    case 'circle': {
      drawCircle(ctx, node);
      break;
    }
    case 'path': {
      drawPath(ctx, node);
      break;
    }
    case 'text': {
      drawText(ctx, node);
      break;
    }
    case 'image': {
      drawImageNode(ctx, node);
      break;
    }
    case 'group':
    case 'layer': {
      const children = sortByZIndex(node.children);
      for (const child of children) drawNode(ctx, child);
      break;
    }
  }

  ctx.restore();
};

const drawRect = (ctx: CanvasRenderingContext2D, node: RectNode): void => {
  ctx.beginPath();
  if (node.radius && node.radius > 0) {
    const radius = Math.min(node.radius, Math.min(node.width, node.height) / 2);
    if (
      typeof (ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect === 'function'
    ) {
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(node.x, node.y, node.width, node.height, radius);
    } else {
      ctx.moveTo(node.x + radius, node.y);
      ctx.arcTo(node.x + node.width, node.y, node.x + node.width, node.y + node.height, radius);
      ctx.arcTo(node.x + node.width, node.y + node.height, node.x, node.y + node.height, radius);
      ctx.arcTo(node.x, node.y + node.height, node.x, node.y, radius);
      ctx.arcTo(node.x, node.y, node.x + node.width, node.y, radius);
      ctx.closePath();
    }
  } else {
    ctx.rect(node.x, node.y, node.width, node.height);
  }
  paintFillStroke(ctx, node.fill, node.stroke, node.lineWidth);
};

const drawCircle = (ctx: CanvasRenderingContext2D, node: CircleNode): void => {
  ctx.beginPath();
  ctx.arc(node.x, node.y, Math.max(0, node.radius), 0, Math.PI * 2);
  paintFillStroke(ctx, node.fill, node.stroke, node.lineWidth);
};

const drawPath = (ctx: CanvasRenderingContext2D, node: PathNode): void => {
  let path: Path2D;
  if (typeof node.path === 'function') {
    const builder = createPathBuilder();
    node.path(builder);
    path = builder.toPath2D();
  } else {
    path = node.path;
  }
  if (node.lineWidth !== undefined) ctx.lineWidth = node.lineWidth;
  if (node.fill !== undefined && node.fill !== null) {
    ctx.fillStyle = node.fill;
    ctx.fill(path);
  }
  if (node.stroke !== undefined && node.stroke !== null) {
    ctx.strokeStyle = node.stroke;
    ctx.stroke(path);
  }
};

const drawText = (ctx: CanvasRenderingContext2D, node: TextNode): void => {
  if (node.font !== undefined) ctx.font = node.font;
  if (node.textAlign !== undefined) ctx.textAlign = node.textAlign;
  if (node.textBaseline !== undefined) ctx.textBaseline = node.textBaseline;
  if (node.fill !== undefined && node.fill !== null) {
    ctx.fillStyle = node.fill;
    ctx.fillText(node.text, node.x, node.y, node.maxWidth);
  }
  if (node.stroke !== undefined && node.stroke !== null) {
    ctx.strokeStyle = node.stroke;
    ctx.strokeText(node.text, node.x, node.y, node.maxWidth);
  }
};

const drawImageNode = (ctx: CanvasRenderingContext2D, node: ImageNode): void => {
  let img: CanvasImageSource | undefined;
  if (typeof node.source === 'string') {
    const cached = peekImage(node.source);
    img = cached;
    if (!cached) {
      // Kick off background load; scene re-render happens when caller invokes
      // `scene.render()` after the load resolves.
      loadImage(node.source).catch(() => {});
      return;
    }
  } else {
    img = node.source;
  }
  if (!img) return;
  if (node.width !== undefined && node.height !== undefined) {
    ctx.drawImage(img, node.x, node.y, node.width, node.height);
  } else {
    ctx.drawImage(img, node.x, node.y);
  }
};

const paintFillStroke = (
  ctx: CanvasRenderingContext2D,
  fill: CanvasPaint | null | undefined,
  stroke: CanvasPaint | null | undefined,
  lineWidth: number | undefined
): void => {
  if (lineWidth !== undefined) ctx.lineWidth = lineWidth;
  if (fill !== undefined && fill !== null) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke !== undefined && stroke !== null) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
};

const sortByZIndex = (nodes: ReadonlyArray<SceneNode>): SceneNode[] => {
  // Stable insertion order: pair each node with its index, sort by (zIndex, idx).
  const indexed = nodes.map((node, idx) => ({ node, idx }));
  indexed.sort((a, b) => {
    const az = a.node.zIndex ?? 0;
    const bz = b.node.zIndex ?? 0;
    if (az !== bz) return az - bz;
    return a.idx - b.idx;
  });
  return indexed.map(entry => entry.node);
};

const flatten = (nodes: ReadonlyArray<SceneNode>): SceneNode[] => {
  const out: SceneNode[] = [];
  const walk = (list: ReadonlyArray<SceneNode>): void => {
    for (const node of sortByZIndex(list)) {
      if (node.type === 'group' || node.type === 'layer') {
        out.push(node);
        walk(node.children);
      } else {
        out.push(node);
      }
    }
  };
  walk(nodes);
  return out;
};

const localHitTest = (node: SceneNode, point: Point): boolean => {
  switch (node.type) {
    case 'rect':
      return (
        point.x >= node.x &&
        point.x <= node.x + node.width &&
        point.y >= node.y &&
        point.y <= node.y + node.height
      );
    case 'circle': {
      const dx = point.x - node.x;
      const dy = point.y - node.y;
      return dx * dx + dy * dy <= node.radius * node.radius;
    }
    case 'image': {
      if (node.width !== undefined && node.height !== undefined) {
        return (
          point.x >= node.x &&
          point.x <= node.x + node.width &&
          point.y >= node.y &&
          point.y <= node.y + node.height
        );
      }
      return false;
    }
    case 'path': {
      if (node.bounds) {
        return (
          point.x >= node.bounds.x &&
          point.x <= node.bounds.x + node.bounds.width &&
          point.y >= node.bounds.y &&
          point.y <= node.bounds.y + node.bounds.height
        );
      }
      return false;
    }
    case 'text': {
      // Coarse bbox approximation: 1em tall, text length * 0.6em wide.
      const approxHeight = 16;
      const approxWidth = node.text.length * 8;
      return (
        point.x >= node.x &&
        point.x <= node.x + approxWidth &&
        point.y >= node.y - approxHeight &&
        point.y <= node.y
      );
    }
    case 'group':
    case 'layer':
      return node.children.some(child => localHitTest(child, point));
  }
};

const transformPoint = (node: SceneNode, point: Point): Point => {
  const t = getTransform(node);
  let x = point.x - t.translateX;
  let y = point.y - t.translateY;
  if (t.rotate !== 0) {
    const cos = Math.cos(-t.rotate);
    const sin = Math.sin(-t.rotate);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    x = rx;
    y = ry;
  }
  if (t.scaleX !== 0) x /= t.scaleX;
  if (t.scaleY !== 0) y /= t.scaleY;
  return { x, y };
};

const findHit = (nodes: ReadonlyArray<SceneNode>, point: Point): SceneNode | undefined => {
  const ordered = [...sortByZIndex(nodes)].reverse();
  for (const node of ordered) {
    if (node.visible === false) continue;
    const local = transformPoint(node, point);
    if (node.type === 'group' || node.type === 'layer') {
      const hit = findHit(node.children, local);
      if (hit) return hit;
      continue;
    }
    if (node.interactive === false) continue;
    if (localHitTest(node, local)) return node;
  }
  return undefined;
};

/**
 * Create a retained-mode scene bound to a `BQueryCanvas`.
 *
 * @example
 * ```ts
 * import { $canvas } from '@bquery/bquery/canvas';
 * import { createScene, rectNode } from '@bquery/bquery/canvas';
 *
 * const canvas = $canvas('#stage').size(400, 300);
 * const scene = createScene(canvas);
 *
 * scene.add(rectNode({ x: 10, y: 10, width: 80, height: 80, fill: 'red' }));
 * scene.render();
 * ```
 */
export const createScene = (
  canvas: BQueryCanvas,
  options: CreateSceneOptions = {}
): Scene => {
  const nodes: SceneNode[] = [];
  const clearEachFrame = options.clearEachFrame !== false;
  let disposed = false;
  let renderHandle: { dispose(): void; invalidate(): void } | undefined;
  let pointerOff: (() => void) | undefined;
  let lastHover: SceneNode | undefined;

  const renderInternal = (): void => {
    if (disposed) return;
    if (clearEachFrame) canvas.clear();
    const sorted = sortByZIndex(nodes);
    for (const node of sorted) drawNode(canvas.ctx, node);
  };

  if (options.reactive !== false) {
    const stop = effect(() => {
      // Touch nodes array reactively if user wraps mutable lists in signals.
      // We do not auto-track props here: callers can call `scene.render()` to
      // re-render after mutating plain nodes.
      void nodes.length;
      renderInternal();
    });
    renderHandle = {
      dispose: () => stop(),
      invalidate: renderInternal,
    };
  }

  // Wire pointer events for `interactive` nodes.
  const onPointer = (event: CanvasPointerEvent): void => {
    if (disposed) return;
    const hit = findHit(nodes, { x: event.x, y: event.y });
    if (event.type === 'pointermove') {
      if (hit !== lastHover) {
        if (lastHover?.onPointerLeave) lastHover.onPointerLeave(event, lastHover);
        if (hit?.onPointerEnter) hit.onPointerEnter(event, hit);
        lastHover = hit;
      }
      if (hit?.onPointerMove) hit.onPointerMove(event, hit);
      return;
    }
    if (!hit) return;
    if (event.type === 'pointerdown' && hit.onPointerDown) hit.onPointerDown(event, hit);
    if (event.type === 'pointerup' && hit.onPointerUp) hit.onPointerUp(event, hit);
    if (event.type === 'click' && hit.onClick) hit.onClick(event, hit);
  };

  canvas.on('pointermove', onPointer);
  canvas.on('pointerdown', onPointer);
  canvas.on('pointerup', onPointer);
  canvas.on('click', onPointer);
  pointerOff = (): void => {
    canvas.off('pointermove', onPointer);
    canvas.off('pointerdown', onPointer);
    canvas.off('pointerup', onPointer);
    canvas.off('click', onPointer);
  };

  const scene: Scene = {
    add(node) {
      nodes.push(node);
      renderHandle?.invalidate();
      return node;
    },
    remove(target) {
      const idx = typeof target === 'string'
        ? nodes.findIndex(n => n.id === target)
        : nodes.indexOf(target);
      if (idx === -1) return false;
      nodes.splice(idx, 1);
      renderHandle?.invalidate();
      return true;
    },
    clear() {
      nodes.length = 0;
      renderHandle?.invalidate();
    },
    get nodes() {
      return nodes;
    },
    find(predicate) {
      if (typeof predicate === 'string') {
        const stack = [...flatten(nodes)];
        return stack.find(n => n.id === predicate);
      }
      return flatten(nodes).find(predicate);
    },
    hitTest(point) {
      return findHit(nodes, point);
    },
    render() {
      renderHandle?.invalidate();
      if (!renderHandle) renderInternal();
    },
    get disposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pointerOff?.();
      renderHandle?.dispose();
      nodes.length = 0;
    },
  };

  return scene;
};

/**
 * bQuery Canvas module — chainable wrapper, reactive render loop, scene
 * graph, and worker adapter for the HTML `<canvas>` element.
 *
 * The module is tree-shakeable, zero-runtime-dependency, and SSR-safe: all
 * DOM and OffscreenCanvas references are guarded at call time.
 *
 * @module bquery/canvas
 *
 * @example
 * ```ts
 * import { $canvas, createCanvas } from '@bquery/bquery/canvas';
 * import { signal } from '@bquery/bquery/reactive';
 *
 * const angle = signal(0);
 *
 * const canvas = $canvas('#stage').size(400, 300).autoResize('parent');
 *
 * canvas.render(ctx => {
 *   canvas.clear('white');
 *   canvas.save().translate(200, 150).rotate(angle.value);
 *   canvas.rect(-40, -40, 80, 80, { fill: 'tomato' });
 *   canvas.restore();
 * });
 *
 * canvas.frame(({ delta }) => {
 *   angle.value += delta * 0.001;
 * });
 * ```
 */

export { BQueryCanvas } from './bquery-canvas';
export { BQueryCanvasCollection } from './bquery-canvas-collection';
export { $canvas, $$canvas, createCanvas } from './selectors';
export { createPathBuilder } from './path-builder';
export { loadImage, peekImage, clearImageCache } from './image';
export {
  toBlob,
  toDataURL,
  pickPixel,
  measureText,
  clearMeasureCache,
  offscreen,
  imageDataSignal,
} from './util';
export {
  createScene,
  rectNode,
  circleNode,
  pathNode,
  textNode,
  imageNode,
  groupNode,
  layerNode,
} from './scene';
export { renderOnWorker } from './worker';

export type {
  AutoResizeTarget,
  BQueryCanvasLike,
  CanvasPaint,
  CanvasPointerEvent,
  CanvasViewport,
  CanvasRenderOptions,
  CircleNode,
  CreateCanvasOptions,
  CreateSceneOptions,
  DrawOptions,
  FrameFn,
  FrameHandle,
  FrameInfo,
  FrameOptions,
  GroupNode,
  ImageDrawOptions,
  ImageNode,
  LayerNode,
  LoadImageOptions,
  PathBuilder,
  PathNode,
  Point,
  RGBA,
  Rect,
  RectNode,
  RenderFn,
  RenderHandle,
  Scene,
  SceneNode,
  SceneNodeBase,
  SnapshotFormat,
  SnapshotOptions,
  StyleOptions,
  TextNode,
  TextOptions,
} from './types';
export type { RenderOnWorkerHandle, RenderOnWorkerOptions } from './worker';

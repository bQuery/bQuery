/**
 * Public type definitions for the bQuery canvas module.
 *
 * @module bquery/canvas
 */

/** A 2D point in canvas-local CSS pixel space. */
export interface Point {
  x: number;
  y: number;
}

/** An axis-aligned rectangle in canvas-local CSS pixel space. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** RGBA color tuple. Each channel is an integer 0-255. */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** A fill/stroke style accepted by the 2D context. */
export type CanvasPaint = string | CanvasGradient | CanvasPattern;

/** Options accepted by {@link createCanvas} and `BQueryCanvas` initialisation. */
export interface CreateCanvasOptions {
  /** CSS pixel width of the canvas (default: 300). */
  width?: number;
  /** CSS pixel height of the canvas (default: 150). */
  height?: number;
  /** Override the device pixel ratio used for the backing store. */
  dpr?: number;
  /** Optional className applied to the element. */
  className?: string;
  /** Optional aria-label for accessibility. */
  ariaLabel?: string;
  /** Optional document used to create the element (defaults to the global `document`). */
  ownerDocument?: Document;
}

/** Per-call drawing options used by primitive helpers. */
export interface DrawOptions {
  fill?: CanvasPaint | null;
  stroke?: CanvasPaint | null;
  lineWidth?: number;
  lineDash?: number[];
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  alpha?: number;
}

/** Per-call text rendering options. */
export interface TextOptions extends DrawOptions {
  font?: string;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;
  maxWidth?: number;
}

/** Per-call image drawing options. */
export interface ImageDrawOptions {
  width?: number;
  height?: number;
  sx?: number;
  sy?: number;
  sWidth?: number;
  sHeight?: number;
  alpha?: number;
}

/**
 * Batched style options applied via `BQueryCanvas#style()`.
 *
 * Every property is optional; only the supplied values are applied.
 */
export interface StyleOptions {
  fill?: CanvasPaint | null;
  stroke?: CanvasPaint | null;
  lineWidth?: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  lineDash?: number[];
  miterLimit?: number;
  font?: string;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;
  globalAlpha?: number;
  globalCompositeOperation?: GlobalCompositeOperation;
  shadowBlur?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

/** Render function passed to `BQueryCanvas#render()`. */
export type RenderFn = (ctx: CanvasRenderingContext2D, canvas: BQueryCanvasLike) => void;

/** Per-frame info passed to `BQueryCanvas#frame()` callbacks. */
export interface FrameInfo {
  /** Elapsed time since the loop started, in milliseconds. */
  elapsed: number;
  /** Time since the previous frame, in milliseconds. */
  delta: number;
  /** Smoothed frames per second estimate. */
  fps: number;
  /** Frame counter, starting at 0. */
  frame: number;
  /** High-resolution timestamp for this frame, in milliseconds. */
  timestamp: number;
}

/** Frame callback used by `BQueryCanvas#frame()`. */
export type FrameFn = (info: FrameInfo, ctx: CanvasRenderingContext2D, canvas: BQueryCanvasLike) => void;

/** Options accepted by `BQueryCanvas#render()`. */
export interface CanvasRenderOptions {
  /**
   * When true (default) the render function is wrapped in a reactive effect so
   * signal reads automatically trigger redraws. Set to false for purely
   * imperative use.
   */
  reactive?: boolean;
  /**
   * When true (default) the canvas is cleared before each render pass.
   */
  clearEachFrame?: boolean;
}

/** Options accepted by `BQueryCanvas#frame()`. */
export interface FrameOptions {
  /** When true the loop pauses while `prefersReducedMotion()` is `true`. Default true. */
  respectReducedMotion?: boolean;
  /** When true (default) the canvas is cleared at the start of every frame. */
  clearEachFrame?: boolean;
}

/** Handle returned from `BQueryCanvas#render()`. */
export interface RenderHandle {
  pause(): void;
  resume(): void;
  /** Force an immediate redraw. */
  invalidate(): void;
  /** Whether the handle is currently disposed. */
  readonly disposed: boolean;
  dispose(): void;
}

/** Handle returned from `BQueryCanvas#frame()`. */
export interface FrameHandle {
  pause(): void;
  resume(): void;
  /** Whether the loop is currently paused. */
  readonly paused: boolean;
  /** Whether the handle is currently disposed. */
  readonly disposed: boolean;
  dispose(): void;
}

/** Auto-resize target for `BQueryCanvas#autoResize()`. */
export type AutoResizeTarget = HTMLElement | 'parent' | 'window';

/** Viewport descriptor reported by `BQueryCanvas#viewport()`. */
export interface CanvasViewport {
  width: number;
  height: number;
  dpr: number;
}

/** Pointer event payload emitted by `BQueryCanvas#on()`. */
export interface CanvasPointerEvent {
  type: string;
  x: number;
  y: number;
  buttons: number;
  isOver: boolean;
  original: PointerEvent;
}

/** Snapshot output formats. */
export type SnapshotFormat = 'blob' | 'dataURL' | 'imageData';

/** Options accepted by `BQueryCanvas#snapshot()`. */
export interface SnapshotOptions {
  type?: string;
  quality?: number;
}

/** Options accepted by `loadImage()`. */
export interface LoadImageOptions {
  /** Abort the load via an `AbortSignal`. */
  signal?: AbortSignal;
  /** `crossOrigin` attribute applied before assigning `src`. */
  crossOrigin?: '' | 'anonymous' | 'use-credentials';
  /** `referrerPolicy` attribute applied before assigning `src`. */
  referrerPolicy?: ReferrerPolicy;
  /** When true (default) the resolved image is cached for re-use. */
  cache?: boolean;
  /**
   * Decode using `ImageBitmap` when available. Defaults to false so the result
   * remains a regular `HTMLImageElement` that integrates with the cache.
   */
  preferImageBitmap?: boolean;
}

/** Fluent path builder passed to `BQueryCanvas#path()`. */
export interface PathBuilder {
  moveTo(x: number, y: number): PathBuilder;
  lineTo(x: number, y: number): PathBuilder;
  rect(x: number, y: number, w: number, h: number): PathBuilder;
  arc(x: number, y: number, r: number, startAngle: number, endAngle: number, ccw?: boolean): PathBuilder;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    ccw?: boolean
  ): PathBuilder;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): PathBuilder;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): PathBuilder;
  closePath(): PathBuilder;
  /** Build a standalone `Path2D` for reuse. */
  toPath2D(): Path2D;
}

/**
 * Structural type used by callbacks to avoid importing the concrete
 * `BQueryCanvas` class (prevents circular type imports in user code).
 */
export interface BQueryCanvasLike {
  readonly el: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
}

// ── Scene graph types ──────────────────────────────────────────────────────

/** Common props supported by all scene nodes. */
export interface SceneNodeBase {
  readonly type: string;
  id?: string;
  zIndex?: number;
  opacity?: number;
  visible?: boolean;
  interactive?: boolean;
  cursor?: string;
  transform?: {
    translateX?: number;
    translateY?: number;
    rotate?: number;
    scaleX?: number;
    scaleY?: number;
  };
  onPointerDown?: (event: CanvasPointerEvent, node: SceneNode) => void;
  onPointerUp?: (event: CanvasPointerEvent, node: SceneNode) => void;
  onPointerMove?: (event: CanvasPointerEvent, node: SceneNode) => void;
  onPointerEnter?: (event: CanvasPointerEvent, node: SceneNode) => void;
  onPointerLeave?: (event: CanvasPointerEvent, node: SceneNode) => void;
  onClick?: (event: CanvasPointerEvent, node: SceneNode) => void;
}

export interface RectNode extends SceneNodeBase {
  readonly type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  fill?: CanvasPaint | null;
  stroke?: CanvasPaint | null;
  lineWidth?: number;
}

export interface CircleNode extends SceneNodeBase {
  readonly type: 'circle';
  x: number;
  y: number;
  radius: number;
  fill?: CanvasPaint | null;
  stroke?: CanvasPaint | null;
  lineWidth?: number;
}

export interface PathNode extends SceneNodeBase {
  readonly type: 'path';
  path: Path2D | ((p: PathBuilder) => void);
  fill?: CanvasPaint | null;
  stroke?: CanvasPaint | null;
  lineWidth?: number;
  bounds?: Rect;
}

export interface TextNode extends SceneNodeBase {
  readonly type: 'text';
  text: string;
  x: number;
  y: number;
  font?: string;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;
  fill?: CanvasPaint | null;
  stroke?: CanvasPaint | null;
  maxWidth?: number;
}

export interface ImageNode extends SceneNodeBase {
  readonly type: 'image';
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface GroupNode extends SceneNodeBase {
  readonly type: 'group';
  children: SceneNode[];
}

export interface LayerNode extends SceneNodeBase {
  readonly type: 'layer';
  children: SceneNode[];
  /** Optional layer cache key. */
  cacheKey?: string;
}

/** Union of all built-in scene node types. */
export type SceneNode = RectNode | CircleNode | PathNode | TextNode | ImageNode | GroupNode | LayerNode;

/** Options accepted by `createScene()`. */
export interface CreateSceneOptions {
  /** When true (default) signal reads inside node props rebuild the scene. */
  reactive?: boolean;
  /** When true the canvas is cleared at the start of every render pass. Default true. */
  clearEachFrame?: boolean;
  /**
   * Reserved for future dirty-rect optimization. Currently a no-op seam; the
   * scene always renders all visible nodes when set to false (the default).
   */
  dirtyRect?: boolean;
}

/** Public scene controller returned by `createScene()`. */
export interface Scene {
  add(node: SceneNode): SceneNode;
  remove(node: SceneNode | string): boolean;
  clear(): void;
  /** All top-level nodes in insertion order (z-index is applied at render time). */
  readonly nodes: readonly SceneNode[];
  find(predicate: string | ((node: SceneNode) => boolean)): SceneNode | undefined;
  hitTest(point: Point): SceneNode | undefined;
  /** Trigger a redraw of the scene. */
  render(): void;
  /** Whether the scene has been disposed. */
  readonly disposed: boolean;
  dispose(): void;
}

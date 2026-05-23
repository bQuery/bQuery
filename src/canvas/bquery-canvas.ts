/**
 * Chainable, jQuery-flavored wrapper around an `HTMLCanvasElement` and its
 * 2D rendering context.
 *
 * @module bquery/canvas
 */

import { effect } from '../reactive/index';
import { applyCanvasSize, resolveDpr } from './context';
import { loadImage, peekImage } from './image';
import {
  cancelFrame,
  getDocument,
  hasHTMLCanvasElement,
  hasResizeObserver,
  now,
  requestFrame,
} from './internal/env';
import { createPathBuilder } from './path-builder';
import { applyDrawOptions, applyStyleOptions } from './style';
import type {
  AutoResizeTarget,
  BQueryCanvasLike,
  CanvasPaint,
  CanvasPointerEvent,
  CanvasViewport,
  CanvasRenderOptions,
  DrawOptions,
  FrameFn,
  FrameHandle,
  FrameOptions,
  ImageDrawOptions,
  PathBuilder,
  Point,
  RenderFn,
  RenderHandle,
  Rect,
  SnapshotFormat,
  SnapshotOptions,
  StyleOptions,
  TextOptions,
} from './types';

const ensureCanvasElement = (el: unknown): HTMLCanvasElement => {
  if (!hasHTMLCanvasElement()) {
    throw new Error(
      'bQuery canvas: HTMLCanvasElement is not available in this environment.'
    );
  }
  if (!(el instanceof HTMLCanvasElement)) {
    throw new TypeError('bQuery canvas: expected an HTMLCanvasElement instance.');
  }
  return el;
};

const ensureContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(
      'bQuery canvas: failed to acquire a 2D rendering context. The canvas may be ' +
        'already locked by another context type, or the environment may not support 2D rendering.'
    );
  }
  return ctx;
};

/**
 * Wrapper for a single `<canvas>` element.
 *
 * Most mutating methods return `this` so calls can be chained jQuery-style.
 * For reactive use, register a `render()` callback that reads signals — the
 * canvas will redraw automatically whenever those signals change.
 *
 * @example
 * ```ts
 * import { $canvas } from '@bquery/bquery/canvas';
 * import { signal } from '@bquery/bquery/reactive';
 *
 * const count = signal(0);
 *
 * const canvas = $canvas('#stage').size(400, 300);
 *
 * canvas.render(ctx => {
 *   ctx.fillStyle = 'black';
 *   ctx.fillText(`count: ${count.value}`, 10, 30);
 * });
 *
 * count.value = 5; // canvas re-renders automatically
 * ```
 */
export class BQueryCanvas implements BQueryCanvasLike {
  /** Underlying canvas element (escape hatch). */
  readonly el: HTMLCanvasElement;

  /** Active 2D rendering context. */
  readonly ctx: CanvasRenderingContext2D;

  private _width: number;
  private _height: number;
  private _dpr: number;
  private _disposed = false;

  private resizeObserver?: ResizeObserver;
  private resizeListener?: () => void;
  private resizeTarget?: HTMLElement | Window;

  private readonly handles = new Set<{ dispose(): void }>();
  private readonly listeners = new Map<string, Set<(event: CanvasPointerEvent) => void>>();
  private readonly nativeListeners = new Map<string, EventListener>();

  constructor(canvas: HTMLCanvasElement, dprOverride?: number) {
    this.el = ensureCanvasElement(canvas);
    this.ctx = ensureContext(this.el);
    this._dpr = resolveDpr(dprOverride);

    // Use CSS pixel dimensions as the source of truth when the element was
    // pre-sized via attributes; default to the spec default 300x150.
    const initWidth = this.el.width > 0 ? Math.floor(this.el.width / this._dpr) : 300;
    const initHeight = this.el.height > 0 ? Math.floor(this.el.height / this._dpr) : 150;
    const applied = applyCanvasSize(this.el, this.ctx, initWidth, initHeight, this._dpr);
    this._width = applied.width;
    this._height = applied.height;
  }

  // ── sizing ───────────────────────────────────────────────────────────────

  /** Get the current CSS-pixel width. */
  get width(): number {
    return this._width;
  }

  /** Get the current CSS-pixel height. */
  get height(): number {
    return this._height;
  }

  /** Get the effective device pixel ratio. */
  get dpr(): number {
    return this._dpr;
  }

  /**
   * Set the CSS-pixel size, syncing the backing store to the active DPR.
   * Call without arguments to read the current `{ width, height }`.
   */
  size(): { width: number; height: number };
  size(width: number, height: number): this;
  size(width?: number, height?: number): this | { width: number; height: number } {
    if (width === undefined || height === undefined) {
      return { width: this._width, height: this._height };
    }
    const applied = applyCanvasSize(this.el, this.ctx, width, height, this._dpr);
    this._width = applied.width;
    this._height = applied.height;
    return this;
  }

  /**
   * Override or reset the effective device pixel ratio.
   * Pass `undefined` to fall back to `window.devicePixelRatio`.
   */
  setDpr(value: number | undefined): this {
    this._dpr = resolveDpr(value);
    const applied = applyCanvasSize(this.el, this.ctx, this._width, this._height, this._dpr);
    this._width = applied.width;
    this._height = applied.height;
    return this;
  }

  /**
   * Subscribe to size changes of a target element via `ResizeObserver`. The
   * canvas is resized to match the observed CSS-pixel size of the target.
   *
   * Pass `'parent'` to track the parent element, `'window'` to track the
   * viewport via window-resize events, or an explicit `HTMLElement`.
   */
  autoResize(target: AutoResizeTarget = 'parent'): this {
    if (this._disposed) return this;
    this.teardownResize();

    let resolved: HTMLElement | Window | undefined;
    if (target === 'window') {
      resolved = typeof window !== 'undefined' ? window : undefined;
    } else if (target === 'parent') {
      const parent = this.el.parentElement;
      resolved = parent ?? undefined;
    } else {
      resolved = target;
    }
    if (!resolved) return this;

    this.resizeTarget = resolved;

    if (resolved === window && typeof window !== 'undefined') {
      const handler = (): void => {
        if (this._disposed) return;
        this.size(window.innerWidth, window.innerHeight);
      };
      this.resizeListener = handler;
      window.addEventListener('resize', handler);
      handler();
      return this;
    }

    if (hasResizeObserver()) {
      try {
        const ro = new ResizeObserver(entries => {
          if (this._disposed) return;
          const entry = entries[entries.length - 1];
          if (!entry) return;
          const box = entry.contentRect;
          this.size(box.width, box.height);
        });
        ro.observe(resolved as HTMLElement);
        this.resizeObserver = ro;
        const initial = (resolved as HTMLElement).getBoundingClientRect();
        this.size(initial.width || this._width, initial.height || this._height);
      } catch {
        /* ignore — feature unavailable */
      }
    }

    return this;
  }

  /** Stop any active auto-resize subscription. */
  stopAutoResize(): this {
    this.teardownResize();
    return this;
  }

  /** Current viewport descriptor in CSS pixels. */
  viewport(): CanvasViewport {
    return { width: this._width, height: this._height, dpr: this._dpr };
  }

  // ── primitive drawing ────────────────────────────────────────────────────

  /** Clear the entire canvas. When `color` is provided, fill the cleared area. */
  clear(color?: CanvasPaint): this {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.el.width, this.el.height);
    if (color !== undefined && color !== null) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, this.el.width, this.el.height);
    }
    this.ctx.restore();
    return this;
  }

  /** Draw a filled or stroked rectangle. */
  rect(x: number, y: number, w: number, h: number, options?: DrawOptions): this {
    this.ctx.save();
    const intent = applyDrawOptions(this.ctx, options);
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    if (intent.fill || (!intent.stroke && !options)) this.ctx.fill();
    if (intent.stroke) this.ctx.stroke();
    this.ctx.restore();
    return this;
  }

  /** Draw a rounded rectangle. */
  roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    options?: DrawOptions
  ): this {
    this.ctx.save();
    const intent = applyDrawOptions(this.ctx, options);
    this.ctx.beginPath();
    if (typeof (this.ctx as CanvasRenderingContext2D & { roundRect?: typeof CanvasRenderingContext2D.prototype.roundRect }).roundRect === 'function') {
      (this.ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x, y, w, h, radius);
    } else {
      const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
      this.ctx.moveTo(x + r, y);
      this.ctx.arcTo(x + w, y, x + w, y + h, r);
      this.ctx.arcTo(x + w, y + h, x, y + h, r);
      this.ctx.arcTo(x, y + h, x, y, r);
      this.ctx.arcTo(x, y, x + w, y, r);
      this.ctx.closePath();
    }
    if (intent.fill || (!intent.stroke && !options)) this.ctx.fill();
    if (intent.stroke) this.ctx.stroke();
    this.ctx.restore();
    return this;
  }

  /** Draw a circle. */
  circle(x: number, y: number, r: number, options?: DrawOptions): this {
    this.ctx.save();
    const intent = applyDrawOptions(this.ctx, options);
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    if (intent.fill || (!intent.stroke && !options)) this.ctx.fill();
    if (intent.stroke) this.ctx.stroke();
    this.ctx.restore();
    return this;
  }

  /** Draw an ellipse. */
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation = 0,
    options?: DrawOptions
  ): this {
    this.ctx.save();
    const intent = applyDrawOptions(this.ctx, options);
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rotation, 0, Math.PI * 2);
    if (intent.fill || (!intent.stroke && !options)) this.ctx.fill();
    if (intent.stroke) this.ctx.stroke();
    this.ctx.restore();
    return this;
  }

  /** Draw a line segment. */
  line(x1: number, y1: number, x2: number, y2: number, options?: DrawOptions): this {
    this.ctx.save();
    const intent = applyDrawOptions(this.ctx, options);
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    if (intent.stroke || !options) this.ctx.stroke();
    if (intent.fill) this.ctx.fill();
    this.ctx.restore();
    return this;
  }

  /** Draw a closed polygon from the given vertex list. */
  polygon(points: ReadonlyArray<Point>, options?: DrawOptions): this {
    if (points.length === 0) return this;
    this.ctx.save();
    const intent = applyDrawOptions(this.ctx, options);
    this.ctx.beginPath();
    this.ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    this.ctx.closePath();
    if (intent.fill || (!intent.stroke && !options)) this.ctx.fill();
    if (intent.stroke) this.ctx.stroke();
    this.ctx.restore();
    return this;
  }

  /** Build and draw a custom path. */
  path(builder: (p: PathBuilder) => void, options?: DrawOptions): this {
    const p = createPathBuilder();
    builder(p);
    const path = p.toPath2D();
    this.ctx.save();
    const intent = applyDrawOptions(this.ctx, options);
    if (intent.fill || (!intent.stroke && !options)) this.ctx.fill(path);
    if (intent.stroke) this.ctx.stroke(path);
    this.ctx.restore();
    return this;
  }

  /**
   * Render plain text at `(x, y)`. The `content` is treated as plain text;
   * HTML is never interpolated.
   */
  text(content: string | number, x: number, y: number, options?: TextOptions): this {
    const value = typeof content === 'number' ? String(content) : String(content);
    this.ctx.save();
    if (options?.font !== undefined) this.ctx.font = options.font;
    if (options?.textAlign !== undefined) this.ctx.textAlign = options.textAlign;
    if (options?.textBaseline !== undefined) this.ctx.textBaseline = options.textBaseline;
    const intent = applyDrawOptions(this.ctx, options);
    if (intent.fill || (!intent.stroke && !options)) {
      this.ctx.fillText(value, x, y, options?.maxWidth);
    }
    if (intent.stroke) {
      this.ctx.strokeText(value, x, y, options?.maxWidth);
    }
    this.ctx.restore();
    return this;
  }

  /**
   * Draw an image. String sources go through the internal cache; if the image
   * is not yet resolved the draw is skipped and `invalidate()` is scheduled
   * once the image loads (when used inside a `render()` callback).
   */
  image(
    source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | string,
    x: number,
    y: number,
    options?: ImageDrawOptions
  ): this {
    if (typeof source === 'string') {
      const cached = peekImage(source);
      if (cached) {
        this.drawImageInternal(cached, x, y, options);
      } else {
        loadImage(source).then(
          () => this.invalidate(),
          () => {
            /* swallow — drawing simply skipped */
          }
        );
      }
      return this;
    }
    this.drawImageInternal(source, x, y, options);
    return this;
  }

  private drawImageInternal(
    img: CanvasImageSource,
    x: number,
    y: number,
    options?: ImageDrawOptions
  ): void {
    this.ctx.save();
    if (options?.alpha !== undefined) this.ctx.globalAlpha = options.alpha;
    if (
      options?.sWidth !== undefined &&
      options.sHeight !== undefined &&
      options.sx !== undefined &&
      options.sy !== undefined
    ) {
      this.ctx.drawImage(
        img,
        options.sx,
        options.sy,
        options.sWidth,
        options.sHeight,
        x,
        y,
        options.width ?? options.sWidth,
        options.height ?? options.sHeight
      );
    } else if (options?.width !== undefined && options?.height !== undefined) {
      this.ctx.drawImage(img, x, y, options.width, options.height);
    } else {
      this.ctx.drawImage(img, x, y);
    }
    this.ctx.restore();
  }

  // ── paints ───────────────────────────────────────────────────────────────

  /** Gradient factory namespace. */
  readonly gradient = {
    linear: (x0: number, y0: number, x1: number, y1: number): CanvasGradient =>
      this.ctx.createLinearGradient(x0, y0, x1, y1),
    radial: (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient =>
      this.ctx.createRadialGradient(x0, y0, r0, x1, y1, r1),
    conic: (startAngle: number, x: number, y: number): CanvasGradient => {
      const factory = (this.ctx as CanvasRenderingContext2D & {
        createConicGradient?: (startAngle: number, x: number, y: number) => CanvasGradient;
      }).createConicGradient;
      if (typeof factory !== 'function') {
        throw new Error('bQuery canvas: conic gradients are not supported in this environment.');
      }
      return factory.call(this.ctx, startAngle, x, y);
    },
  };

  /** Create a fill pattern from a source. */
  pattern(
    source: CanvasImageSource,
    repetition: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat' = 'repeat'
  ): CanvasPattern | null {
    return this.ctx.createPattern(source, repetition);
  }

  // ── state ────────────────────────────────────────────────────────────────

  save(): this {
    this.ctx.save();
    return this;
  }

  restore(): this {
    this.ctx.restore();
    return this;
  }

  translate(x: number, y: number): this {
    this.ctx.translate(x, y);
    return this;
  }

  rotate(angle: number): this {
    this.ctx.rotate(angle);
    return this;
  }

  scale(sx: number, sy: number = sx): this {
    this.ctx.scale(sx, sy);
    return this;
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): this {
    this.ctx.setTransform(a, b, c, d, e, f);
    return this;
  }

  resetTransform(): this {
    if (typeof this.ctx.resetTransform === 'function') {
      this.ctx.resetTransform();
      // Re-apply DPR scaling so subsequent draws stay in CSS pixels.
      this.ctx.scale(this._dpr, this._dpr);
    } else {
      this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    }
    return this;
  }

  /** Batch-apply a style options object. */
  style(options: StyleOptions): this {
    applyStyleOptions(this.ctx, options);
    return this;
  }

  /** Apply a clip region from a path builder. */
  clip(builder?: (p: PathBuilder) => void): this {
    if (!builder) {
      this.ctx.clip();
      return this;
    }
    const p = createPathBuilder();
    builder(p);
    this.ctx.clip(p.toPath2D());
    return this;
  }

  /** Reset the active clipping region by restoring the saved state. */
  clearClip(): this {
    this.ctx.restore();
    this.ctx.save();
    this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    return this;
  }

  // ── lifecycle ───────────────────────────────────────────────────────────

  /**
   * Register a signal-driven render function. The callback runs immediately
   * and re-runs whenever any signal it reads changes. Use `.peek()` for
   * non-reactive reads.
   */
  render(fn: RenderFn, options?: CanvasRenderOptions): RenderHandle {
    if (this._disposed) throw new Error('bQuery canvas: cannot render on a disposed canvas.');
    const reactive = options?.reactive !== false;
    const clearEachFrame = options?.clearEachFrame !== false;

    let paused = false;
    let pendingInvalidate = false;
    let disposed = false;
    let stopEffect: (() => void) | undefined;

    const runOnce = (): void => {
      if (disposed || paused || this._disposed) return;
      if (clearEachFrame) this.clear();
      fn(this.ctx, this);
    };

    if (reactive) {
      const stop = effect(() => {
        if (disposed) return;
        if (paused) {
          pendingInvalidate = true;
          return;
        }
        if (clearEachFrame) this.clear();
        fn(this.ctx, this);
      });
      stopEffect = stop;
    } else {
      runOnce();
    }

    const handle: RenderHandle = {
      pause: () => {
        paused = true;
      },
      resume: () => {
        if (!paused) return;
        paused = false;
        if (pendingInvalidate) {
          pendingInvalidate = false;
          runOnce();
        }
      },
      invalidate: runOnce,
      get disposed() {
        return disposed;
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        stopEffect?.();
        this.handles.delete(handle);
      },
    };

    this.handles.add(handle);
    return handle;
  }

  /** Manually trigger any active reactive render handles. */
  invalidate(): this {
    for (const handle of this.handles) {
      const h = handle as Partial<RenderHandle>;
      if (typeof h.invalidate === 'function' && !h.disposed) {
        h.invalidate();
      }
    }
    return this;
  }

  /**
   * Register a RAF loop. Signal reads inside `fn` are **not** tracked — use
   * this for purely imperative per-frame work. Respects
   * `prefersReducedMotion()` unless explicitly disabled.
   */
  frame(fn: FrameFn, options?: FrameOptions): FrameHandle {
    if (this._disposed) throw new Error('bQuery canvas: cannot start a frame loop on a disposed canvas.');

    const respectReducedMotion = options?.respectReducedMotion !== false;
    const clearEachFrame = options?.clearEachFrame !== false;

    let rafHandle: number | undefined;
    let lastTime = now();
    const startTime = lastTime;
    let frameCount = 0;
    let fps = 0;
    let paused = false;
    let disposed = false;

    const tick = (timestamp: number): void => {
      if (disposed) return;
      const delta = timestamp - lastTime;
      lastTime = timestamp;
      // Exponential moving average for fps stability.
      const sampleFps = delta > 0 ? 1000 / delta : fps || 0;
      fps = fps === 0 ? sampleFps : fps * 0.9 + sampleFps * 0.1;

      if (respectReducedMotion && lazyPrefersReducedMotion()) {
        rafHandle = requestFrame(tick);
        return;
      }

      if (!paused) {
        if (clearEachFrame) this.clear();
        fn(
          {
            elapsed: timestamp - startTime,
            delta,
            fps,
            frame: frameCount,
            timestamp,
          },
          this.ctx,
          this
        );
        frameCount += 1;
      }
      rafHandle = requestFrame(tick);
    };

    rafHandle = requestFrame(tick);

    const handle: FrameHandle = {
      pause: () => {
        paused = true;
      },
      resume: () => {
        paused = false;
      },
      get paused() {
        return paused;
      },
      get disposed() {
        return disposed;
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        if (rafHandle !== undefined) cancelFrame(rafHandle);
        rafHandle = undefined;
        this.handles.delete(handle);
      },
    };

    this.handles.add(handle);
    return handle;
  }

  // ── snapshot / IO ────────────────────────────────────────────────────────

  /** Return the canvas content as the requested format. */
  async snapshot(format: 'blob', options?: SnapshotOptions): Promise<Blob>;
  async snapshot(format: 'dataURL', options?: SnapshotOptions): Promise<string>;
  async snapshot(format: 'imageData', options?: SnapshotOptions): Promise<ImageData>;
  async snapshot(format?: SnapshotFormat, options?: SnapshotOptions): Promise<Blob | string | ImageData> {
    const fmt = format ?? 'blob';
    try {
      if (fmt === 'dataURL') {
        return this.el.toDataURL(options?.type, options?.quality);
      }
      if (fmt === 'imageData') {
        return this.ctx.getImageData(0, 0, this.el.width, this.el.height);
      }
      return await new Promise<Blob>((resolve, reject) => {
        this.el.toBlob(
          blob => {
            if (blob) resolve(blob);
            else reject(new Error('bQuery canvas: toBlob returned null.'));
          },
          options?.type,
          options?.quality
        );
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'SecurityError') {
        throw new Error(
          'bQuery canvas: snapshot failed because the canvas is tainted by cross-origin content. ' +
            'Use `loadImage(url, { crossOrigin: "anonymous" })` for images you intend to read back.'
        );
      }
      throw err;
    }
  }

  /** Append the canvas element to a parent. */
  appendTo(parent: Element | string): this {
    const target = typeof parent === 'string' ? getDocument().querySelector(parent) : parent;
    if (!target) {
      throw new Error(`bQuery canvas: appendTo target not found ("${String(parent)}").`);
    }
    target.appendChild(this.el);
    return this;
  }

  // ── events ───────────────────────────────────────────────────────────────

  /**
   * Subscribe to pointer-like events on the canvas. The supplied handler
   * receives a normalized {@link CanvasPointerEvent} with coordinates already
   * translated into canvas-local CSS pixels.
   */
  on(type: string, handler: (event: CanvasPointerEvent) => void): this {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);

      const native: EventListener = (event: Event) => {
        const pointer = this.normalizePointer(event as PointerEvent | MouseEvent, type);
        for (const fn of set!) fn(pointer);
      };
      this.nativeListeners.set(type, native);
      this.el.addEventListener(type, native);
    }
    set.add(handler);
    return this;
  }

  /** Remove a previously-registered pointer handler. */
  off(type: string, handler?: (event: CanvasPointerEvent) => void): this {
    const set = this.listeners.get(type);
    if (!set) return this;
    if (handler) set.delete(handler);
    else set.clear();
    if (set.size === 0) {
      const native = this.nativeListeners.get(type);
      if (native) this.el.removeEventListener(type, native);
      this.listeners.delete(type);
      this.nativeListeners.delete(type);
    }
    return this;
  }

  /** Subscribe to a single occurrence of an event. */
  once(type: string, handler: (event: CanvasPointerEvent) => void): this {
    const wrapped = (event: CanvasPointerEvent): void => {
      this.off(type, wrapped);
      handler(event);
    };
    return this.on(type, wrapped);
  }

  /** Hit-test a point against a Path2D. */
  hitTest(point: Point, path: Path2D, mode: 'fill' | 'stroke' = 'fill'): boolean {
    if (typeof Path2D === 'undefined') return false;
    const cssX = point.x * this._dpr;
    const cssY = point.y * this._dpr;
    if (mode === 'stroke') {
      return this.ctx.isPointInStroke(path, cssX, cssY);
    }
    return this.ctx.isPointInPath(path, cssX, cssY);
  }

  /** Compute the bounding-box hit test for an axis-aligned rect. */
  hitTestRect(point: Point, rect: Rect): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  private normalizePointer(event: PointerEvent | MouseEvent, type: string): CanvasPointerEvent {
    const rect = this.el.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this._width / rect.width : 1;
    const scaleY = rect.height > 0 ? this._height / rect.height : 1;
    const clientX = (event as MouseEvent).clientX ?? 0;
    const clientY = (event as MouseEvent).clientY ?? 0;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const buttons = (event as MouseEvent).buttons ?? 0;
    const isOver =
      x >= 0 && y >= 0 && x <= this._width && y <= this._height && type !== 'pointerleave' && type !== 'pointerout';
    return {
      type,
      x,
      y,
      buttons,
      isOver,
      original: event as PointerEvent,
    };
  }

  // ── disposal ────────────────────────────────────────────────────────────

  /** Release all observers, listeners, and reactive handles owned by this wrapper. */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.teardownResize();

    for (const handle of [...this.handles]) {
      try {
        handle.dispose();
      } catch {
        /* ignore */
      }
    }
    this.handles.clear();

    for (const [type, native] of this.nativeListeners) {
      try {
        this.el.removeEventListener(type, native);
      } catch {
        /* ignore */
      }
    }
    this.nativeListeners.clear();
    this.listeners.clear();
  }

  /** Whether the wrapper has been disposed. */
  get disposed(): boolean {
    return this._disposed;
  }

  private teardownResize(): void {
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch {
        /* ignore */
      }
      this.resizeObserver = undefined;
    }
    if (this.resizeListener && this.resizeTarget && this.resizeTarget === window) {
      window.removeEventListener('resize', this.resizeListener);
    }
    this.resizeListener = undefined;
    this.resizeTarget = undefined;
  }
}

// Lazy require to avoid pulling motion side-effects at module load time.
let prefersReducedMotionImpl: (() => boolean) | undefined;
const lazyPrefersReducedMotion = (): boolean => {
  if (prefersReducedMotionImpl) return prefersReducedMotionImpl();
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Inject a custom reduced-motion implementation. Used by `motion` integration
 * tests; downstream apps generally do not need this.
 *
 * @internal
 */
export const __setPrefersReducedMotionImpl = (
  impl: (() => boolean) | undefined
): void => {
  prefersReducedMotionImpl = impl;
};

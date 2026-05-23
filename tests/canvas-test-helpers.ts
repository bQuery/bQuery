/**
 * Test helpers for canvas suites. Installs a recording mock 2D context onto
 * `HTMLCanvasElement.prototype.getContext` since happy-dom does not implement
 * the 2D rendering context.
 *
 * Pixel-level assertions are NOT supported; tests use this mock to verify
 * call sequences, arguments, and lifecycle behavior.
 */

export interface MockContextCall {
  method: string;
  args: unknown[];
}

export interface MockContextState {
  calls: MockContextCall[];
  // Live snapshot of mutable context properties.
  state: Record<string, unknown>;
  // Returned by getImageData.
  imageData: ImageData;
  // Returned by isPointInPath/Stroke.
  pointHit: boolean;
}

export interface MockCanvasContext extends Partial<CanvasRenderingContext2D> {
  __state: MockContextState;
}

const RECORD_METHODS: ReadonlyArray<keyof CanvasRenderingContext2D> = [
  'save',
  'restore',
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'rect',
  'roundRect' as keyof CanvasRenderingContext2D,
  'arc',
  'arcTo',
  'ellipse',
  'quadraticCurveTo',
  'bezierCurveTo',
  'fill',
  'stroke',
  'fillRect',
  'strokeRect',
  'clearRect',
  'fillText',
  'strokeText',
  'translate',
  'rotate',
  'scale',
  'transform',
  'setTransform',
  'resetTransform',
  'setLineDash',
  'getLineDash',
  'clip',
  'drawImage',
];

const PROPERTY_NAMES: ReadonlyArray<string> = [
  'fillStyle',
  'strokeStyle',
  'lineWidth',
  'lineCap',
  'lineJoin',
  'miterLimit',
  'font',
  'textAlign',
  'textBaseline',
  'globalAlpha',
  'globalCompositeOperation',
  'shadowBlur',
  'shadowColor',
  'shadowOffsetX',
  'shadowOffsetY',
];

export const createMockContext = (): MockCanvasContext => {
  const state: MockContextState = {
    calls: [],
    state: {},
    imageData: {
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
      colorSpace: 'srgb' as PredefinedColorSpace,
    } as ImageData,
    pointHit: false,
  };

  const ctx = { __state: state } as MockCanvasContext & Record<string, unknown>;

  for (const method of RECORD_METHODS) {
    (ctx as Record<string, unknown>)[method as string] = (...args: unknown[]): unknown => {
      state.calls.push({ method: method as string, args });
      return undefined;
    };
  }

  ctx.measureText = (text: string): TextMetrics =>
    ({
      width: text.length * 8,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 8,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 2,
    }) as TextMetrics;

  ctx.getImageData = ((): ImageData => state.imageData) as CanvasRenderingContext2D['getImageData'];
  ctx.putImageData = ((): void => {}) as CanvasRenderingContext2D['putImageData'];
  ctx.createImageData = ((w: number, h: number): ImageData =>
    ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
      colorSpace: 'srgb' as PredefinedColorSpace,
    }) as ImageData) as CanvasRenderingContext2D['createImageData'];

  ctx.isPointInPath = ((): boolean => state.pointHit) as CanvasRenderingContext2D['isPointInPath'];
  ctx.isPointInStroke = ((): boolean => state.pointHit) as CanvasRenderingContext2D['isPointInStroke'];

  ctx.createLinearGradient = ((): CanvasGradient =>
    ({ addColorStop: () => {} }) as CanvasGradient) as CanvasRenderingContext2D['createLinearGradient'];
  ctx.createRadialGradient = ((): CanvasGradient =>
    ({ addColorStop: () => {} }) as CanvasGradient) as CanvasRenderingContext2D['createRadialGradient'];
  ctx.createPattern = ((): CanvasPattern | null => ({}) as CanvasPattern) as CanvasRenderingContext2D['createPattern'];

  for (const prop of PROPERTY_NAMES) {
    Object.defineProperty(ctx, prop, {
      get: (): unknown => state.state[prop],
      set: (value: unknown): void => {
        state.state[prop] = value;
        state.calls.push({ method: `set:${prop}`, args: [value] });
      },
      configurable: true,
      enumerable: true,
    });
  }

  return ctx;
};

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext | undefined;
const mockMap = new WeakMap<HTMLCanvasElement, MockCanvasContext>();

export const installCanvasMock = (): void => {
  if (originalGetContext !== undefined) return;
  originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string
  ): RenderingContext | null {
    if (type !== '2d') return null;
    let mock = mockMap.get(this);
    if (!mock) {
      mock = createMockContext();
      mockMap.set(this, mock);
    }
    return mock as unknown as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext;

  // toBlob defaults: invoke callback asynchronously with a tiny blob.
  if (!HTMLCanvasElement.prototype.toBlob || HTMLCanvasElement.prototype.toBlob.length === 0) {
    HTMLCanvasElement.prototype.toBlob = function (
      cb: BlobCallback
    ): void {
      const blob = new Blob(['0'], { type: 'image/png' });
      Promise.resolve().then(() => cb(blob));
    };
  }

  // toDataURL fallback used by SnapshotOptions tests.
  HTMLCanvasElement.prototype.toDataURL = function (): string {
    return 'data:image/png;base64,AAA=';
  };
};

export const uninstallCanvasMock = (): void => {
  if (originalGetContext) {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    originalGetContext = undefined;
  }
};

export const getMockContext = (canvas: HTMLCanvasElement): MockCanvasContext | undefined =>
  mockMap.get(canvas);

export const calls = (canvas: HTMLCanvasElement): MockContextCall[] =>
  mockMap.get(canvas)?.__state.calls ?? [];

export const methodNames = (canvas: HTMLCanvasElement): string[] =>
  calls(canvas).map(c => c.method);

/**
 * Thin adapter for offloading canvas rendering to a Web Worker via
 * `OffscreenCanvas`.
 *
 * This is intentionally minimal in v1: it transfers control of the canvas to
 * the supplied worker and forwards an `init` message. The worker is
 * responsible for the actual draw logic. A richer worker runtime may land in
 * the `concurrency` module in a future release.
 *
 * @module bquery/canvas
 */

import type { BQueryCanvas } from '../bquery-canvas';

export interface RenderOnWorkerOptions {
  /** Optional payload merged into the `init` message sent to the worker. */
  initMessage?: Record<string, unknown>;
  /** Transferable list applied alongside the `OffscreenCanvas`. */
  transfer?: Transferable[];
}

export interface RenderOnWorkerHandle {
  /** Post an arbitrary message to the worker. */
  post(message: unknown, transfer?: Transferable[]): void;
  /** Terminate the worker and release ownership. */
  dispose(): void;
}

/**
 * Transfer rendering control of `canvas` to `worker` via `OffscreenCanvas`.
 *
 * The worker should listen for the `init` message and use the supplied
 * `canvas` transferable as its rendering surface. After this call the main
 * thread can no longer draw on the canvas directly.
 *
 * Throws when `OffscreenCanvas` or `transferControlToOffscreen` is not
 * available in the current runtime.
 *
 * @example
 * ```ts
 * const handle = renderOnWorker(canvas, worker, { initMessage: { dpr: window.devicePixelRatio } });
 * handle.post({ type: 'resize', width: 800, height: 600 });
 * ```
 */
export const renderOnWorker = (
  canvas: BQueryCanvas,
  worker: Worker,
  options: RenderOnWorkerOptions = {}
): RenderOnWorkerHandle => {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error(
      'bQuery canvas: renderOnWorker requires OffscreenCanvas support in this environment.'
    );
  }

  const transferable = (
    canvas.el as HTMLCanvasElement & {
      transferControlToOffscreen?: () => OffscreenCanvas;
    }
  ).transferControlToOffscreen;

  if (typeof transferable !== 'function') {
    throw new Error(
      'bQuery canvas: renderOnWorker requires HTMLCanvasElement.transferControlToOffscreen.'
    );
  }

  const offscreen = transferable.call(canvas.el);
  const initPayload = {
    type: 'init',
    canvas: offscreen,
    width: canvas.width,
    height: canvas.height,
    dpr: canvas.dpr,
    ...(options.initMessage ?? {}),
  };

  worker.postMessage(initPayload, [offscreen, ...(options.transfer ?? [])]);

  let disposed = false;
  return {
    post(message, transfer) {
      if (disposed) return;
      worker.postMessage(message, transfer ?? []);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        worker.terminate();
      } catch {
        /* ignore */
      }
    },
  };
};

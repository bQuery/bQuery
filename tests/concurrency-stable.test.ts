import { describe, expect, it } from 'bun:test';

import {
  callWorkerMethod,
  createRpcPool,
  createRpcWorker,
  createTaskPool,
  createTaskWorker,
  deferred,
  defineRpcWorker,
  defineWorker,
  exposeRpc,
  exposeTask,
  getConcurrencySupport,
  isConcurrencySupported,
  isModuleWorkerSupported,
  isWorkerModule,
  runTask,
  startTransition,
  suspense,
  TaskWorkerSerializationError,
  type WorkerHostScope,
} from '../src/concurrency/index';
import { effect, signal } from '../src/reactive/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type ModuleSetup = (scope: WorkerHostScope) => void;

/**
 * Installs a `Worker` that loads pre-registered module scripts by URL — the
 * CSP-safe path. Crucially it does NOT provide `Blob` or `URL.createObjectURL`,
 * proving module workers run without eval/blob.
 */
const withModuleWorkerEnvironment = async (
  callback: (ctx: {
    registerModule: (url: string | URL, setup: ModuleSetup) => void;
  }) => Promise<void> | void
): Promise<void> => {
  const originalWorker = globalThis.Worker;
  const registry = new Map<string, ModuleSetup>();

  class ModuleMockWorker {
    onerror: ((event: { message: string }) => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    private readonly scope: WorkerHostScope;
    private terminated = false;

    constructor(url: string | URL) {
      const key = String(url);
      const setup = registry.get(key);
      if (!setup) {
        throw new Error(`Unknown module worker URL: ${key}`);
      }

      this.scope = {
        onmessage: null,
        postMessage: (data: unknown) => {
          if (this.terminated) {
            return;
          }

          queueMicrotask(() => {
            this.onmessage?.({ data });
          });
        },
      };

      setup(this.scope);
    }

    postMessage(data: unknown): void {
      if (this.terminated) {
        return;
      }

      queueMicrotask(() => {
        try {
          this.scope.onmessage?.({ data });
        } catch (error) {
          this.onerror?.({ message: error instanceof Error ? error.message : String(error) });
        }
      });
    }

    terminate(): void {
      this.terminated = true;
    }
  }

  (globalThis as { Worker: typeof Worker }).Worker = ModuleMockWorker as unknown as typeof Worker;

  try {
    await callback({
      registerModule: (url, setup) => registry.set(String(url), setup),
    });
  } finally {
    (globalThis as { Worker: typeof Worker }).Worker = originalWorker;
  }
};

/** A scope double for unit-testing `exposeTask` / `exposeRpc` directly. */
const createHostScope = (): WorkerHostScope & { sent: unknown[] } => {
  const sent: unknown[] = [];
  return {
    onmessage: null,
    postMessage(message: unknown): void {
      sent.push(message);
    },
    sent,
  };
};

// ===========================================================================
// #134 — CSP-safe module workers
// ===========================================================================

describe('concurrency/defineWorker (#134)', () => {
  it('produces a branded, frozen module descriptor with a module default type', () => {
    const mod = defineWorker<number, number>('https://example.test/x.worker.js');
    expect(mod.type).toBe('module');
    expect(String(mod.url)).toBe('https://example.test/x.worker.js');
    expect(isWorkerModule(mod)).toBe(true);
    expect(Object.isFrozen(mod)).toBe(true);
  });

  it('accepts a URL instance and an explicit classic type', () => {
    const url = new URL('https://example.test/x.worker.js');
    const mod = defineWorker(url, { type: 'classic' });
    expect(mod.type).toBe('classic');
    expect(isWorkerModule(defineRpcWorker(url))).toBe(true);
  });

  it('rejects empty URLs and unknown worker types', () => {
    expect(() => defineWorker('')).toThrow(TaskWorkerSerializationError);
    expect(() => defineWorker('x', { type: 'iife' as unknown as 'module' })).toThrow(RangeError);
  });

  it('does not treat plain functions or objects as worker modules', () => {
    expect(isWorkerModule((value: number) => value)).toBe(false);
    expect(isWorkerModule({ url: 'x', type: 'module' })).toBe(false);
    expect(isWorkerModule(null)).toBe(false);
  });

  it('reports module-worker support independently of blob/eval support', async () => {
    await withModuleWorkerEnvironment(() => {
      const originalBlob = globalThis.Blob;
      const originalCreateObjectURL = URL.createObjectURL;
      try {
        (globalThis as { Blob?: typeof Blob }).Blob = undefined;
        URL.createObjectURL = undefined as unknown as typeof URL.createObjectURL;

        const support = getConcurrencySupport();
        expect(support.moduleWorker).toBe(true);
        expect(support.supported).toBe(false);
        expect(isModuleWorkerSupported()).toBe(true);
        expect(isConcurrencySupported()).toBe(false);
      } finally {
        (globalThis as { Blob?: typeof Blob }).Blob = originalBlob;
        URL.createObjectURL = originalCreateObjectURL;
      }
    });
  });
});

describe('concurrency/module task execution (#134)', () => {
  it('runs a one-off module task with no blob/eval available', async () => {
    await withModuleWorkerEnvironment(async ({ registerModule }) => {
      const originalBlob = globalThis.Blob;
      const originalCreateObjectURL = URL.createObjectURL;
      try {
        (globalThis as { Blob?: typeof Blob }).Blob = undefined;
        URL.createObjectURL = undefined as unknown as typeof URL.createObjectURL;

        const url = 'https://example.test/square.worker.js';
        registerModule(url, (scope) => exposeTask((value: number) => value * value, scope));

        const result = await runTask(defineWorker<number, number>(url), 9);
        expect(result).toBe(81);
      } finally {
        (globalThis as { Blob?: typeof Blob }).Blob = originalBlob;
        URL.createObjectURL = originalCreateObjectURL;
      }
    });
  });

  it('reuses a module task worker across runs and terminates cleanly', async () => {
    await withModuleWorkerEnvironment(async ({ registerModule }) => {
      const url = 'https://example.test/double.worker.js';
      registerModule(url, (scope) => exposeTask((value: number) => value * 2, scope));

      const worker = createTaskWorker(defineWorker<number, number>(url), { name: 'double' });
      expect(await worker.run(21)).toBe(42);
      expect(await worker.run(5)).toBe(10);
      worker.terminate();
      expect(worker.state).toBe('terminated');
    });
  });

  it('spreads work across a module-backed task pool', async () => {
    await withModuleWorkerEnvironment(async ({ registerModule }) => {
      const url = 'https://example.test/inc.worker.js';
      registerModule(url, (scope) => exposeTask((value: number) => value + 1, scope));

      const pool = createTaskPool(defineWorker<number, number>(url), { concurrency: 2 });
      const results = await Promise.all([pool.run(1), pool.run(2), pool.run(3)]);
      expect(results).toEqual([2, 3, 4]);
      pool.terminate();
    });
  });

  it('surfaces module worker errors with the structured worker error shape', async () => {
    await withModuleWorkerEnvironment(async ({ registerModule }) => {
      const url = 'https://example.test/throws.worker.js';
      registerModule(url, (scope) =>
        exposeTask(() => {
          throw new Error('boom');
        }, scope)
      );

      await expect(runTask(defineWorker(url), undefined)).rejects.toMatchObject({
        code: 'WORKER',
        message: 'boom',
      });
    });
  });
});

describe('concurrency/module RPC execution (#134)', () => {
  it('dispatches named methods through a module RPC worker', async () => {
    await withModuleWorkerEnvironment(async ({ registerModule }) => {
      const url = 'https://example.test/calc.worker.js';
      registerModule(url, (scope) =>
        exposeRpc(
          {
            sum: ({ values }: { values: number[] }) => values.reduce((a, b) => a + b, 0),
            double: (value: number) => value * 2,
          },
          scope
        )
      );

      type Routes = {
        sum(input: { values: number[] }): number;
        double(input: number): number;
      };
      const rpc = createRpcWorker(defineRpcWorker<Routes>(url));
      expect(await rpc.call('sum', { values: [1, 2, 3] })).toBe(6);
      expect(await rpc.call('double', 4)).toBe(8);
      rpc.terminate();
    });
  });

  it('rejects unknown methods with METHOD_NOT_FOUND through module workers', async () => {
    await withModuleWorkerEnvironment(async ({ registerModule }) => {
      const url = 'https://example.test/one.worker.js';
      registerModule(url, (scope) => exposeRpc({ ping: () => 'pong' }, scope));

      const total = await callWorkerMethod(
        defineRpcWorker<{ ping(): string }>(url),
        'ping',
        undefined
      );
      expect(total).toBe('pong');

      const pool = createRpcPool(defineRpcWorker<{ ping(): string }>(url));
      await expect(
        (pool as unknown as { call(method: string, input: unknown): Promise<unknown> }).call(
          'missing',
          undefined
        )
      ).rejects.toMatchObject({ code: 'METHOD_NOT_FOUND' });
      pool.terminate();
    });
  });
});

describe('concurrency/exposeTask + exposeRpc protocol (#134)', () => {
  it('answers a run message with the structured result envelope', async () => {
    const scope = createHostScope();
    exposeTask((value: number) => value + 1, scope);
    scope.onmessage?.({ data: { id: 7, payload: 41, type: 'bq:run' } });
    await flush();
    expect(scope.sent).toEqual([{ id: 7, result: 42, type: 'bq:result' }]);
  });

  it('ignores foreign messages and serializes thrown errors', async () => {
    const scope = createHostScope();
    exposeTask(() => {
      throw Object.assign(new Error('nope'), { code: 'CUSTOM' });
    }, scope);

    scope.onmessage?.({ data: { id: 1, type: 'other' } });
    await flush();
    expect(scope.sent).toHaveLength(0);

    scope.onmessage?.({ data: { id: 2, payload: undefined, type: 'bq:run' } });
    await flush();
    expect(scope.sent).toEqual([
      {
        error: { code: 'CUSTOM', message: 'nope', name: 'Error', stack: expect.any(String) },
        id: 2,
        type: 'bq:error',
      },
    ]);
  });

  it('rejects unknown RPC methods at the host without invoking a handler', async () => {
    const scope = createHostScope();
    exposeRpc({ known: () => 1 }, scope);
    scope.onmessage?.({ data: { id: 3, method: 'unknown', type: 'bq:rpc' } });
    await flush();
    expect(scope.sent).toEqual([
      {
        error: {
          code: 'METHOD_NOT_FOUND',
          message: 'Unknown RPC method "unknown".',
          name: 'TaskWorkerError',
        },
        id: 3,
        type: 'bq:error',
      },
    ]);
  });

  it('validates host inputs', () => {
    const scope = createHostScope();
    expect(() => exposeTask(undefined as unknown as () => void, scope)).toThrow(
      TaskWorkerSerializationError
    );
    expect(() => exposeRpc({}, scope)).toThrow(TaskWorkerSerializationError);
    expect(() => exposeRpc({ bad: 1 as unknown as () => void }, scope)).toThrow(
      TaskWorkerSerializationError
    );
  });
});

// ===========================================================================
// #135 — Client async-concurrency primitives
// ===========================================================================

describe('concurrency/startTransition (#135)', () => {
  it('flags pending immediately and runs the scope on a deferred schedule', async () => {
    const filter = signal('');
    const [isPending, start] = startTransition({ timeout: 5 });

    expect(isPending.value).toBe(false);
    start(() => {
      filter.value = 'next';
    });

    // urgent: scope has not run yet, but pending is already visible
    expect(isPending.value).toBe(true);
    expect(filter.value).toBe('');

    await wait(20);
    expect(filter.value).toBe('next');
    expect(isPending.value).toBe(false);
  });

  it('stays pending until every concurrent transition settles', async () => {
    const [isPending, start] = startTransition({ timeout: 5 });
    start(() => undefined);
    start(() => undefined);
    expect(isPending.value).toBe(true);
    await wait(20);
    expect(isPending.value).toBe(false);
  });

  it('rejects a non-function scope', () => {
    const [, start] = startTransition();
    expect(() => start(undefined as unknown as () => void)).toThrow(TypeError);
  });

  it('contains a throwing scope instead of leaking an uncaught exception', async () => {
    const originalError = console.error;
    const logged: unknown[] = [];
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };

    try {
      const [isPending, start] = startTransition({ timeout: 1 });
      start(() => {
        throw new Error('boom');
      });
      expect(isPending.value).toBe(true);
      await wait(20);
      // accounting restored and the error was reported, not thrown to the host
      expect(isPending.value).toBe(false);
      expect(logged).toHaveLength(1);
    } finally {
      console.error = originalError;
    }
  });
});

describe('concurrency/deferred (#135)', () => {
  it('lags behind its source and coalesces rapid changes', async () => {
    const query = signal('a');
    const deferredQuery = deferred(query, { timeout: 10 });

    expect(deferredQuery.value).toBe('a');

    query.value = 'b';
    query.value = 'c';
    // still showing the previous value right after the change
    expect(deferredQuery.value).toBe('a');

    await wait(30);
    expect(deferredQuery.value).toBe('c');
  });

  it('accepts a getter source', async () => {
    const first = signal(1);
    const second = signal(2);
    const total = deferred(() => first.value + second.value, { timeout: 10 });
    expect(total.value).toBe(3);
    first.value = 10;
    await wait(30);
    expect(total.value).toBe(12);
  });

  it('stops tracking its source after dispose() (#173)', async () => {
    const query = signal('a');
    const deferredQuery = deferred(query, { timeout: 10 });
    expect(typeof deferredQuery.dispose).toBe('function');

    query.value = 'b';
    await wait(30);
    expect(deferredQuery.value).toBe('b');

    deferredQuery.dispose();

    // After disposal, source changes no longer flow through.
    query.value = 'c';
    await wait(30);
    expect(deferredQuery.value).toBe('b');
  });
});

describe('concurrency/suspense (#135)', () => {
  it('tracks a promise from pending to settled', async () => {
    let resolveWork: (value: number) => void = () => undefined;
    const work = new Promise<number>((resolve) => {
      resolveWork = resolve;
    });

    const boundary = suspense(work);
    expect(boundary.pending.value).toBe(true);
    expect(boundary.settled.value).toBe(false);

    resolveWork(1);
    await flush();
    expect(boundary.pending.value).toBe(false);
    expect(boundary.settled.value).toBe(true);
    expect(boundary.error.value).toBeNull();
    boundary.dispose();
  });

  it('captures the first rejection as the boundary error', async () => {
    const failing = Promise.reject(new Error('load failed'));
    const boundary = suspense(failing);
    await flush();
    expect(boundary.pending.value).toBe(false);
    expect(boundary.error.value).toBeInstanceOf(Error);
    expect(boundary.error.value?.message).toBe('load failed');
    boundary.dispose();
  });

  it('aggregates reactive async states and reacts to their pending signal', () => {
    const pending = signal(true);
    const error = signal<Error | null>(null);
    const boundary = suspense({ pending, error });

    expect(boundary.pending.value).toBe(true);
    pending.value = false;
    expect(boundary.pending.value).toBe(false);
    expect(boundary.settled.value).toBe(true);

    // retrigger (default) re-enters pending when the source becomes busy again
    pending.value = true;
    expect(boundary.pending.value).toBe(true);
    expect(boundary.settled.value).toBe(false);
    boundary.dispose();
  });

  it('latches settled when retrigger is disabled', () => {
    const pending = signal(false);
    const boundary = suspense({ pending }, { retrigger: false });
    expect(boundary.settled.value).toBe(true);
    pending.value = true;
    expect(boundary.settled.value).toBe(true); // latched
    boundary.dispose();
  });

  it('is observable through an effect', async () => {
    const pending = signal(true);
    const boundary = suspense({ pending });
    const seen: boolean[] = [];
    const stop = effect(() => {
      seen.push(boundary.pending.value);
    });
    pending.value = false;
    expect(seen).toEqual([true, false]);
    stop();
    boundary.dispose();
  });
});

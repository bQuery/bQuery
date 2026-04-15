import { describe, expect, it } from 'bun:test';
import type { WorkerTaskHandler } from '../src/concurrency/index';
import {
  batchTasks,
  callWorkerMethod,
  createReactiveRpcPool,
  createReactiveRpcWorker,
  createReactiveTaskPool,
  createReactiveTaskWorker,
  createRpcPool,
  createRpcWorker,
  createTaskPool,
  createTaskWorker,
  every,
  filter,
  find,
  getConcurrencySupport,
  isConcurrencySupported,
  map,
  parallel,
  pipeline,
  reduce,
  runTask,
  some,
  TaskWorkerAbortError,
  TaskWorkerSerializationError,
  TaskWorkerTimeoutError,
  TaskWorkerUnsupportedError,
} from '../src/concurrency/index';
import { effect } from '../src/reactive/index';

interface MockBlobShape {
  source: string;
}

type MockWorkerScope = {
  onmessage?: (event: { data: unknown }) => unknown;
  postMessage: (data: unknown) => void;
};

const withMockWorkerEnvironment = async (
  callback: (ctx: { revokedUrls: string[] }) => Promise<void> | void
): Promise<void> => {
  const originalWorker = globalThis.Worker;
  const originalBlob = globalThis.Blob;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const sourceRegistry = new Map<string, string>();
  const revokedUrls: string[] = [];
  let nextUrlId = 0;

  class MockBlob {
    readonly source: string;

    constructor(parts: BlobPart[]) {
      this.source = parts.map((part) => String(part)).join('');
    }
  }

  class MockWorker {
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    private readonly scope: MockWorkerScope;
    private terminated = false;

    constructor(url: string) {
      const source = sourceRegistry.get(url);
      if (!source) {
        throw new Error(`Unknown worker URL: ${url}`);
      }

      this.scope = {
        postMessage: (data: unknown) => {
          if (this.terminated) {
            return;
          }

          queueMicrotask(() => {
            this.onmessage?.({ data } as MessageEvent);
          });
        },
      };

      try {
        new Function('self', source)(this.scope);
      } catch (error) {
        queueMicrotask(() => {
          this.onerror?.({
            message: error instanceof Error ? error.message : String(error),
          } as ErrorEvent);
        });
      }
    }

    postMessage(data: unknown): void {
      if (this.terminated) {
        return;
      }

      queueMicrotask(() => {
        try {
          void this.scope.onmessage?.({ data });
        } catch (error) {
          this.onerror?.({
            message: error instanceof Error ? error.message : String(error),
          } as ErrorEvent);
        }
      });
    }

    terminate(): void {
      this.terminated = true;
    }
  }

  (globalThis as { Blob: typeof Blob }).Blob = MockBlob as unknown as typeof Blob;
  (globalThis as { Worker: typeof Worker }).Worker = MockWorker as unknown as typeof Worker;
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:mock-${++nextUrlId}`;
    sourceRegistry.set(url, (blob as unknown as MockBlobShape).source);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((url: string) => {
    revokedUrls.push(url);
    sourceRegistry.delete(url);
  }) as typeof URL.revokeObjectURL;

  try {
    await callback({ revokedUrls });
  } finally {
    (globalThis as { Blob: typeof Blob }).Blob = originalBlob;
    (globalThis as { Worker: typeof Worker }).Worker = originalWorker;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
};

describe('concurrency/support', () => {
  it('reports when worker primitives are unavailable', () => {
    const originalWorker = globalThis.Worker;
    const originalBlob = globalThis.Blob;
    const originalCreateObjectURL = URL.createObjectURL;

    try {
      (globalThis as { Worker?: typeof Worker }).Worker = undefined;
      (globalThis as { Blob?: typeof Blob }).Blob = undefined;
      URL.createObjectURL = undefined as unknown as typeof URL.createObjectURL;

      const support = getConcurrencySupport();
      expect(support.supported).toBe(false);
      expect(isConcurrencySupported()).toBe(false);
      expect(() => createTaskWorker((value: number) => value * 2)).toThrow(
        TaskWorkerUnsupportedError
      );
    } finally {
      (globalThis as { Worker?: typeof Worker }).Worker = originalWorker;
      (globalThis as { Blob?: typeof Blob }).Blob = originalBlob;
      URL.createObjectURL = originalCreateObjectURL;
    }
  });

  it('detects support when zero-build worker primitives are present', async () => {
    await withMockWorkerEnvironment(() => {
      const support = getConcurrencySupport();
      expect(support.worker).toBe(true);
      expect(support.blob).toBe(true);
      expect(support.objectUrl).toBe(true);
      expect(support.supported).toBe(true);
      expect(isConcurrencySupported()).toBe(true);
    });
  });

  it('requires revokeObjectURL support for zero-build worker execution', async () => {
    await withMockWorkerEnvironment(() => {
      const originalRevokeObjectURL = URL.revokeObjectURL;

      try {
        URL.revokeObjectURL = undefined as unknown as typeof URL.revokeObjectURL;

        const support = getConcurrencySupport();
        expect(support.objectUrl).toBe(false);
        expect(support.supported).toBe(false);
        expect(isConcurrencySupported()).toBe(false);
        expect(() => createTaskWorker((value: number) => value * 2)).toThrow(
          TaskWorkerUnsupportedError
        );
      } finally {
        URL.revokeObjectURL = originalRevokeObjectURL;
      }
    });
  });
});

describe('concurrency/runTask', () => {
  it('executes a one-off task and revokes the generated object URL', async () => {
    await withMockWorkerEnvironment(async ({ revokedUrls }) => {
      const result = await runTask((value: number) => value * 2, 21);
      expect(result).toBe(42);
      expect(revokedUrls).toHaveLength(1);
    });
  });

  it('normalizes unknown worker error codes back to WORKER', async () => {
    await withMockWorkerEnvironment(async () => {
      await expect(
        runTask(() => {
          throw Object.assign(new Error('boom'), { code: 'NOT_PUBLIC' });
        }, undefined)
      ).rejects.toMatchObject({
        code: 'WORKER',
        message: 'boom',
      });
    });
  });

  it('rejects native functions that cannot be reconstructed safely', async () => {
    await withMockWorkerEnvironment(() => {
      const nativeHandler = Math.max as unknown as WorkerTaskHandler<number, number>;
      expect(() => createTaskWorker(nativeHandler)).toThrow(TaskWorkerSerializationError);
    });
  });

  it('allows user-defined handlers that mention "[native code]" in their own source', async () => {
    await withMockWorkerEnvironment(async () => {
      await expect(
        runTask(() => {
          return '[native code]';
        }, undefined)
      ).resolves.toBe('[native code]');
    });
  });

  it('ignores overridden function toString() values during task validation', async () => {
    await withMockWorkerEnvironment(async () => {
      let customToStringCalled = false;
      const handler: WorkerTaskHandler<number, number> = (value: number) => value * 2;

      Object.defineProperty(handler, 'toString', {
        value: () => {
          customToStringCalled = true;
          return '() => { throw new Error("override"); }';
        },
      });

      await expect(runTask(handler, 21)).resolves.toBe(42);
      expect(customToStringCalled).toBe(false);
    });
  });
});

describe('concurrency/createTaskWorker', () => {
  it('reuses the worker across sequential runs', async () => {
    await withMockWorkerEnvironment(async () => {
      const worker = createTaskWorker(
        async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value * 3;
        }
      );

      expect(worker.state).toBe('idle');
      const firstPromise = worker.run({ delay: 1, value: 2 });
      expect(worker.busy).toBe(true);
      expect(worker.state).toBe('running');
      expect(await firstPromise).toBe(6);
      expect(worker.busy).toBe(false);
      expect(worker.state).toBe('idle');
      expect(await worker.run({ delay: 0, value: 4 })).toBe(12);

      worker.terminate();
      expect(worker.state).toBe('terminated');
    });
  });

  it('rejects overlapping runs on the same reusable worker', async () => {
    await withMockWorkerEnvironment(async () => {
      const worker = createTaskWorker(
        async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value;
        }
      );

      const firstRun = worker.run({ delay: 20, value: 1 });
      await expect(worker.run({ delay: 0, value: 2 })).rejects.toMatchObject({ code: 'BUSY' });
      expect(await firstRun).toBe(1);
      worker.terminate();
    });
  });

  it('times out the active run and allows a clean follow-up run', async () => {
    await withMockWorkerEnvironment(async () => {
      const worker = createTaskWorker(
        async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value * 2;
        }
      );

      await expect(worker.run({ delay: 30, value: 2 }, { timeout: 5 })).rejects.toBeInstanceOf(
        TaskWorkerTimeoutError
      );
      expect(worker.state).toBe('idle');
      expect(await worker.run({ delay: 0, value: 3 }, { timeout: 50 })).toBe(6);
      worker.terminate();
    });
  });

  it('aborts the active run and allows the worker to be used again', async () => {
    await withMockWorkerEnvironment(async () => {
      const worker = createTaskWorker(
        async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value;
        }
      );
      const controller = new AbortController();

      const pending = worker.run({ delay: 30, value: 7 }, { signal: controller.signal });
      controller.abort();

      await expect(pending).rejects.toBeInstanceOf(TaskWorkerAbortError);
      expect(worker.state).toBe('idle');
      expect(await worker.run({ delay: 0, value: 9 })).toBe(9);
      worker.terminate();
    });
  });

  it('rejects the in-flight task when the worker is terminated', async () => {
    await withMockWorkerEnvironment(async () => {
      const worker = createTaskWorker(
        async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value;
        }
      );

      const pending = worker.run({ delay: 30, value: 5 });
      worker.terminate();

      await expect(pending).rejects.toMatchObject({ code: 'TERMINATED' });
      await expect(worker.run({ delay: 0, value: 1 })).rejects.toMatchObject({
        code: 'TERMINATED',
      });
    });
  });
});

describe('concurrency/createRpcWorker', () => {
  it('calls multiple named methods sequentially on the same worker', async () => {
    await withMockWorkerEnvironment(async () => {
      const rpc = createRpcWorker({
        formatUser: ({ first, last }: { first: string; last: string }) => `${last}, ${first}`,
        sum: ({ values }: { values: number[] }) =>
          values.reduce((total, value) => total + value, 0),
      });

      expect(await rpc.call('formatUser', { first: 'Ada', last: 'Lovelace' })).toBe(
        'Lovelace, Ada'
      );
      expect(await rpc.call('sum', { values: [1, 2, 3, 4] })).toBe(10);
      rpc.terminate();
    });
  });

  it('rejects unknown methods with an explicit method error code', async () => {
    await withMockWorkerEnvironment(async () => {
      const rpc = createRpcWorker({
        square: (value: number) => value * value,
      });

      await expect(rpc.call('cube' as 'square', 3)).rejects.toMatchObject({
        code: 'METHOD_NOT_FOUND',
      });
      rpc.terminate();
    });
  });

  it('propagates RPC handler errors back to the caller', async () => {
    await withMockWorkerEnvironment(async () => {
      const rpc = createRpcWorker({
        fail: () => {
          throw new Error('boom');
        },
      });

      await expect(rpc.call('fail', undefined)).rejects.toMatchObject({
        message: 'boom',
      });
      rpc.terminate();
    });
  });

  it('rejects overlapping RPC calls on the same worker', async () => {
    await withMockWorkerEnvironment(async () => {
      const rpc = createRpcWorker({
        wait: async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value;
        },
      });

      const firstCall = rpc.call('wait', { delay: 20, value: 1 });
      await expect(rpc.call('wait', { delay: 0, value: 2 })).rejects.toMatchObject({
        code: 'BUSY',
      });
      expect(await firstCall).toBe(1);
      rpc.terminate();
    });
  });

  it('times out and aborts RPC calls with the same cleanup guarantees as task workers', async () => {
    await withMockWorkerEnvironment(async () => {
      const rpc = createRpcWorker({
        wait: async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value;
        },
      });

      await expect(
        rpc.call('wait', { delay: 30, value: 2 }, { timeout: 5 })
      ).rejects.toBeInstanceOf(TaskWorkerTimeoutError);
      expect(await rpc.call('wait', { delay: 0, value: 3 })).toBe(3);

      const controller = new AbortController();
      const pending = rpc.call('wait', { delay: 30, value: 4 }, { signal: controller.signal });
      controller.abort();

      await expect(pending).rejects.toBeInstanceOf(TaskWorkerAbortError);
      expect(await rpc.call('wait', { delay: 0, value: 5 })).toBe(5);
      rpc.terminate();
    });
  });

  it('rejects the in-flight RPC call when the worker is terminated', async () => {
    await withMockWorkerEnvironment(async () => {
      const rpc = createRpcWorker({
        wait: async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value;
        },
      });

      const pending = rpc.call('wait', { delay: 30, value: 8 });
      rpc.terminate();

      await expect(pending).rejects.toMatchObject({ code: 'TERMINATED' });
      await expect(rpc.call('wait', { delay: 0, value: 1 })).rejects.toMatchObject({
        code: 'TERMINATED',
      });
    });
  });
});

describe('concurrency/callWorkerMethod', () => {
  it('executes one RPC method in a fresh worker', async () => {
    await withMockWorkerEnvironment(async () => {
      const total = await callWorkerMethod(
        {
          sum: ({ values }: { values: number[] }) =>
            values.reduce((result, value) => result + value, 0),
        },
        'sum',
        { values: [2, 4, 6] }
      );

      expect(total).toBe(12);
    });
  });
});

describe('concurrency/high-level helpers', () => {
  it('runs mixed standalone tasks in parallel and preserves result order', async () => {
    await withMockWorkerEnvironment(async () => {
      const results = await parallel([
        { handler: (value: number) => value * 2, input: 5 },
        {
          handler: ({ first, last }: { first: string; last: string }) => `${last}, ${first}`,
          input: { first: 'Ada', last: 'Lovelace' },
        },
        {
          handler: async ({ delay, value }: { delay: number; value: number }) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return value + 1;
          },
          input: { delay: 5, value: 9 },
        },
      ]);

      expect(results).toEqual([10, 'Lovelace, Ada', 10]);
    });
  });

  it('executes tasks in sequential batches via batchTasks', async () => {
    await withMockWorkerEnvironment(async () => {
      const results = await batchTasks(
        [
          { handler: (value: number) => value * 2, input: 1 },
          { handler: (value: number) => value * 2, input: 2 },
          { handler: (value: number) => value * 2, input: 3 },
        ],
        2,
        { concurrency: 2 }
      );

      expect(results).toEqual([2, 4, 6]);
    });
  });

  it('rejects invalid batch sizes for batchTasks', async () => {
    await withMockWorkerEnvironment(async () => {
      await expect(
        batchTasks([{ handler: (value: number) => value, input: 1 }], 0)
      ).rejects.toBeInstanceOf(RangeError);
    });
  });

  it('maps arrays in parallel with chunking and index-aware callbacks', async () => {
    await withMockWorkerEnvironment(async () => {
      const results = await map(
        [1, 2, 3, 4],
        async (value, index) => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          return value + index;
        },
        { batchSize: 2, concurrency: 2 }
      );

      expect(results).toEqual([1, 3, 5, 7]);
    });
  });

  it('maps sparse arrays without crashing chunk execution', async () => {
    await withMockWorkerEnvironment(async () => {
      // Intentionally sparse: middle element tests hole handling.
      const values = [1, , 3] as Array<number | undefined>;
      const results = await map(
        values,
        (value, index) => (value === undefined ? `hole-${index}` : value * 2),
        { batchSize: 2, concurrency: 2 }
      );

      expect(results).toEqual([2, 'hole-1', 6]);
    });
  });

  it('aborts queued or running map chunks through a shared signal', async () => {
    await withMockWorkerEnvironment(async () => {
      const controller = new AbortController();
      const pending = map(
        [1, 2, 3, 4],
        async (value) => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return value * 2;
        },
        { batchSize: 1, concurrency: 1, signal: controller.signal }
      );

      controller.abort();

      await expect(pending).rejects.toBeInstanceOf(TaskWorkerAbortError);
    });
  });

  it('filters arrays in parallel and preserves the original order', async () => {
    await withMockWorkerEnvironment(async () => {
      const results = await filter(
        [5, 2, 9, 4, 7],
        async (value, index) => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          return value % 2 === 1 && index !== 4;
        },
        { batchSize: 2, concurrency: 2 }
      );

      expect(results).toEqual([5, 9]);
    });
  });

  it('filters sparse arrays using the evaluated hole matches', async () => {
    await withMockWorkerEnvironment(async () => {
      // Intentionally sparse: preserved hole proves filter uses predicate results for empty slots.
      const values = [1, , 3] as Array<number | undefined>;
      const results = await filter(values, (_value, index) => index > 0, {
        batchSize: 2,
        concurrency: 2,
      });

      expect(results).toHaveLength(2);
      expect(0 in results).toBe(false);
      expect(results[1]).toBe(3);
    });
  });

  it('returns some/every/find results from predicate-style helpers', async () => {
    await withMockWorkerEnvironment(async () => {
      await expect(
        some(
          [1, 3, 4, 7],
          async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            return value % 2 === 0;
          },
          { batchSize: 2, concurrency: 2 }
        )
      ).resolves.toBe(true);

      await expect(
        every(
          [2, 4, 6],
          async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            return value % 2 === 0;
          },
          { batchSize: 2, concurrency: 2 }
        )
      ).resolves.toBe(true);

      await expect(
        find(
          [3, 8, 11, 14],
          async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            return value > 10;
          },
          { batchSize: 2, concurrency: 2 }
        )
      ).resolves.toBe(11);
    });
  });

  it('returns the expected empty-input results for predicate-style helpers', async () => {
    await withMockWorkerEnvironment(async () => {
      await expect(filter([], (value: number) => value > 0)).resolves.toEqual([]);
      await expect(some([], (value: number) => value > 0)).resolves.toBe(false);
      await expect(every([], (value: number) => value > 0)).resolves.toBe(true);
      await expect(find([], (value: number) => value > 0)).resolves.toBeUndefined();
    });
  });

  it('reduces arrays in one worker while preserving accumulator order', async () => {
    await withMockWorkerEnvironment(async () => {
      const result = await reduce(
        [1, 2, 3, 4],
        async (accumulator, value, index) => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          return accumulator + value * (index + 1);
        },
        0,
        { timeout: 1_000 }
      );

      expect(result).toBe(30);
    });
  });

  it('returns the initial value when reduce() receives an empty array', async () => {
    await withMockWorkerEnvironment(async () => {
      const initial = { total: 5 };
      await expect(
        reduce([], (accumulator: { total: number }, _value: number) => accumulator, initial)
      ).resolves.toBe(initial);
    });
  });

  it('builds immutable fluent pipelines on top of the collection helpers', async () => {
    await withMockWorkerEnvironment(async () => {
      const base = pipeline([1, 2, 3, 4], { batchSize: 2, concurrency: 2 });
      const transformed = base
        .map(async (value) => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          return value * 3;
        })
        .filter((value) => value > 6);

      await expect(base.toArray()).resolves.toEqual([1, 2, 3, 4]);
      await expect(transformed.toArray()).resolves.toEqual([9, 12]);
    });
  });

  it('preserves sparse arrays when pipelines snapshot and materialize values', async () => {
    await withMockWorkerEnvironment(async () => {
      const values = [1, , 3] as Array<number | undefined>;
      const base = pipeline(values, { batchSize: 2, concurrency: 2 });
      const filtered = base.filter((_value, index) => index > 0);
      const baseResult = await base.toArray();
      const filteredResult = await filtered.toArray();

      expect(baseResult).toHaveLength(3);
      expect(1 in baseResult).toBe(false);
      expect(baseResult[0]).toBe(1);
      expect(baseResult[2]).toBe(3);

      expect(filteredResult).toHaveLength(2);
      expect(0 in filteredResult).toBe(false);
      expect(filteredResult[1]).toBe(3);
    });
  });

  it('supports terminal pipeline helpers after fluent transformations', async () => {
    await withMockWorkerEnvironment(async () => {
      const transformed = pipeline([1, 2, 3, 4], {
        batchSize: 2,
        concurrency: 2,
      }).map((value, index) => value + index);

      await expect(transformed.some((value) => value === 5)).resolves.toBe(true);
      await expect(transformed.every((value) => value >= 1)).resolves.toBe(true);
      await expect(transformed.find((value) => value > 4)).resolves.toBe(5);
      await expect(
        transformed.reduce((accumulator, value) => accumulator + value, 0)
      ).resolves.toBe(16);
    });
  });

  it('lets reduce() stages explicitly clear pipeline timeout and signal defaults', async () => {
    await withMockWorkerEnvironment(async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        pipeline([1, 2], { signal: controller.signal, timeout: 1 }).reduce(
          async (accumulator, value) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return accumulator + value;
          },
          0,
          { signal: undefined, timeout: undefined }
        )
      ).resolves.toBe(3);
    });
  });

  it('surfaces invalid per-stage pipeline options through the underlying helpers', async () => {
    await withMockWorkerEnvironment(async () => {
      await expect(
        pipeline([1, 2, 3])
          .map((value) => value, { batchSize: 0 })
          .toArray()
      ).rejects.toBeInstanceOf(RangeError);
    });
  });
});

describe('concurrency/createTaskPool', () => {
  it('runs up to the configured concurrency and queues the rest', async () => {
    await withMockWorkerEnvironment(async () => {
      const pool = createTaskPool(
        async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value * 2;
        },
        { concurrency: 2 }
      );

      const first = pool.run({ delay: 20, value: 1 });
      const second = pool.run({ delay: 20, value: 2 });
      const third = pool.run({ delay: 0, value: 3 });

      expect(pool.pending).toBe(2);
      expect(pool.size).toBe(1);
      expect(pool.busy).toBe(true);
      expect(pool.state).toBe('running');

      await expect(Promise.all([first, second, third])).resolves.toEqual([2, 4, 6]);
      expect(pool.pending).toBe(0);
      expect(pool.size).toBe(0);
      expect(pool.state).toBe('idle');

      pool.terminate();
    });
  });

  it('rejects queued tasks when the pool queue is full', async () => {
    await withMockWorkerEnvironment(async () => {
      const pool = createTaskPool(
        async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value;
        },
        { concurrency: 1, maxQueue: 1 }
      );

      const first = pool.run({ delay: 20, value: 1 });
      const second = pool.run({ delay: 0, value: 2 });

      await expect(pool.run({ delay: 0, value: 3 })).rejects.toMatchObject({
        code: 'QUEUE_FULL',
      });

      await expect(first).resolves.toBe(1);
      await expect(second).resolves.toBe(2);
      pool.terminate();
    });
  });

  it('clears queued tasks without interrupting active ones', async () => {
    await withMockWorkerEnvironment(async () => {
      const pool = createTaskPool(
        async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value;
        },
        { concurrency: 1 }
      );

      const first = pool.run({ delay: 20, value: 1 });
      const second = pool.run({ delay: 0, value: 2 });
      const third = pool.run({ delay: 0, value: 3 });
      const secondError = second.then(
        () => null,
        (error) => error
      );
      const thirdError = third.then(
        () => null,
        (error) => error
      );

      expect(pool.size).toBe(2);
      pool.clear();
      expect(pool.size).toBe(0);

      await expect(first).resolves.toBe(1);
      await expect(secondError).resolves.toMatchObject({ code: 'QUEUE_CLEARED' });
      await expect(thirdError).resolves.toMatchObject({ code: 'QUEUE_CLEARED' });

      pool.terminate();
    });
  });

  it('rejects queued tasks when aborted before execution starts', async () => {
    await withMockWorkerEnvironment(async () => {
      const pool = createTaskPool(
        async ({ delay, value }: { delay: number; value: number }) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value;
        },
        { concurrency: 1 }
      );
      const controller = new AbortController();

      const first = pool.run({ delay: 20, value: 1 });
      const queued = pool.run(
        { delay: 0, value: 2 },
        {
          signal: controller.signal,
        }
      );

      expect(pool.size).toBe(1);
      controller.abort();

      await expect(queued).rejects.toBeInstanceOf(TaskWorkerAbortError);
      expect(pool.size).toBe(0);
      await expect(first).resolves.toBe(1);
      pool.terminate();
    });
  });
});

describe('concurrency/createRpcPool', () => {
  it('executes RPC calls across multiple workers and queues overflow', async () => {
    await withMockWorkerEnvironment(async () => {
      const pool = createRpcPool(
        {
          wait: async ({ delay, value }: { delay: number; value: number }) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return value;
          },
        },
        { concurrency: 2 }
      );

      const first = pool.call('wait', { delay: 20, value: 1 });
      const second = pool.call('wait', { delay: 20, value: 2 });
      const third = pool.call('wait', { delay: 0, value: 3 });

      expect(pool.pending).toBe(2);
      expect(pool.size).toBe(1);

      await expect(Promise.all([first, second, third])).resolves.toEqual([1, 2, 3]);
      expect(pool.pending).toBe(0);
      expect(pool.size).toBe(0);

      pool.terminate();
    });
  });

  it('terminates active and queued RPC calls', async () => {
    await withMockWorkerEnvironment(async () => {
      const pool = createRpcPool(
        {
          wait: async ({ delay, value }: { delay: number; value: number }) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return value;
          },
        },
        { concurrency: 1 }
      );

      const first = pool.call('wait', { delay: 20, value: 1 });
      const second = pool.call('wait', { delay: 0, value: 2 });
      const secondError = second.then(
        () => null,
        (error) => error
      );

      pool.terminate();

      await expect(first).rejects.toMatchObject({ code: 'TERMINATED' });
      await expect(secondError).resolves.toMatchObject({ code: 'TERMINATED' });
    });
  });
});

describe('concurrency/reactive wrappers', () => {
  describe('createReactiveTaskWorker', () => {
    it('mirrors worker lifecycle through readonly signals and sync getters', async () => {
      await withMockWorkerEnvironment(async () => {
        const worker = createReactiveTaskWorker(
          async ({ delay, value }: { delay: number; value: number }) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return value * 2;
          }
        );
        const snapshots: Array<{ busy: boolean; state: string }> = [];
        const stop = effect(() => {
          snapshots.push({
            busy: worker.busy$.value,
            state: worker.state$.value,
          });
        });

        expect(worker.state).toBe(worker.state$.peek());
        expect(worker.busy).toBe(worker.busy$.peek());

        const pending = worker.run({ delay: 20, value: 4 });

        expect(worker.state).toBe('running');
        expect(worker.state$.peek()).toBe('running');
        expect(worker.busy).toBe(true);
        expect(worker.busy$.peek()).toBe(true);

        await expect(pending).resolves.toBe(8);

        expect(worker.state).toBe('idle');
        expect(worker.state$.peek()).toBe('idle');
        expect(worker.busy).toBe(false);
        expect(worker.busy$.peek()).toBe(false);

        worker.terminate();

        expect(worker.state).toBe('terminated');
        expect(worker.state$.peek()).toBe('terminated');
        expect(worker.busy).toBe(false);
        expect(worker.busy$.peek()).toBe(false);

        stop();

        expect(snapshots).toEqual([
          { busy: false, state: 'idle' },
          { busy: true, state: 'running' },
          { busy: false, state: 'idle' },
          { busy: false, state: 'terminated' },
        ]);
      });
    });

    it('returns to idle after timeout and abort failures', async () => {
      await withMockWorkerEnvironment(async () => {
        const worker = createReactiveTaskWorker(
          async ({ delay, value }: { delay: number; value: number }) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return value;
          }
        );

        await expect(worker.run({ delay: 30, value: 1 }, { timeout: 5 })).rejects.toBeInstanceOf(
          TaskWorkerTimeoutError
        );
        expect(worker.state$.peek()).toBe('idle');
        expect(worker.busy$.peek()).toBe(false);

        const controller = new AbortController();
        const pending = worker.run({ delay: 30, value: 2 }, { signal: controller.signal });

        expect(worker.state$.peek()).toBe('running');
        expect(worker.busy$.peek()).toBe(true);

        controller.abort();

        await expect(pending).rejects.toBeInstanceOf(TaskWorkerAbortError);
        expect(worker.state$.peek()).toBe('idle');
        expect(worker.busy$.peek()).toBe(false);

        worker.terminate();
      });
    });
  });

  describe('createReactiveRpcWorker', () => {
    it('mirrors rpc worker lifecycle through readonly signals', async () => {
      await withMockWorkerEnvironment(async () => {
        const rpc = createReactiveRpcWorker({
          sum: async ({ delay, values }: { delay: number; values: number[] }) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return values.reduce((total, value) => total + value, 0);
          },
        });
        const states: string[] = [];
        const stop = effect(() => {
          states.push(rpc.state$.value);
        });

        const pending = rpc.call('sum', { delay: 20, values: [1, 2, 3] });

        expect(rpc.state$.peek()).toBe('running');
        expect(rpc.busy$.peek()).toBe(true);

        await expect(pending).resolves.toBe(6);

        expect(rpc.state$.peek()).toBe('idle');
        expect(rpc.busy$.peek()).toBe(false);

        rpc.terminate();

        expect(rpc.state$.peek()).toBe('terminated');
        expect(rpc.busy$.peek()).toBe(false);

        stop();

        expect(states).toEqual(['idle', 'running', 'idle', 'terminated']);
      });
    });
  });

  describe('createReactiveTaskPool', () => {
    it('tracks running and queued work reactively while preserving sync getters', async () => {
      await withMockWorkerEnvironment(async () => {
        const pool = createReactiveTaskPool(
          async ({ delay, value }: { delay: number; value: number }) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return value;
          },
          { concurrency: 1 }
        );
        const snapshots: Array<{
          busy: boolean;
          concurrency: number;
          pending: number;
          size: number;
          state: string;
        }> = [];
        const stop = effect(() => {
          snapshots.push({
            busy: pool.busy$.value,
            concurrency: pool.concurrency$.value,
            pending: pool.pending$.value,
            size: pool.size$.value,
            state: pool.state$.value,
          });
        });

        expect(pool.state).toBe(pool.state$.peek());
        expect(pool.busy).toBe(pool.busy$.peek());
        expect(pool.pending).toBe(pool.pending$.peek());
        expect(pool.size).toBe(pool.size$.peek());
        expect(pool.concurrency).toBe(pool.concurrency$.peek());

        const first = pool.run({ delay: 20, value: 1 });
        expect(pool.pending$.peek()).toBe(1);
        expect(pool.size$.peek()).toBe(0);
        expect(pool.state$.peek()).toBe('running');

        const second = pool.run({ delay: 0, value: 2 });
        expect(pool.pending$.peek()).toBe(1);
        expect(pool.size$.peek()).toBe(1);
        expect(pool.state$.peek()).toBe('running');

        await expect(first).resolves.toBe(1);

        expect(pool.pending$.peek()).toBe(1);
        expect(pool.size$.peek()).toBe(0);
        expect(pool.state$.peek()).toBe('running');

        await expect(second).resolves.toBe(2);

        expect(pool.pending$.peek()).toBe(0);
        expect(pool.size$.peek()).toBe(0);
        expect(pool.state$.peek()).toBe('idle');
        expect(pool.busy$.peek()).toBe(false);

        pool.terminate();

        expect(pool.state$.peek()).toBe('terminated');
        expect(pool.busy$.peek()).toBe(false);

        stop();

        expect(snapshots).toEqual([
          { busy: false, concurrency: 1, pending: 0, size: 0, state: 'idle' },
          { busy: true, concurrency: 1, pending: 1, size: 0, state: 'running' },
          { busy: true, concurrency: 1, pending: 1, size: 1, state: 'running' },
          { busy: true, concurrency: 1, pending: 1, size: 0, state: 'running' },
          { busy: false, concurrency: 1, pending: 0, size: 0, state: 'idle' },
          { busy: false, concurrency: 1, pending: 0, size: 0, state: 'terminated' },
        ]);
      });
    });

    it('updates signals when queued work is cleared and when the pool is terminated', async () => {
      await withMockWorkerEnvironment(async () => {
        const pool = createReactiveTaskPool(
          async ({ delay, value }: { delay: number; value: number }) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return value;
          },
          { concurrency: 1 }
        );

        const first = pool.run({ delay: 20, value: 1 });
        const second = pool.run({ delay: 0, value: 2 });
        const third = pool.run({ delay: 0, value: 3 });
        const secondError = second.then(
          () => null,
          (error) => error
        );
        const thirdError = third.then(
          () => null,
          (error) => error
        );

        expect(pool.pending$.peek()).toBe(1);
        expect(pool.size$.peek()).toBe(2);

        pool.clear();

        expect(pool.pending$.peek()).toBe(1);
        expect(pool.size$.peek()).toBe(0);
        expect(pool.state$.peek()).toBe('running');

        await expect(secondError).resolves.toMatchObject({ code: 'QUEUE_CLEARED' });
        await expect(thirdError).resolves.toMatchObject({ code: 'QUEUE_CLEARED' });
        await expect(first).resolves.toBe(1);

        pool.terminate();

        expect(pool.state$.peek()).toBe('terminated');
        expect(pool.pending$.peek()).toBe(0);
        expect(pool.size$.peek()).toBe(0);
      });
    });
  });

  describe('createReactiveRpcPool', () => {
    it('tracks rpc pool queue state reactively', async () => {
      await withMockWorkerEnvironment(async () => {
        const pool = createReactiveRpcPool(
          {
            wait: async ({ delay, value }: { delay: number; value: number }) => {
              await new Promise((resolve) => setTimeout(resolve, delay));
              return value;
            },
          },
          { concurrency: 2 }
        );
        const snapshots: Array<{ pending: number; size: number; state: string }> = [];
        const stop = effect(() => {
          snapshots.push({
            pending: pool.pending$.value,
            size: pool.size$.value,
            state: pool.state$.value,
          });
        });

        const first = pool.call('wait', { delay: 20, value: 1 });
        const second = pool.call('wait', { delay: 20, value: 2 });
        const third = pool.call('wait', { delay: 0, value: 3 });

        expect(pool.pending$.peek()).toBe(2);
        expect(pool.size$.peek()).toBe(1);
        expect(pool.state$.peek()).toBe('running');

        await expect(Promise.all([first, second, third])).resolves.toEqual([1, 2, 3]);

        expect(pool.pending$.peek()).toBe(0);
        expect(pool.size$.peek()).toBe(0);
        expect(pool.state$.peek()).toBe('idle');

        pool.terminate();

        expect(pool.state$.peek()).toBe('terminated');

        stop();

        expect(snapshots).toEqual([
          { pending: 0, size: 0, state: 'idle' },
          { pending: 1, size: 0, state: 'running' },
          { pending: 2, size: 0, state: 'running' },
          { pending: 2, size: 1, state: 'running' },
          { pending: 2, size: 0, state: 'running' },
          { pending: 1, size: 0, state: 'running' },
          { pending: 0, size: 0, state: 'idle' },
          { pending: 0, size: 0, state: 'terminated' },
        ]);
      });
    });
  });
});

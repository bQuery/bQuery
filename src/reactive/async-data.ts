/**
 * Async data and fetch composables built on bQuery signals.
 *
 * @module bquery/reactive
 */

import { merge } from '../core/utils/object';
import { getBqueryConfig, type BqueryFetchParseAs } from '../platform/config';
import { computed } from './computed';
import { effect } from './effect';
import { Signal, signal } from './core';
import { untrack } from './untrack';

/** Allowed status values for async composables. */
export type AsyncDataStatus = 'idle' | 'pending' | 'success' | 'error';

/** Reactive source types that can trigger refreshes. */
export type AsyncWatchSource = (() => unknown) | { value: unknown };

/** Options shared by async composables. */
export interface UseAsyncDataOptions<TResult, TData = TResult> {
  /** Run the handler immediately (default: true). */
  immediate?: boolean;
  /** Default data value before the first successful execution. */
  defaultValue?: TData;
  /** Optional reactive sources that trigger refreshes when they change. */
  watch?: AsyncWatchSource[];
  /** Transform the resolved value before storing it. */
  transform?: (value: TResult) => TData;
  /** Called after a successful execution. */
  onSuccess?: (value: TData) => void;
  /** Called after a failed execution. */
  onError?: (error: Error) => void;
}

/** Return value of useAsyncData() and useFetch(). */
export interface AsyncDataState<TData> {
  /** Reactive data signal. */
  data: Signal<TData | undefined>;
  /** Last error encountered by the composable. */
  error: Signal<Error | null>;
  /** Current lifecycle status. */
  status: Signal<AsyncDataStatus>;
  /** Computed boolean that mirrors `status === 'pending'`. */
  pending: { readonly value: boolean; peek(): boolean };
  /** Execute the handler manually. Returns the cached data value when called after dispose(). */
  execute: () => Promise<TData | undefined>;
  /** Alias for execute(). */
  refresh: () => Promise<TData | undefined>;
  /** Abort the current in-flight request (useFetch only; no-op for useAsyncData). */
  abort: () => void;
  /** Clear data, error, and status back to the initial state. */
  clear: () => void;
  /** Dispose reactive watchers and prevent future executions. */
  dispose: () => void;
}

/** Configuration for automatic request retries in useFetch(). */
export interface UseFetchRetryConfig {
  /** Maximum number of retry attempts (default: 3). */
  count: number;
  /** Delay in ms between retries, or a function receiving the attempt index. */
  delay?: number | ((attempt: number) => number);
  /** Predicate deciding whether to retry. Defaults to network / 5xx errors. */
  retryOn?: (error: Error, attempt: number) => boolean;
}

/** Options for useFetch(). */
export interface UseFetchOptions<TResponse = unknown, TData = TResponse>
  extends UseAsyncDataOptions<TResponse, TData>, Omit<RequestInit, 'body' | 'headers' | 'signal'> {
  /** Base URL prepended to relative URLs. */
  baseUrl?: string;
  /** Query parameters appended to the request URL. */
  query?: Record<string, unknown>;
  /** Request headers. */
  headers?: HeadersInit;
  /** Request body, including plain objects for JSON requests. */
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  /** Override the parser used for the response body. */
  parseAs?: BqueryFetchParseAs;
  /** Custom fetch implementation for testing or adapters. */
  fetcher?: typeof fetch;
  /** Request timeout in milliseconds. 0 means no timeout. */
  timeout?: number;
  /** External AbortSignal for request cancellation. */
  signal?: AbortSignal;
  /** Retry configuration. Pass a number for simple retry count, or a config object. */
  retry?: number | UseFetchRetryConfig;
  /** Custom status validation. Returns `true` for acceptable statuses. */
  validateStatus?: (status: number) => boolean;
}

/** Input accepted by useFetch(). */
export type FetchInput = string | URL | Request | (() => string | URL | Request);

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  if (typeof error === 'string') {
    return new Error(error);
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
};

const readWatchSource = (source: AsyncWatchSource): unknown => {
  if (typeof source === 'function') {
    return source();
  }
  return source.value;
};

const toHeaders = (...sources: Array<HeadersInit | undefined>): Headers => {
  const headers = new Headers();
  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
};

const isBodyLike = (value: unknown): value is BodyInit => {
  if (typeof value === 'string') return true;
  if (value instanceof Blob || value instanceof FormData || value instanceof URLSearchParams) {
    return true;
  }
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return true;
  if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) return true;
  return typeof value === 'object' && value !== null && ArrayBuffer.isView(value);
};

const serializeBody = (
  body: UseFetchOptions['body'],
  headers: Headers
): BodyInit | null | undefined => {
  if (body == null) return body;
  if (isBodyLike(body)) return body;

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return JSON.stringify(body);
};

const resolveInput = (input: FetchInput): string | URL | Request => {
  return typeof input === 'function' ? input() : input;
};

const appendQuery = (url: URL, query: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) {
          url.searchParams.append(key, String(item));
        }
      }
      continue;
    }

    url.searchParams.set(key, String(value));
  }
};

const toUrl = (input: string | URL, baseUrl?: string): URL => {
  const runtimeBase =
    typeof window !== 'undefined' && /^https?:/i.test(window.location.href)
      ? window.location.href
      : 'http://localhost';
  const base = baseUrl ? new URL(baseUrl, runtimeBase).toString() : runtimeBase;
  return input instanceof URL ? new URL(input.toString(), base) : new URL(input, base);
};

const parseResponse = async <TResponse>(
  response: Response,
  parseAs: BqueryFetchParseAs
): Promise<TResponse> => {
  if (parseAs === 'response') return response as TResponse;
  if (parseAs === 'text') return (await response.text()) as TResponse;
  if (parseAs === 'blob') return (await response.blob()) as TResponse;
  if (parseAs === 'arrayBuffer') return (await response.arrayBuffer()) as TResponse;
  if (parseAs === 'formData') return (await response.formData()) as TResponse;

  const text = await response.text();
  if (!text) {
    return undefined as TResponse;
  }

  try {
    return JSON.parse(text) as TResponse;
  } catch (error) {
    const detail = response.url ? ` for ${response.url}` : '';
    throw new Error(
      `Failed to parse JSON response${detail} (status ${response.status}): ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const normalizeMethod = (method?: string): string | undefined => {
  const normalized = method?.trim();
  return normalized ? normalized.toUpperCase() : undefined;
};

const resolveMethod = (
  explicitMethod: string | undefined,
  requestInput: string | URL | Request,
  bodyProvided: boolean
): string | undefined => {
  const requestMethod =
    requestInput instanceof Request ? normalizeMethod(requestInput.method) : undefined;
  return explicitMethod ?? requestMethod ?? (bodyProvided ? 'POST' : undefined);
};

const resolveRequestInitMethod = (
  explicitMethod: string | undefined,
  requestInput: string | URL | Request,
  method: string | undefined
): string | undefined => {
  if (explicitMethod) return explicitMethod;
  return requestInput instanceof Request ? undefined : method;
};

const toRequestInit = (request: Request): RequestInit => {
  const requestMethod = normalizeMethod(request.method);
  let body: BodyInit | undefined;
  if (requestMethod !== 'GET' && requestMethod !== 'HEAD' && !request.bodyUsed) {
    try {
      body = request.clone().body ?? undefined;
    } catch {
      body = undefined;
    }
  }

  return {
    method: requestMethod,
    headers: request.headers,
    body,
    cache: request.cache,
    credentials: request.credentials,
    integrity: request.integrity,
    keepalive: request.keepalive,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    signal: request.signal,
  };
};

/**
 * Create a reactive wrapper around an async resolver.
 *
 * @template TResult - Raw result type returned by the handler
 * @template TData - Stored data type after optional transformation
 * @param handler - Async function to execute
 * @param options - Execution, transform, and refresh options
 * @returns Reactive data state with execute(), refresh(), and clear()
 *
 * @example
 * ```ts
 * const user = useAsyncData(() => fetch('/api/user').then((res) => res.json()));
 * ```
 */
export const useAsyncData = <TResult, TData = TResult>(
  handler: () => Promise<TResult>,
  options: UseAsyncDataOptions<TResult, TData> = {}
): AsyncDataState<TData> => {
  const immediate = options.immediate ?? true;
  const data = signal<TData | undefined>(options.defaultValue);
  const error = signal<Error | null>(null);
  const status = signal<AsyncDataStatus>('idle');
  const pending = computed(() => status.value === 'pending');
  let executionId = 0;
  let disposed = false;
  let stopWatching = (): void => {};

  const clear = (): void => {
    executionId += 1;
    data.value = options.defaultValue;
    error.value = null;
    status.value = 'idle';
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    executionId += 1;
    stopWatching();
  };

  const execute = async (): Promise<TData | undefined> => {
    if (disposed) {
      return data.peek();
    }

    const currentExecution = ++executionId;
    status.value = 'pending';
    error.value = null;

    try {
      const resolved = await handler();
      const transformed = options.transform
        ? options.transform(resolved)
        : (resolved as unknown as TData);

      if (disposed || currentExecution !== executionId) {
        return data.peek();
      }

      data.value = transformed;
      status.value = 'success';
      options.onSuccess?.(transformed);
      return transformed;
    } catch (caught) {
      const normalizedError = normalizeError(caught);

      if (disposed || currentExecution !== executionId) {
        return data.peek();
      }

      error.value = normalizedError;
      status.value = 'error';
      options.onError?.(normalizedError);
      return data.peek();
    }
  };

  if (options.watch?.length) {
    let initialized = false;
    stopWatching = effect(() => {
      for (const source of options.watch ?? []) {
        readWatchSource(source);
      }

      if (!initialized) {
        initialized = true;
        if (immediate) {
          void untrack(() => execute());
        }
        return;
      }

      void untrack(() => execute());
    });
  } else if (immediate) {
    void execute();
  }

  return {
    data,
    error,
    status,
    pending,
    execute,
    refresh: execute,
    abort: () => {},
    clear,
    dispose,
  };
};

/** @internal */
const DEFAULT_VALIDATE_STATUS = (status: number): boolean => status >= 200 && status < 300;

/** @internal */
const isDomExceptionNamed = (error: unknown, name: string): error is DOMException =>
  error instanceof DOMException && error.name === name;

/** @internal */
const isTimeoutDomException = (error: unknown): error is DOMException =>
  isDomExceptionNamed(error, 'TimeoutError');

/** @internal */
const isAbortDomException = (error: unknown): error is DOMException =>
  isDomExceptionNamed(error, 'AbortError');

/** @internal */
const DEFAULT_RETRY_ON = (error: Error): boolean => {
  if (
    isAbortDomException(error) ||
    isTimeoutDomException(error) ||
    (error as Error & { code?: string }).code === 'ABORT' ||
    (error as Error & { code?: string }).code === 'TIMEOUT'
  ) {
    return false;
  }
  const status = (error as Error & { status?: number }).status;
  return status === undefined || status >= 500;
};

/** @internal */
const normalizeRetryConfig = (
  retry: UseFetchOptions['retry']
): UseFetchRetryConfig | undefined => {
  if (retry == null) return undefined;
  if (typeof retry === 'number') return { count: retry };
  return retry;
};

/** @internal */
const resolveRetryDelay = (delay: UseFetchRetryConfig['delay'], attempt: number): number => {
  if (delay == null) return Math.min(1000 * 2 ** attempt, 30_000);
  if (typeof delay === 'number') return delay;
  return delay(attempt);
};

/** @internal */
const sleepWithSignal = (ms: number, abortSignal?: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(abortSignal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    let cleanedUp = false;
    let timer: ReturnType<typeof setTimeout>;

    const onAbort = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', onAbort);
      reject(
        abortSignal?.reason ?? new DOMException('The operation was aborted.', 'AbortError')
      );
    };

    timer = setTimeout(() => {
      if (cleanedUp) return;
      cleanedUp = true;
      abortSignal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    abortSignal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Reactive fetch composable using the browser Fetch API.
 *
 * Supports timeout, abort, retry, and custom status validation in addition
 * to the core useFetch features (query params, JSON body, baseUrl, watch).
 *
 * @template TResponse - Raw parsed response type
 * @template TData - Stored response type after optional transformation
 * @param input - Request URL, Request object, or lazy input factory
 * @param options - Request and reactive state options
 * @returns Reactive fetch state with execute(), refresh(), abort(), clear(), and dispose()
 *
 * @example
 * ```ts
 * const users = useFetch<{ id: number; name: string }[]>('/api/users', {
 *   timeout: 5000,
 *   retry: 3,
 * });
 * ```
 */
export const useFetch = <TResponse = unknown, TData = TResponse>(
  input: FetchInput,
  options: UseFetchOptions<TResponse, TData> = {}
): AsyncDataState<TData> => {
  const fetchConfig = getBqueryConfig().fetch;
  const parseAs = options.parseAs ?? fetchConfig?.parseAs ?? 'json';
  const fetcher = options.fetcher ?? fetch;
  const validateStatus = options.validateStatus ?? DEFAULT_VALIDATE_STATUS;

  let currentAbortController: AbortController | null = null;
  const normalizeAbortLikeError = (reason: unknown, didTimeout: boolean): Error => {
    const isTimeout =
      didTimeout ||
      isTimeoutDomException(reason) ||
      isTimeoutDomException(currentAbortController?.signal.reason);

    return Object.assign(
      new Error(isTimeout ? `Request timeout of ${options.timeout}ms exceeded` : 'Request aborted'),
      { code: isTimeout ? 'TIMEOUT' : 'ABORT' }
    );
  };

  const state = useAsyncData<TResponse, TData>(async () => {
    const requestInput = resolveInput(input);
    const requestUrl =
      typeof requestInput === 'string' || requestInput instanceof URL
        ? toUrl(requestInput, options.baseUrl ?? fetchConfig?.baseUrl)
        : requestInput instanceof Request && options.query
          ? new URL(requestInput.url)
          : null;

    if (requestUrl && options.query) {
      appendQuery(requestUrl, options.query);
    }

    const baseHeaders = toHeaders(
      fetchConfig?.headers,
      requestInput instanceof Request ? requestInput.headers : undefined,
      options.headers
    );
    const bodyProvided = options.body != null;
    const explicitMethod = normalizeMethod(options.method);
    const method = resolveMethod(explicitMethod, requestInput, bodyProvided);
    const bodylessMethod = method === 'GET' || method === 'HEAD' ? method : null;
    if (bodyProvided && bodylessMethod) {
      throw new Error(`Cannot send a request body with ${bodylessMethod} requests`);
    }
    const requestInitMethod = resolveRequestInitMethod(explicitMethod, requestInput, method);
    const retryConfig = normalizeRetryConfig(options.retry);
    const maxAttempts = (retryConfig?.count ?? 0) + 1;

    // Abort controller: compose timeout + external signal + manual abort
    const abortController = new AbortController();
    currentAbortController = abortController;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let didTimeout = false;
    let externalAbortHandler: (() => void) | undefined;

    if (options.signal) {
      if (options.signal.aborted) {
        abortController.abort(options.signal.reason);
      } else {
        externalAbortHandler = () => abortController.abort(options.signal?.reason);
        options.signal.addEventListener('abort', externalAbortHandler, { once: true });
      }
    }

    if (options.timeout && options.timeout > 0) {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        abortController.abort(new DOMException('Request timeout', 'TimeoutError'));
      }, options.timeout);
    }

    const baseRequestInit: Omit<RequestInit, 'body' | 'signal'> = {
      ...options,
      method: requestInitMethod,
      headers: baseHeaders,
    };

    delete (baseRequestInit as Partial<UseFetchOptions>).baseUrl;
    delete (baseRequestInit as Partial<UseFetchOptions>).query;
    delete (baseRequestInit as Partial<UseFetchOptions>).parseAs;
    delete (baseRequestInit as Partial<UseFetchOptions>).fetcher;
    delete (baseRequestInit as Partial<UseFetchOptions>).defaultValue;
    delete (baseRequestInit as Partial<UseFetchOptions>).immediate;
    delete (baseRequestInit as Partial<UseFetchOptions>).watch;
    delete (baseRequestInit as Partial<UseFetchOptions>).transform;
    delete (baseRequestInit as Partial<UseFetchOptions>).onSuccess;
    delete (baseRequestInit as Partial<UseFetchOptions>).onError;
    delete (baseRequestInit as Partial<UseFetchOptions>).timeout;
    delete (baseRequestInit as Partial<UseFetchOptions>).retry;
    delete (baseRequestInit as Partial<UseFetchOptions>).validateStatus;

    let requestTarget: Request | string | URL = requestUrl ?? requestInput;
    if (
      requestInput instanceof Request &&
      requestUrl &&
      requestUrl.toString() !== requestInput.url
    ) {
      requestTarget = new Request(requestUrl.toString(), toRequestInit(requestInput));
    }

    const createAttemptRequestInit = (): RequestInit => {
      const headers = new Headers(baseHeaders);
      return {
        ...baseRequestInit,
        headers,
        body: serializeBody(options.body, headers),
        signal: abortController.signal,
      };
    };

    if (
      maxAttempts > 1 &&
      typeof ReadableStream !== 'undefined' &&
      options.body instanceof ReadableStream
    ) {
      throw new Error('Cannot retry requests with ReadableStream bodies');
    }

    if (
      maxAttempts > 1 &&
      typeof Request !== 'undefined' &&
      requestTarget instanceof Request &&
      requestTarget.body !== null
    ) {
      throw new Error('Cannot retry requests with non-replayable Request bodies');
    }
    let lastError: Error | undefined;

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const response = await fetcher(requestTarget, createAttemptRequestInit());

          if (!validateStatus(response.status)) {
            throw Object.assign(new Error(`Request failed with status ${response.status}`), {
              response,
              status: response.status,
              statusText: response.statusText,
            });
          }

          return await parseResponse<TResponse>(response, parseAs);
        } catch (error) {
          const normalizedError =
            error instanceof Error ? error : new Error(String(error));

          // Abort errors should not be retried
          if (
            abortController.signal.aborted ||
            isAbortDomException(normalizedError) ||
            isTimeoutDomException(normalizedError)
          ) {
            throw normalizeAbortLikeError(
              abortController.signal.aborted ? abortController.signal.reason : normalizedError,
              didTimeout
            );
          }

          lastError = normalizedError;

          const shouldRetry = retryConfig
            ? (retryConfig.retryOn ?? DEFAULT_RETRY_ON)(normalizedError, attempt)
            : false;

          if (!shouldRetry || attempt >= maxAttempts - 1) {
            throw normalizedError;
          }

          await sleepWithSignal(
            resolveRetryDelay(retryConfig!.delay, attempt),
            abortController.signal
          );
        }
      }

      throw lastError!;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (options.signal && externalAbortHandler) {
        options.signal.removeEventListener('abort', externalAbortHandler);
      }
      if (currentAbortController === abortController) {
        currentAbortController = null;
      }
    }
  }, options);

  // Override abort with real abort logic
  state.abort = (): void => {
    if (currentAbortController) {
      currentAbortController.abort(new DOMException('Request aborted', 'AbortError'));
    }
  };

  return state;
};

/**
 * Create a preconfigured useFetch() helper.
 *
 * @param defaults - Default request options merged into every useFetch() call
 * @returns A useFetch-compatible function with merged defaults
 *
 * @example
 * ```ts
 * const useApiFetch = createUseFetch({ baseUrl: 'https://api.example.com' });
 * const profile = useApiFetch('/profile');
 * ```
 */
/** Overload for factories without a configured transform, preserving per-call `TResponse -> TData` inference. */
export function createUseFetch<TDefaultResponse = unknown>(
  defaults?: UseFetchOptions<TDefaultResponse, TDefaultResponse>
): <TResponse = TDefaultResponse, TData = TResponse>(
  input: FetchInput,
  options?: UseFetchOptions<TResponse, TData>
) => AsyncDataState<TData>;

/** Overload for factories with a configured transform, preserving the transformed factory data type by default. */
export function createUseFetch<TDefaultResponse = unknown, TDefaultData = TDefaultResponse>(
  defaults: UseFetchOptions<TDefaultResponse, TDefaultData>
): <TResponse = TDefaultResponse, TData = TDefaultData>(
  input: FetchInput,
  options?: UseFetchOptions<TResponse, TData>
) => AsyncDataState<TData>;

export function createUseFetch<TDefaultResponse = unknown, TDefaultData = TDefaultResponse>(
  defaults: UseFetchOptions<TDefaultResponse, TDefaultData> = {}
) {
  return <TResponse = TDefaultResponse, TData = TDefaultData>(
    input: FetchInput,
    options: UseFetchOptions<TResponse, TData> = {}
  ): AsyncDataState<TData> => {
    const resolvedDefaults = defaults as unknown as UseFetchOptions<TResponse, TData>;
    const mergedQuery = merge({}, resolvedDefaults.query ?? {}, options.query ?? {}) as Record<
      string,
      unknown
    >;

    return useFetch<TResponse, TData>(input, {
      ...resolvedDefaults,
      ...options,
      headers: toHeaders(resolvedDefaults.headers, options.headers),
      query: Object.keys(mergedQuery).length > 0 ? mergedQuery : undefined,
    });
  };
}

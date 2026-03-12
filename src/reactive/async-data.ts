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
  /** Clear data, error, and status back to the initial state. */
  clear: () => void;
  /** Dispose reactive watchers and prevent future executions. */
  dispose: () => void;
}

/** Options for useFetch(). */
export interface UseFetchOptions<TResponse = unknown, TData = TResponse>
  extends UseAsyncDataOptions<TResponse, TData>,
    Omit<RequestInit, 'body' | 'headers'> {
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
  const requestMethod = requestInput instanceof Request ? normalizeMethod(requestInput.method) : undefined;
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
    clear,
    dispose,
  };
};

/**
 * Reactive fetch composable using the browser Fetch API.
 *
 * @template TResponse - Raw parsed response type
 * @template TData - Stored response type after optional transformation
 * @param input - Request URL, Request object, or lazy input factory
 * @param options - Request and reactive state options
 * @returns Reactive fetch state with execute(), refresh(), and clear()
 *
 * @example
 * ```ts
 * const users = useFetch<{ id: number; name: string }[]>('/api/users');
 * ```
 */
export const useFetch = <TResponse = unknown, TData = TResponse>(
  input: FetchInput,
  options: UseFetchOptions<TResponse, TData> = {}
): AsyncDataState<TData> => {
  const fetchConfig = getBqueryConfig().fetch;
  const parseAs = options.parseAs ?? fetchConfig?.parseAs ?? 'json';
  const fetcher = options.fetcher ?? fetch;

  return useAsyncData<TResponse, TData>(async () => {
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

    const headers = toHeaders(
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
    const requestInit: RequestInit = {
      ...options,
      method: requestInitMethod,
      headers,
      body: serializeBody(options.body, headers),
    };

    delete (requestInit as Partial<UseFetchOptions>).baseUrl;
    delete (requestInit as Partial<UseFetchOptions>).query;
    delete (requestInit as Partial<UseFetchOptions>).parseAs;
    delete (requestInit as Partial<UseFetchOptions>).fetcher;
    delete (requestInit as Partial<UseFetchOptions>).defaultValue;
    delete (requestInit as Partial<UseFetchOptions>).immediate;
    delete (requestInit as Partial<UseFetchOptions>).watch;
    delete (requestInit as Partial<UseFetchOptions>).transform;
    delete (requestInit as Partial<UseFetchOptions>).onSuccess;
    delete (requestInit as Partial<UseFetchOptions>).onError;

    let requestTarget: Request | string | URL = requestUrl ?? requestInput;
    if (requestInput instanceof Request && requestUrl && requestUrl.toString() !== requestInput.url) {
      // Rebuild Request inputs when query params changed so the updated URL is preserved.
      // String/URL inputs already use `requestUrl` directly, so only Request objects need rebuilding.
      requestTarget = new Request(requestUrl.toString(), toRequestInit(requestInput));
    }
    const response = await fetcher(requestTarget, requestInit);

    if (!response.ok) {
      throw Object.assign(new Error(`Request failed with status ${response.status}`), {
        response,
        status: response.status,
        statusText: response.statusText,
      });
    }

    return parseResponse<TResponse>(response, parseAs);
  }, options);
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

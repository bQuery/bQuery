/**
 * Imperative HTTP client with Axios-like API, interceptors, retry, timeout,
 * cancellation, and progress tracking — built on the native Fetch API.
 *
 * @module bquery/reactive
 */

import { merge, isPlainObject } from '../core/utils/object';
import { getBqueryConfig, type BqueryFetchParseAs } from '../platform/config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for automatic request retries. */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3). */
  count: number;
  /** Delay in ms between retries, or a function receiving the attempt index. */
  delay?: number | ((attempt: number) => number);
  /** Predicate deciding whether to retry a given error. Defaults to network / 5xx errors. */
  retryOn?: (error: HttpError, attempt: number) => boolean;
  /** Called before each retry attempt with the error and 1-indexed attempt number. */
  onRetry?: (error: HttpError, attempt: number) => void;
}

/** Progress information emitted during upload or download. */
export interface HttpProgressEvent {
  /** Bytes transferred so far. */
  loaded: number;
  /** Total bytes if known, otherwise 0. */
  total: number;
  /** Percentage between 0 and 100, or `undefined` when total is unknown. */
  percent: number | undefined;
}

/** Full request configuration accepted by the HTTP client. */
export interface HttpRequestConfig extends Omit<RequestInit, 'body' | 'headers' | 'signal'> {
  /** Request URL (resolved against `baseUrl`). */
  url?: string;
  /** Base URL prepended to relative request URLs. */
  baseUrl?: string;
  /** Request headers. */
  headers?: HeadersInit;
  /** Query parameters appended to the URL. */
  query?: Record<string, unknown>;
  /** Request body — plain objects/arrays are JSON-serialised automatically. */
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  /** Request timeout in milliseconds. 0 means no timeout (default). */
  timeout?: number;
  /** Response parsing strategy. */
  parseAs?: BqueryFetchParseAs;
  /** Custom status validation. Returns `true` for acceptable statuses. Default: `status >= 200 && status < 300`. */
  validateStatus?: (status: number) => boolean;
  /** Custom fetch implementation for testing or adapters. */
  fetcher?: typeof fetch;
  /** External `AbortSignal` for request cancellation. */
  signal?: AbortSignal;
  /** Retry configuration. Pass a number for simple retry count, or a `RetryConfig` object. */
  retry?: number | RetryConfig;
  /** Called repeatedly as response body chunks arrive. */
  onDownloadProgress?: (event: HttpProgressEvent) => void;
}

/** Structured HTTP response returned by every client method. */
export interface HttpResponse<T = unknown> {
  /** Parsed response data. */
  data: T;
  /** HTTP status code. */
  status: number;
  /** HTTP status text. */
  statusText: string;
  /** Response headers. */
  headers: Headers;
  /** Resolved request configuration used for this call. */
  config: HttpRequestConfig;
}

/** Error subclass thrown on failed HTTP requests with rich metadata. */
export class HttpError extends Error {
  /** HTTP response (available when the server replied). */
  response?: HttpResponse;
  /** Resolved request configuration. */
  config: HttpRequestConfig;
  /** Original error code string (e.g. `'TIMEOUT'`, `'ABORT'`, `'NETWORK'`). */
  code: string;

  constructor(message: string, config: HttpRequestConfig, code: string, response?: HttpResponse) {
    super(message);
    this.name = 'HttpError';
    this.config = config;
    this.code = code;
    this.response = response;
  }
}

// ---------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------

/** Single interceptor handler pair. */
export interface Interceptor<T> {
  fulfilled?: (value: T) => T | Promise<T>;
  rejected?: (error: unknown) => unknown;
}

/** Manager for adding and removing interceptors. */
export interface InterceptorManager<T> {
  /** Register an interceptor. Returns a numeric id for later removal via `eject()`. */
  use(fulfilled?: (value: T) => T | Promise<T>, rejected?: (error: unknown) => unknown): number;
  /** Remove a previously registered interceptor by id. */
  eject(id: number): void;
  /** Remove all interceptors. */
  clear(): void;
}

/** @internal */
interface InterceptorEntry<T> {
  id: number;
  fulfilled?: (value: T) => T | Promise<T>;
  rejected?: (error: unknown) => unknown;
}

/** @internal */
function createInterceptorManager<T>(): InterceptorManager<T> & {
  /** @internal */ forEach(fn: (entry: InterceptorEntry<T>) => void): void;
} {
  const entries: Array<InterceptorEntry<T> | null> = [];
  let nextId = 0;

  return {
    use(fulfilled, rejected) {
      const id = nextId++;
      entries.push({ id, fulfilled, rejected });
      return id;
    },
    eject(id) {
      const index = entries.findIndex((e) => e?.id === id);
      if (index !== -1) entries[index] = null;
    },
    clear() {
      entries.length = 0;
    },
    forEach(fn) {
      for (const entry of entries) {
        if (entry) fn(entry);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// HttpClient interface
// ---------------------------------------------------------------------------

/** Imperative HTTP client with interceptors and convenience method shortcuts. */
export interface HttpClient {
  /** Send a request using the provided configuration. */
  request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
  /** Send a GET request. */
  get<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  /** Send a POST request. */
  post<T = unknown>(
    url: string,
    body?: HttpRequestConfig['body'],
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>>;
  /** Send a PUT request. */
  put<T = unknown>(
    url: string,
    body?: HttpRequestConfig['body'],
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>>;
  /** Send a PATCH request. */
  patch<T = unknown>(
    url: string,
    body?: HttpRequestConfig['body'],
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>>;
  /** Send a DELETE request. */
  delete<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  /** Send a HEAD request. */
  head<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  /** Send an OPTIONS request. */
  options<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  /** Request and response interceptors. */
  interceptors: {
    request: InterceptorManager<HttpRequestConfig>;
    response: InterceptorManager<HttpResponse>;
  };
  /** The merged default configuration used by this client. */
  defaults: HttpRequestConfig;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_VALIDATE_STATUS = (status: number): boolean => status >= 200 && status < 300;

const DEFAULT_RETRY_ON = (error: HttpError): boolean => {
  if (error.code === 'PARSE') return false;
  if (error.code === 'TIMEOUT' || error.code === 'NETWORK') return true;
  const status = error.response?.status;
  return status !== undefined && status >= 500;
};

/** @internal */
const normalizeRetry = (retry: HttpRequestConfig['retry']): RetryConfig | undefined => {
  if (retry == null) return undefined;
  if (typeof retry === 'number') return { count: retry };
  return retry;
};

/** @internal */
const resolveRetryDelay = (delay: RetryConfig['delay'], attempt: number): number => {
  if (delay == null) return Math.min(1000 * 2 ** attempt, 30_000);
  if (typeof delay === 'number') return delay;
  return delay(attempt);
};

/** @internal */
const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });

/** @internal */
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

/** @internal */
const isBodyLike = (value: unknown): value is BodyInit => {
  if (typeof value === 'string') return true;
  if (value instanceof Blob || value instanceof FormData || value instanceof URLSearchParams) {
    return true;
  }
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return true;
  if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) return true;
  return typeof value === 'object' && value !== null && ArrayBuffer.isView(value);
};

/** @internal */
const serializeBody = (
  body: HttpRequestConfig['body'],
  headers: Headers
): BodyInit | null | undefined => {
  if (body == null) return body;
  if (isBodyLike(body)) return body;
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return JSON.stringify(body);
};

/** @internal */
const appendQuery = (url: URL, query: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.set(key, String(value));
  }
};

/** @internal */
const buildUrl = (url: string, baseUrl?: string): URL => {
  const runtimeBase =
    typeof window !== 'undefined' && /^https?:/i.test(window.location.href)
      ? window.location.href
      : 'http://localhost';
  const base = baseUrl ? new URL(baseUrl, runtimeBase).toString() : runtimeBase;
  return new URL(url, base);
};

/** @internal */
const parseResponseBody = async <T>(
  response: Response,
  parseAs: BqueryFetchParseAs,
  config: HttpRequestConfig
): Promise<T> => {
  if (parseAs === 'response') return response as T;
  if (parseAs === 'text') return (await response.text()) as T;
  if (parseAs === 'blob') return (await response.blob()) as T;
  if (parseAs === 'arrayBuffer') return (await response.arrayBuffer()) as T;
  if (parseAs === 'formData') return (await response.formData()) as T;

  const text = await response.text();
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch (parseError) {
    const detail = response.url ? ` for ${response.url}` : '';
    throw new HttpError(
      `Failed to parse JSON response${detail} (status ${response.status}): ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      config,
      'PARSE',
      {
        data: text,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config,
      }
    );
  }
};

/** @internal – wrap a response body stream to report download progress. */
const wrapDownloadStream = (
  response: Response,
  onProgress: (event: HttpProgressEvent) => void
): Response => {
  const body = response.body;
  if (!body) return response;

  const total = parseInt(response.headers.get('content-length') ?? '0', 10) || 0;
  let loaded = 0;

  const reader = body.getReader();
  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      loaded += value.byteLength;
      onProgress({
        loaded,
        total,
        percent: total > 0 ? Math.round((loaded / total) * 100) : undefined,
      });
      controller.enqueue(value);
    },
    cancel(reason) {
      reader.cancel(reason);
    },
  });

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

// ---------------------------------------------------------------------------
// Core request execution
// ---------------------------------------------------------------------------

/** @internal Execute a single HTTP request (no retry/interceptor logic). */
const executeRequest = async <T>(config: HttpRequestConfig): Promise<HttpResponse<T>> => {
  const fetchConfig = getBqueryConfig().fetch;
  const parseAs = config.parseAs ?? fetchConfig?.parseAs ?? 'json';
  const fetcher = config.fetcher ?? fetch;
  const validateStatus = config.validateStatus ?? DEFAULT_VALIDATE_STATUS;

  const urlString = config.url ?? '/';
  const url = buildUrl(urlString, config.baseUrl ?? fetchConfig?.baseUrl);

  if (config.query) {
    appendQuery(url, config.query);
  }

  const headers = toHeaders(fetchConfig?.headers, config.headers);
  const serializedBody = serializeBody(config.body, headers);

  // Build RequestInit, omitting non-standard keys
  const requestInit: RequestInit = {};
  if (config.method) requestInit.method = config.method.toUpperCase();
  requestInit.headers = headers;
  if (serializedBody != null) requestInit.body = serializedBody;
  if (config.cache) requestInit.cache = config.cache;
  if (config.credentials) requestInit.credentials = config.credentials;
  if (config.integrity) requestInit.integrity = config.integrity;
  if (config.keepalive !== undefined) requestInit.keepalive = config.keepalive;
  if (config.mode) requestInit.mode = config.mode;
  if (config.redirect) requestInit.redirect = config.redirect;
  if (config.referrer) requestInit.referrer = config.referrer;
  if (config.referrerPolicy) requestInit.referrerPolicy = config.referrerPolicy;

  // Abort / timeout
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let mergedSignal: AbortSignal | undefined = config.signal;
  let externalAbortHandler: (() => void) | undefined;

  if (config.timeout && config.timeout > 0) {
    const controller = new AbortController();

    if (config.signal) {
      // Compose: abort when *either* the external signal or the timeout fires
      externalAbortHandler = () => controller.abort(config.signal?.reason);
      config.signal.addEventListener('abort', externalAbortHandler, { once: true });
    }

    timeoutId = setTimeout(() => {
      controller.abort(new DOMException('Request timeout', 'TimeoutError'));
    }, config.timeout);

    mergedSignal = controller.signal;
  }

  if (mergedSignal) requestInit.signal = mergedSignal;

  try {
    let response = await fetcher(url.toString(), requestInit);

    if (config.onDownloadProgress) {
      response = wrapDownloadStream(response, config.onDownloadProgress);
    }

    if (!validateStatus(response.status)) {
      throw new HttpError(
        `Request failed with status ${response.status}`,
        config,
        'ERR_BAD_RESPONSE',
        {
          data: undefined,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          config,
        }
      );
    }

    const data = await parseResponseBody<T>(response, parseAs, config);

    const httpResponse: HttpResponse<T> = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config,
    };

    return httpResponse;
  } catch (error) {
    if (error instanceof HttpError) throw error;

    if (error instanceof DOMException) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        const isTimeout =
          error.name === 'TimeoutError' || error.message === 'Request timeout';
        throw new HttpError(
          isTimeout ? `Request timeout of ${config.timeout}ms exceeded` : 'Request aborted',
          config,
          isTimeout ? 'TIMEOUT' : 'ABORT'
        );
      }
    }

    throw new HttpError(
      error instanceof Error ? error.message : String(error),
      config,
      'NETWORK'
    );
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (config.signal && externalAbortHandler) {
      config.signal.removeEventListener('abort', externalAbortHandler);
    }
  }
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a preconfigured HTTP client instance with interceptors.
 *
 * @param defaults - Default request configuration merged into every request
 * @returns An `HttpClient` with `.get()`, `.post()`, `.put()`, `.patch()`, `.delete()`, `.head()`, `.options()`
 *
 * @example
 * ```ts
 * import { createHttp } from '@bquery/bquery/reactive';
 *
 * const api = createHttp({
 *   baseUrl: 'https://api.example.com',
 *   headers: { authorization: 'Bearer token' },
 *   timeout: 10_000,
 * });
 *
 * api.interceptors.request.use((config) => {
 *   config.headers = { ...Object.fromEntries(new Headers(config.headers)), 'x-req-id': crypto.randomUUID() };
 *   return config;
 * });
 *
 * const { data } = await api.get<User[]>('/users');
 * ```
 */
export function createHttp(defaults: HttpRequestConfig = {}): HttpClient {
  const requestInterceptors = createInterceptorManager<HttpRequestConfig>();
  const responseInterceptors = createInterceptorManager<HttpResponse>();

  const mergeConfig = (perCall: HttpRequestConfig): HttpRequestConfig => {
    const mergedQuery = merge(
      {},
      defaults.query ?? {},
      perCall.query ?? {}
    ) as Record<string, unknown>;

    return {
      ...defaults,
      ...perCall,
      headers: toHeaders(defaults.headers, perCall.headers),
      query: Object.keys(mergedQuery).length > 0 ? mergedQuery : undefined,
    };
  };

  const dispatchRequest = async <T>(config: HttpRequestConfig): Promise<HttpResponse<T>> => {
    // Run request interceptors
    let resolvedConfig = config;
    const requestChain: Array<InterceptorEntry<HttpRequestConfig>> = [];
    requestInterceptors.forEach((entry) => requestChain.push(entry));

    for (const { fulfilled, rejected } of requestChain) {
      try {
        if (fulfilled) {
          resolvedConfig = await fulfilled(resolvedConfig);
        }
      } catch (err) {
        if (rejected) {
          const result = await rejected(err);
          if (isPlainObject(result)) {
            resolvedConfig = result as unknown as HttpRequestConfig;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    // Execute with retry
    const retryConfig = normalizeRetry(resolvedConfig.retry);
    let lastError: HttpError | undefined;

    const maxAttempts = (retryConfig?.count ?? 0) + 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        let response = await executeRequest<T>(resolvedConfig);

        // Run response interceptors
        const responseChain: Array<InterceptorEntry<HttpResponse>> = [];
        responseInterceptors.forEach((entry) => responseChain.push(entry));

        for (const { fulfilled, rejected } of responseChain) {
          try {
            if (fulfilled) {
              response = (await fulfilled(response as HttpResponse)) as HttpResponse<T>;
            }
          } catch (err) {
            if (rejected) {
              const result = await rejected(err);
              if (result && typeof result === 'object' && 'data' in result) {
                response = result as HttpResponse<T>;
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }
        }

        return response;
      } catch (error) {
        const httpError =
          error instanceof HttpError
            ? error
            : new HttpError(
                error instanceof Error ? error.message : String(error),
                resolvedConfig,
                'NETWORK'
              );

        lastError = httpError;

        const shouldRetry = retryConfig
          ? (retryConfig.retryOn ?? DEFAULT_RETRY_ON)(httpError, attempt)
          : false;

        if (!shouldRetry || attempt >= maxAttempts - 1) {
          // Run response error interceptors before throwing
          const responseChain: Array<InterceptorEntry<HttpResponse>> = [];
          responseInterceptors.forEach((entry) => responseChain.push(entry));

          let finalError: unknown = httpError;
          for (const { rejected } of responseChain) {
            if (rejected) {
              try {
                const result = await rejected(finalError);
                if (result && typeof result === 'object' && 'data' in result) {
                  return result as HttpResponse<T>;
                }
                if (result != null) {
                  finalError = result;
                }
              } catch (innerErr) {
                if (innerErr != null) {
                  finalError = innerErr;
                }
              }
            }
          }

          if (!(finalError instanceof Error)) {
            finalError = httpError;
          }

          throw finalError;
        }

        const retryDelay = retryConfig ? resolveRetryDelay(retryConfig.delay, attempt) : 0;
        retryConfig?.onRetry?.(httpError, attempt + 1);
        await sleep(retryDelay, resolvedConfig.signal);
      }
    }

    throw lastError!;
  };

  const request = <T>(config: HttpRequestConfig): Promise<HttpResponse<T>> =>
    dispatchRequest<T>(mergeConfig(config));

  const client: HttpClient = {
    request,
    get: <T>(url: string, config: HttpRequestConfig = {}) =>
      request<T>({ ...config, url, method: 'GET' }),
    post: <T>(url: string, body?: HttpRequestConfig['body'], config: HttpRequestConfig = {}) =>
      request<T>({ ...config, url, method: 'POST', body }),
    put: <T>(url: string, body?: HttpRequestConfig['body'], config: HttpRequestConfig = {}) =>
      request<T>({ ...config, url, method: 'PUT', body }),
    patch: <T>(url: string, body?: HttpRequestConfig['body'], config: HttpRequestConfig = {}) =>
      request<T>({ ...config, url, method: 'PATCH', body }),
    delete: <T>(url: string, config: HttpRequestConfig = {}) =>
      request<T>({ ...config, url, method: 'DELETE' }),
    head: <T>(url: string, config: HttpRequestConfig = {}) =>
      request<T>({ ...config, url, method: 'HEAD' }),
    options: <T>(url: string, config: HttpRequestConfig = {}) =>
      request<T>({ ...config, url, method: 'OPTIONS' }),
    interceptors: {
      request: requestInterceptors,
      response: responseInterceptors,
    },
    defaults,
  };

  return client;
}

/**
 * Default HTTP client instance using global bQuery fetch config.
 *
 * @example
 * ```ts
 * import { http } from '@bquery/bquery/reactive';
 *
 * const { data } = await http.get<User[]>('/api/users');
 * const { data: created } = await http.post('/api/users', { name: 'Ada' });
 * ```
 */
export const http: HttpClient = createHttp();

// ---------------------------------------------------------------------------
// Request Queue
// ---------------------------------------------------------------------------

/** Options for `createRequestQueue()`. */
export interface RequestQueueOptions {
  /** Maximum number of concurrent in-flight requests (default: 6). */
  concurrency?: number;
}

/** A queued request entry. */
interface QueueEntry<T = unknown> {
  execute: () => Promise<HttpResponse<T>>;
  resolve: (value: HttpResponse<T>) => void;
  reject: (reason: unknown) => void;
}

/** Return value of `createRequestQueue()`. */
export interface RequestQueue {
  /** Enqueue a request. Returns a promise that resolves when the request completes. */
  add: <T = unknown>(execute: () => Promise<HttpResponse<T>>) => Promise<HttpResponse<T>>;
  /** Number of requests currently being processed. */
  readonly pending: number;
  /** Number of requests waiting in the queue. */
  readonly size: number;
  /** Remove all pending (not yet started) requests from the queue. Their promises will reject. */
  clear: () => void;
}

/**
 * Create a request queue with a concurrency limit.
 *
 * Useful for rate-limiting parallel HTTP requests (e.g. browser connection limits,
 * API throttling) while maintaining a simple promise-based interface.
 *
 * @param options - Queue configuration
 * @returns A `RequestQueue` with `.add()`, `.clear()`, `.pending`, and `.size`
 *
 * @example
 * ```ts
 * import { createRequestQueue, createHttp } from '@bquery/bquery/reactive';
 *
 * const api = createHttp({ baseUrl: 'https://api.example.com' });
 * const queue = createRequestQueue({ concurrency: 3 });
 *
 * // These will run at most 3 at a time
 * const results = await Promise.all(
 *   ids.map(id => queue.add(() => api.get(`/items/${id}`)))
 * );
 * ```
 */
export function createRequestQueue(options: RequestQueueOptions = {}): RequestQueue {
  const { concurrency = 6 } = options;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('Request queue concurrency must be a positive integer');
  }
  const queue: Array<QueueEntry> = [];
  let running = 0;

  const drain = (): void => {
    while (running < concurrency && queue.length > 0) {
      const entry = queue.shift()!;
      running++;
      Promise.resolve()
        .then(entry.execute)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          running--;
          drain();
        });
    }
  };

  return {
    add<T = unknown>(execute: () => Promise<HttpResponse<T>>): Promise<HttpResponse<T>> {
      return new Promise<HttpResponse<T>>((resolve, reject) => {
        queue.push({
          execute: execute as () => Promise<HttpResponse>,
          resolve: resolve as (value: HttpResponse) => void,
          reject,
        });
        drain();
      });
    },
    get pending() {
      return running;
    },
    get size() {
      return queue.length;
    },
    clear() {
      const cleared = queue.splice(0);
      for (const entry of cleared) {
        entry.reject(new Error('Request queue cleared'));
      }
    },
  };
}

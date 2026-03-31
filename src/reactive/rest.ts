/**
 * REST resource composable for CRUD operations with optimistic updates,
 * form submission, and reactive caching built on the bQuery fetch layer.
 *
 * @module bquery/reactive
 */

import { computed } from './computed';
import { Signal, signal } from './core';
import {
  useFetch,
  type AsyncDataStatus,
  type UseFetchOptions,
} from './async-data';
import {
  createHttp,
  type HttpClient,
  type HttpRequestConfig,
  type HttpResponse,
} from './http';

// ---------------------------------------------------------------------------
// useResource — full CRUD composable
// ---------------------------------------------------------------------------

/** HTTP method shortcuts available on a resource. */
export interface ResourceActions<T> {
  /** Fetch the resource (GET). */
  fetch: () => Promise<T | undefined>;
  /** Create a new item (POST). */
  create: (body: Partial<T> | Record<string, unknown>) => Promise<T | undefined>;
  /** Replace the resource (PUT). */
  update: (body: Partial<T> | Record<string, unknown>) => Promise<T | undefined>;
  /** Partially update the resource (PATCH). */
  patch: (body: Partial<T> | Record<string, unknown>) => Promise<T | undefined>;
  /** Delete the resource (DELETE). */
  remove: () => Promise<void>;
}

/** Options for `useResource()`. */
export interface UseResourceOptions<T = unknown>
  extends Omit<UseFetchOptions<T>, 'method' | 'body'> {
  /** Enable optimistic updates for mutating operations (default: false). */
  optimistic?: boolean;
  /** Called after any successful mutation (create / update / patch / remove). */
  onMutationSuccess?: (data: T | undefined, action: string) => void;
  /** Called after a failed mutation, receives the rolled-back value for optimistic updates. */
  onMutationError?: (error: Error, action: string) => void;
}

/** Return value of `useResource()`. */
export interface UseResourceReturn<T> {
  /** Reactive resource data. */
  data: Signal<T | undefined>;
  /** Last error. */
  error: Signal<Error | null>;
  /** Lifecycle status for the initial fetch. */
  status: Signal<AsyncDataStatus>;
  /** Whether the initial fetch is pending. */
  pending: { readonly value: boolean; peek(): boolean };
  /** Whether any mutation is in progress. */
  isMutating: { readonly value: boolean; peek(): boolean };
  /** CRUD actions. */
  actions: ResourceActions<T>;
  /** Refresh the resource (re-GET). */
  refresh: () => Promise<T | undefined>;
  /** Clear data, error, and status. */
  clear: () => void;
  /** Dispose all reactive state and prevent future operations. */
  dispose: () => void;
}

/**
 * Reactive REST resource composable providing CRUD operations.
 *
 * Binds a base URL to a resource and exposes `fetch`, `create`, `update`,
 * `patch`, and `remove` helpers with optional optimistic updates.
 *
 * @template T - Resource data type
 * @param url - Resource endpoint URL or getter
 * @param options - Fetch and resource options
 * @returns Reactive resource state with CRUD actions
 *
 * @example
 * ```ts
 * import { useResource } from '@bquery/bquery/reactive';
 *
 * const user = useResource<User>('/api/users/1', {
 *   baseUrl: 'https://api.example.com',
 *   optimistic: true,
 * });
 *
 * // Read
 * await user.actions.fetch();
 *
 * // Update
 * await user.actions.patch({ name: 'Ada' });
 *
 * // Delete
 * await user.actions.remove();
 * ```
 */
export const useResource = <T = unknown>(
  url: string | URL | (() => string | URL),
  options: UseResourceOptions<T> = {}
): UseResourceReturn<T> => {
  const {
    optimistic = false,
    onMutationSuccess,
    onMutationError,
    ...fetchOptions
  } = options;

  // Internal fetch state for the GET
  const fetchState = useFetch<T>(url, {
    ...fetchOptions,
  });

  const mutating = signal(false);
  const isMutating = computed(() => mutating.value);

  let disposed = false;

  const resolveUrl = (): string => {
    const resolved = typeof url === 'function' ? url() : url;
    return resolved instanceof URL ? resolved.toString() : resolved;
  };

  const executeMutation = async (
    action: string,
    method: string,
    body?: Partial<T> | Record<string, unknown>,
    optimisticData?: T | undefined
  ): Promise<T | undefined> => {
    if (disposed) return fetchState.data.peek();

    const previousData = fetchState.data.peek();

    // Optimistic update
    if (optimistic && optimisticData !== undefined) {
      fetchState.data.value = optimisticData;
    }

    mutating.value = true;
    fetchState.error.value = null;

    try {
      const mutationState = useFetch<T>(resolveUrl(), {
        ...fetchOptions,
        method,
        body: body ?? undefined,
        immediate: false,
        watch: undefined,
      });

      const result = await mutationState.execute();
      const mutationError = mutationState.error.peek();
      mutationState.dispose();

      if (disposed) return fetchState.data.peek();

      // Check if the inner fetch encountered an error
      if (mutationError) {
        // Rollback on optimistic failure
        if (optimistic && optimisticData !== undefined) {
          fetchState.data.value = previousData;
        }

        fetchState.error.value = mutationError;
        fetchState.status.value = 'error';
        mutating.value = false;
        onMutationError?.(mutationError, action);
        return fetchState.data.peek();
      }

      // For non-DELETE mutations, update data with server response
      if (method !== 'DELETE' && result !== undefined) {
        fetchState.data.value = result;
      }

      mutating.value = false;
      fetchState.status.value = 'success';
      onMutationSuccess?.(result, action);
      return result;
    } catch (caught) {
      if (disposed) return fetchState.data.peek();

      // Rollback on optimistic failure
      if (optimistic && optimisticData !== undefined) {
        fetchState.data.value = previousData;
      }

      const normalizedError = caught instanceof Error ? caught : new Error(String(caught));
      fetchState.error.value = normalizedError;
      fetchState.status.value = 'error';
      mutating.value = false;
      onMutationError?.(normalizedError, action);
      return fetchState.data.peek();
    }
  };

  const actions: ResourceActions<T> = {
    fetch: () => fetchState.execute(),
    create: (body) =>
      executeMutation('create', 'POST', body),
    update: (body) =>
      executeMutation(
        'update',
        'PUT',
        body,
        optimistic ? ({ ...fetchState.data.peek(), ...body } as T) : undefined
      ),
    patch: (body) =>
      executeMutation(
        'patch',
        'PATCH',
        body,
        optimistic ? ({ ...fetchState.data.peek(), ...body } as T) : undefined
      ),
    remove: async () => {
      await executeMutation('remove', 'DELETE');
      if (!disposed) {
        fetchState.data.value = undefined;
      }
    },
  };

  const originalDispose = fetchState.dispose;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    originalDispose();
  };

  return {
    data: fetchState.data,
    error: fetchState.error,
    status: fetchState.status,
    pending: fetchState.pending,
    isMutating,
    actions,
    refresh: fetchState.execute,
    clear: fetchState.clear,
    dispose,
  };
};

// ---------------------------------------------------------------------------
// useSubmit — form submission composable
// ---------------------------------------------------------------------------

/** Options for `useSubmit()`. */
export interface UseSubmitOptions<TResponse = unknown>
  extends Omit<UseFetchOptions<TResponse>, 'body' | 'immediate'> {
  /** HTTP method (default: `'POST'`). */
  method?: string;
}

/** Return value of `useSubmit()`. */
export interface UseSubmitReturn<TResponse = unknown> {
  /** Last response data. */
  data: Signal<TResponse | undefined>;
  /** Last error. */
  error: Signal<Error | null>;
  /** Current status. */
  status: Signal<AsyncDataStatus>;
  /** Whether the submission is pending. */
  pending: { readonly value: boolean; peek(): boolean };
  /** Submit data to the endpoint. */
  submit: (body: Record<string, unknown> | FormData | BodyInit) => Promise<TResponse | undefined>;
  /** Reset state. */
  clear: () => void;
}

/**
 * Reactive form submission composable.
 *
 * Provides a `submit()` function that sends data to an endpoint with
 * reactive status, data, and error signals.
 *
 * @template TResponse - Response data type
 * @param url - Submission endpoint URL
 * @param options - Fetch options (method defaults to POST)
 * @returns Reactive submission state with `submit()` and `clear()`
 *
 * @example
 * ```ts
 * import { useSubmit } from '@bquery/bquery/reactive';
 *
 * const form = useSubmit<{ id: number }>('/api/users', {
 *   baseUrl: 'https://api.example.com',
 *   headers: { 'x-csrf': token },
 * });
 *
 * const result = await form.submit({ name: 'Ada', email: 'ada@example.com' });
 * console.log(form.status.value); // 'success'
 * ```
 */
export const useSubmit = <TResponse = unknown>(
  url: string | URL,
  options: UseSubmitOptions<TResponse> = {}
): UseSubmitReturn<TResponse> => {
  const { method = 'POST', ...fetchOptions } = options;

  const data = signal<TResponse | undefined>(undefined);
  const error = signal<Error | null>(null);
  const status = signal<AsyncDataStatus>('idle');
  const pending = computed(() => status.value === 'pending');

  const submit = async (
    body: Record<string, unknown> | FormData | BodyInit
  ): Promise<TResponse | undefined> => {
    status.value = 'pending';
    error.value = null;

    try {
      const state = useFetch<TResponse>(url, {
        ...fetchOptions,
        method,
        body: body as UseFetchOptions['body'],
        immediate: false,
        watch: undefined,
      });

      const result = await state.execute();
      const fetchError = state.error.peek();
      state.dispose();

      if (fetchError) {
        error.value = fetchError;
        status.value = 'error';
        return undefined;
      }

      data.value = result;
      status.value = 'success';
      return result;
    } catch (caught) {
      const normalizedError = caught instanceof Error ? caught : new Error(String(caught));
      error.value = normalizedError;
      status.value = 'error';
      return undefined;
    }
  };

  const clear = (): void => {
    data.value = undefined;
    error.value = null;
    status.value = 'idle';
  };

  return {
    data,
    error,
    status,
    pending,
    submit,
    clear,
  };
};

// ---------------------------------------------------------------------------
// createRestClient — imperative REST client
// ---------------------------------------------------------------------------

/** Typed CRUD methods for a REST endpoint. */
export interface RestClient<T = unknown> {
  /** GET all items. */
  list: (config?: HttpRequestConfig) => Promise<HttpResponse<T[]>>;
  /** GET a single item by ID. */
  get: (id: string | number, config?: HttpRequestConfig) => Promise<HttpResponse<T>>;
  /** POST a new item. */
  create: (
    body: Partial<T> | Record<string, unknown>,
    config?: HttpRequestConfig
  ) => Promise<HttpResponse<T>>;
  /** PUT (full replace) an item by ID. */
  update: (
    id: string | number,
    body: Partial<T> | Record<string, unknown>,
    config?: HttpRequestConfig
  ) => Promise<HttpResponse<T>>;
  /** PATCH (partial update) an item by ID. */
  patch: (
    id: string | number,
    body: Partial<T> | Record<string, unknown>,
    config?: HttpRequestConfig
  ) => Promise<HttpResponse<T>>;
  /** DELETE an item by ID. */
  remove: (id: string | number, config?: HttpRequestConfig) => Promise<HttpResponse<void>>;
  /** The underlying HttpClient instance. */
  http: HttpClient;
}

/**
 * Create a typed REST client for a specific API resource.
 *
 * Wraps `createHttp()` and maps standard CRUD operations to their
 * conventional REST endpoints (`GET /`, `GET /:id`, `POST /`, `PUT /:id`,
 * `PATCH /:id`, `DELETE /:id`).
 *
 * @template T - Resource item type
 * @param baseUrl - Base URL of the resource (e.g. `https://api.example.com/users`)
 * @param defaults - Default request configuration merged into every call
 * @returns Typed REST client with `list`, `get`, `create`, `update`, `patch`, `remove`
 *
 * @example
 * ```ts
 * import { createRestClient } from '@bquery/bquery/reactive';
 *
 * interface User { id: number; name: string; email: string }
 *
 * const users = createRestClient<User>('https://api.example.com/users', {
 *   headers: { authorization: '******' },
 *   timeout: 10_000,
 * });
 *
 * const { data: allUsers } = await users.list();
 * const { data: user } = await users.get(1);
 * const { data: created } = await users.create({ name: 'Ada' });
 * await users.update(1, { name: 'Ada', email: 'ada@example.com' });
 * await users.patch(1, { email: 'new@example.com' });
 * await users.remove(1);
 * ```
 */
export const createRestClient = <T = unknown>(
  baseUrl: string,
  defaults: HttpRequestConfig = {}
): RestClient<T> => {
  const httpClient = createHttp({ ...defaults });

  // Ensure the base URL ends without a trailing slash for consistent joining
  const base = baseUrl.replace(/\/+$/, '');

  return {
    list: (config) => httpClient.get<T[]>(base, config),
    get: (id, config) => httpClient.get<T>(`${base}/${encodeURIComponent(String(id))}`, config),
    create: (body, config) =>
      httpClient.post<T>(base, body as HttpRequestConfig['body'], config),
    update: (id, body, config) =>
      httpClient.put<T>(
        `${base}/${encodeURIComponent(String(id))}`,
        body as HttpRequestConfig['body'],
        config
      ),
    patch: (id, body, config) =>
      httpClient.patch<T>(
        `${base}/${encodeURIComponent(String(id))}`,
        body as HttpRequestConfig['body'],
        config
      ),
    remove: (id, config) =>
      httpClient.delete<void>(`${base}/${encodeURIComponent(String(id))}`, config),
    http: httpClient,
  };
};

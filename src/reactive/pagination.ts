/**
 * Pagination and infinite-scroll composables for reactive data fetching.
 *
 * @module bquery/reactive
 */

import { computed } from './computed';
import { Signal, signal } from './core';
import {
  useFetch,
  type AsyncDataState,
  type AsyncDataStatus,
  type UseFetchOptions,
} from './async-data';

// ---------------------------------------------------------------------------
// usePaginatedFetch
// ---------------------------------------------------------------------------

/** Options for usePaginatedFetch(). */
export interface UsePaginatedFetchOptions<TResponse = unknown, TData = TResponse>
  extends UseFetchOptions<TResponse, TData> {
  /** Initial page number (default: 1). */
  initialPage?: number;
}

/** Return value of usePaginatedFetch(). */
export interface PaginatedState<TData> extends AsyncDataState<TData> {
  /** Current page number signal (writable). */
  page: Signal<number>;
  /** Go to the next page. */
  next: () => Promise<TData | undefined>;
  /** Go to the previous page (minimum 1). */
  prev: () => Promise<TData | undefined>;
  /** Jump to a specific page. */
  goTo: (page: number) => Promise<TData | undefined>;
}

/**
 * Reactive paginated fetch composable.
 *
 * Takes a URL factory receiving the current page number, and exposes
 * `page`, `next()`, `prev()`, and `goTo()` helpers alongside the
 * standard `AsyncDataState`.
 *
 * @template TResponse - Raw parsed response type
 * @template TData - Stored response type after optional transformation
 * @param inputFactory - Function that receives the page number and returns a URL string, URL, or Request
 * @param options - Fetch and pagination options
 * @returns Paginated data state
 *
 * @example
 * ```ts
 * import { usePaginatedFetch } from '@bquery/bquery/reactive';
 *
 * const users = usePaginatedFetch<User[]>(
 *   (page) => `/api/users?page=${page}`,
 *   { baseUrl: 'https://api.example.com' }
 * );
 *
 * // Navigate pages
 * await users.next();
 * await users.prev();
 * await users.goTo(5);
 * console.log(users.page.value); // 5
 * ```
 */
export const usePaginatedFetch = <TResponse = unknown, TData = TResponse>(
  inputFactory: (page: number) => string | URL | Request,
  options: UsePaginatedFetchOptions<TResponse, TData> = {}
): PaginatedState<TData> => {
  const { initialPage = 1, ...fetchOptions } = options;
  const page = signal(initialPage);

  const state = useFetch<TResponse, TData>(() => inputFactory(page.value), {
    ...fetchOptions,
    watch: [...(fetchOptions.watch ?? []), page],
  });

  const next = async (): Promise<TData | undefined> => {
    page.value = page.peek() + 1;
    return state.execute();
  };

  const prev = async (): Promise<TData | undefined> => {
    const current = page.peek();
    if (current > 1) {
      page.value = current - 1;
    }
    return state.execute();
  };

  const goTo = async (target: number): Promise<TData | undefined> => {
    page.value = Math.max(1, target);
    return state.execute();
  };

  return {
    ...state,
    page,
    next,
    prev,
    goTo,
  };
};

// ---------------------------------------------------------------------------
// useInfiniteFetch
// ---------------------------------------------------------------------------

/** Options for useInfiniteFetch(). */
export interface UseInfiniteFetchOptions<TResponse = unknown, TData = TResponse, TCursor = number>
  extends Omit<UseFetchOptions<TResponse, TData>, 'transform'> {
  /** Extract the cursor for the next page from a response. */
  getNextCursor: (lastResponse: TResponse, allPages: TResponse[]) => TCursor | undefined;
  /** Transform all accumulated pages into the final data shape. */
  transform?: (pages: TResponse[]) => TData;
  /** Initial cursor value (default: undefined, meaning first page). */
  initialCursor?: TCursor;
}

/** Return value of useInfiniteFetch(). */
export interface InfiniteState<TData, TResponse = unknown> {
  /** All accumulated page data, transformed. */
  data: Signal<TData | undefined>;
  /** Raw accumulated pages. */
  pages: Signal<TResponse[]>;
  /** Last error encountered. */
  error: Signal<Error | null>;
  /** Current lifecycle status. */
  status: Signal<AsyncDataStatus>;
  /** Computed boolean that mirrors `status === 'pending'`. */
  pending: { readonly value: boolean; peek(): boolean };
  /** Whether there are more pages to load. */
  hasMore: { readonly value: boolean; peek(): boolean };
  /** Fetch the next page and append it to the accumulated data. */
  fetchNextPage: () => Promise<TData | undefined>;
  /** Reset all pages and re-fetch from the initial cursor. */
  refresh: () => Promise<TData | undefined>;
  /** Clear all accumulated data. */
  clear: () => void;
  /** Dispose reactive watchers and prevent future executions. */
  dispose: () => void;
}

/**
 * Reactive infinite-scroll / load-more composable.
 *
 * Accumulates pages of data and exposes `fetchNextPage()` to load
 * additional results. Uses a cursor-based approach with `getNextCursor()`
 * to determine pagination.
 *
 * @template TResponse - Raw parsed response type for a single page
 * @template TData - Transformed accumulated data type
 * @template TCursor - Cursor type used for pagination
 * @param inputFactory - Function receiving the cursor and returning a FetchInput
 * @param options - Fetch and infinite-scroll options
 * @returns Infinite data state with fetchNextPage(), hasMore, and accumulated pages
 *
 * @example
 * ```ts
 * import { useInfiniteFetch } from '@bquery/bquery/reactive';
 *
 * const feed = useInfiniteFetch<Post[], Post[]>(
 *   (cursor) => `/api/posts?cursor=${cursor ?? ''}`,
 *   {
 *     getNextCursor: (page) => page.length > 0 ? page[page.length - 1].id : undefined,
 *     transform: (pages) => pages.flat(),
 *     baseUrl: 'https://api.example.com',
 *   }
 * );
 *
 * // Load more pages
 * await feed.fetchNextPage();
 * console.log(feed.data.value); // All accumulated posts
 * console.log(feed.hasMore.value); // true if more pages available
 * ```
 */
export const useInfiniteFetch = <TResponse = unknown, TData = TResponse[], TCursor = number>(
  inputFactory: (cursor: TCursor | undefined) => string | URL | Request,
  options: UseInfiniteFetchOptions<TResponse, TData, TCursor>
): InfiniteState<TData, TResponse> => {
  const {
    getNextCursor,
    transform: transformPages,
    initialCursor,
    immediate = true,
    onSuccess: _onSuccess,
    onError: _onError,
    ...fetchOptions
  } = options;

  const pages = signal<TResponse[]>([]);
  const data = signal<TData | undefined>(options.defaultValue);
  const error = signal<Error | null>(null);
  const status = signal<AsyncDataStatus>('idle');
  const pending = computed(() => status.value === 'pending');
  const nextCursor = signal<TCursor | undefined>(initialCursor);
  const hasMore = computed(() => pages.value.length === 0 || nextCursor.value !== undefined);

  let disposed = false;
  let executionId = 0;

  const applyTransform = (allPages: TResponse[]): TData => {
    if (transformPages) {
      return transformPages(allPages);
    }
    return allPages as unknown as TData;
  };

  const fetchNextPage = async (): Promise<TData | undefined> => {
    if (disposed) return data.peek();

    const currentExecution = ++executionId;
    status.value = 'pending';
    error.value = null;

    try {
      const cursor = nextCursor.peek();
      const input = inputFactory(cursor);
      const pageState = useFetch<TResponse>(input, {
        ...(fetchOptions as UseFetchOptions<TResponse>),
        immediate: false,
        watch: undefined,
      });

      const pageData = await pageState.execute();
      const pageError = pageState.error.peek();
      pageState.dispose();

      if (disposed || currentExecution !== executionId) return data.peek();

      // Check if the inner fetch encountered an error
      if (pageError) {
        error.value = pageError;
        status.value = 'error';
        options.onError?.(pageError);
        return data.peek();
      }

      if (pageData !== undefined) {
        const typedPageData = pageData as TResponse;
        const newPages: TResponse[] = [...pages.peek(), typedPageData];
        pages.value = newPages;

        const newCursor = getNextCursor(typedPageData, newPages);
        nextCursor.value = newCursor;

        const transformed = applyTransform(newPages);
        data.value = transformed;
        status.value = 'success';
        options.onSuccess?.(transformed);
        return transformed;
      }

      status.value = 'success';
      return data.peek();
    } catch (caught) {
      if (disposed || currentExecution !== executionId) return data.peek();

      const normalizedError = caught instanceof Error ? caught : new Error(String(caught));
      error.value = normalizedError;
      status.value = 'error';
      options.onError?.(normalizedError);
      return data.peek();
    }
  };

  const refresh = async (): Promise<TData | undefined> => {
    pages.value = [];
    nextCursor.value = initialCursor;
    data.value = options.defaultValue;
    error.value = null;
    status.value = 'idle';
    executionId += 1;
    return fetchNextPage();
  };

  const clear = (): void => {
    executionId += 1;
    pages.value = [];
    nextCursor.value = initialCursor;
    data.value = options.defaultValue;
    error.value = null;
    status.value = 'idle';
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    executionId += 1;
  };

  if (immediate) {
    void fetchNextPage();
  }

  return {
    data,
    pages,
    error,
    status,
    pending,
    hasMore,
    fetchNextPage,
    refresh,
    clear,
    dispose,
  };
};

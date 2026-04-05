/**
 * Reactive primitives inspired by fine-grained reactivity.
 *
 * @module bquery/reactive
 */

export { batch } from './batch';
export { createUseFetch, useAsyncData, useFetch } from './async-data';
export { Computed, computed } from './computed';
export { Signal, signal } from './core';
export { effect } from './effect';
export { createHttp, createRequestQueue, http, HttpError } from './http';
export { linkedSignal } from './linked';
export { useInfiniteFetch, usePaginatedFetch } from './pagination';
export { persistedSignal } from './persisted';
export { usePolling } from './polling';
export { readonly } from './readonly';
export {
  createRestClient,
  deduplicateRequest,
  useResource,
  useResourceList,
  useSubmit,
} from './rest';
export { effectScope, getCurrentScope, onScopeDispose } from './scope';
export { isComputed, isSignal } from './type-guards';
export { toValue } from './to-value';
export { untrack } from './untrack';
export { watch, watchDebounce, watchThrottle } from './watch';
export { useEventSource, useWebSocket, useWebSocketChannel } from './websocket';

export type { CleanupFn, Observer } from './internals';
export type {
  AsyncDataState,
  AsyncDataStatus,
  AsyncWatchSource,
  FetchInput,
  UseAsyncDataOptions,
  UseFetchOptions,
  UseFetchRetryConfig,
} from './async-data';
export type {
  HttpClient,
  HttpProgressEvent,
  HttpRequestConfig,
  HttpResponse,
  Interceptor,
  InterceptorManager,
  RequestQueue,
  RequestQueueOptions,
  RetryConfig,
} from './http';
export type {
  InfiniteState,
  PaginatedState,
  UseInfiniteFetchOptions,
  UsePaginatedFetchOptions,
} from './pagination';
export type { PollingState, UsePollingOptions } from './polling';
export type { WatchOptions } from './watch';
export type {
  IdExtractor,
  ResourceListActions,
  RestClient,
  UseResourceListOptions,
  UseResourceListReturn,
  UseResourceOptions,
  UseResourceReturn,
  UseSubmitOptions,
  UseSubmitReturn,
} from './rest';
export type { EffectScope } from './scope';
export type { LinkedSignal } from './linked';
export type { MaybeSignal } from './to-value';
export type { ReadonlySignal, ReadonlySignalHandle } from './readonly';
export type {
  ChannelMessage,
  ChannelSubscription,
  EventSourceStatus,
  UseEventSourceOptions,
  UseEventSourceReturn,
  UseWebSocketChannelOptions,
  UseWebSocketChannelReturn,
  UseWebSocketOptions,
  UseWebSocketReturn,
  WebSocketHeartbeatConfig,
  WebSocketReconnectConfig,
  WebSocketSerializer,
  WebSocketStatus,
} from './websocket';

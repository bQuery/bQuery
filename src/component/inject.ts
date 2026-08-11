/**
 * `provide` / `inject` — Web Component–native dependency injection.
 *
 * Uses a typed `CustomEvent` over the composed path: a descendant emits a
 * bubbling, non-cancelable `__bq_inject__` event, and the nearest ancestor that
 * has called `provide(key)` for the same key answers it via the event's
 * `detail.resolve` callback. No global state is involved.
 *
 * This is intentionally synchronous so that `inject()` can be called inside
 * `connected()` and the resolved value is available immediately.
 *
 * @module bquery/component
 */

import { getCurrentScope, isCurrentScopeRendering } from './scope';

/**
 * Strongly-typed injection key. The phantom `__type` property carries the
 * value type so consumers receive accurate types from `inject(key)`.
 */
export type InjectionKey<T> = symbol & { __type?: T };

/**
 * Create a new {@link InjectionKey}.
 */
export const injectionKey = <T>(description: string): InjectionKey<T> =>
  Symbol(description) as InjectionKey<T>;

type InjectEventDetail = {
  key: string | InjectionKey<unknown>;
  resolve: (value: unknown) => void;
  resolved: boolean;
  value?: unknown;
};

const INJECT_EVENT = '__bq_inject__';

const providers = new WeakMap<
  EventTarget,
  Map<string | InjectionKey<unknown>, unknown> & { handler?: (event: Event) => void }
>();

const getOrCreateProviderMap = (host: EventTarget) => {
  let map = providers.get(host);
  if (!map) {
    map = new Map() as Map<string | InjectionKey<unknown>, unknown> & {
      handler?: (event: Event) => void;
    };
    providers.set(host, map);
  }
  return map;
};

/**
 * Provide a value for the given key from the calling component host.
 *
 * Descendants that call {@link inject} with the same key receive this value.
 * Multiple providers for the same key are layered: the nearest ancestor wins.
 *
 * Must be called from a component lifecycle hook with access to the host element
 * (e.g. via `this`). The provider is removed when the component disconnects.
 *
 * @example
 * ```ts
 * const ThemeKey = injectionKey<{ dark: boolean }>('theme');
 *
 * component('app-shell', {
 *   connected() {
 *     provide(this, ThemeKey, { dark: true });
 *   },
 *   render() { return html`<slot></slot>`; },
 * });
 * ```
 */
export const provide = <T>(host: EventTarget, key: string | InjectionKey<T>, value: T): void => {
  const scope = getCurrentScope();
  if (!scope || isCurrentScopeRendering()) {
    throw new Error(
      'bQuery component: provide() must be called inside a component lifecycle hook. Avoid calling it directly from render()'
    );
  }
  const map = getOrCreateProviderMap(host);
  map.set(key as string | InjectionKey<unknown>, value);

  if (!map.handler) {
    map.handler = (event: Event): void => {
      const detail = (event as CustomEvent<InjectEventDetail>).detail;
      if (!detail || detail.resolved) return;
      if (map.has(detail.key)) {
        detail.resolve(map.get(detail.key));
        event.stopPropagation();
      }
    };
    host.addEventListener(INJECT_EVENT, map.handler);
  }

  scope.addDisposer(() => {
    map.delete(key as string | InjectionKey<unknown>);
    if (map.size === 0 && map.handler) {
      host.removeEventListener(INJECT_EVENT, map.handler);
      providers.delete(host);
    }
  });
};

/**
 * Look up the nearest ancestor that has called `provide()` with the given key.
 *
 * If no provider is found, returns the supplied `fallback` (or `undefined`).
 *
 * @example
 * ```ts
 * connected() {
 *   const theme = inject(this, ThemeKey, { dark: false });
 *   console.log(theme.dark);
 * }
 * ```
 */
export const inject = <T>(
  host: EventTarget,
  key: string | InjectionKey<T>,
  fallback?: T
): T | undefined => {
  const detail: InjectEventDetail = {
    key: key as string | InjectionKey<unknown>,
    resolved: false,
    resolve: (value) => {
      detail.resolved = true;
      detail.value = value;
    },
  };

  // dispatch a composed, bubbling event so it can cross shadow boundaries
  const event = new CustomEvent(INJECT_EVENT, {
    detail,
    bubbles: true,
    composed: true,
    cancelable: false,
  });
  host.dispatchEvent(event);

  if (detail.resolved) {
    return detail.value as T;
  }
  return fallback;
};

/**
 * Strongly-typed key for the enclosing `<bq-form>` context. Components that
 * render form inputs can `inject(this, formContextKey)` to discover the
 * surrounding form and auto-bind themselves.
 */
export const formContextKey = injectionKey<{
  registerField?: (name: string, host: HTMLElement) => () => void;
  setValue?: (name: string, value: unknown) => void;
  getValue?: (name: string) => unknown;
}>('formContext');

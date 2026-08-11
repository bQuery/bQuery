# Reactivity Model

bQuery's reactivity is **fine-grained** and **signal-based**. There is no virtual DOM and no component-level re-rendering: when a value changes, only the effects and computeds that _read_ that value re-run.

This page summarises the mental model. The full API and the async / HTTP / realtime sub-system live in the [Reactive module guide](/guide/reactive).

## The four primitives

```ts
import { signal, computed, effect, batch } from '@bquery/bquery/reactive';
```

- **`signal(initial)`** — a writable reactive cell. Read via `.value` to subscribe; write via `.value = ...` or `.update(fn)` to notify.
- **`computed(() => ...)`** — a read-only derived value. Memoized: while nothing subscribes to it, it recomputes lazily on the next read after a dependency changes. Once it has subscribers, a dependency change re-validates it so subscribers are only notified when the value actually changed (`Object.is`).
- **`effect(() => ...)`** — a side-effect callback. Runs once eagerly, then again whenever any signal read inside it changes.
- **`batch(() => ...)`** — coalesces notifications: writes inside the callback trigger a single flush when the batch ends instead of notifying synchronously per write. Observers re-triggered transitively during that flush run again in a follow-up pass.

```ts
const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log('doubled is', doubled.value);
});

batch(() => {
  count.value = 1;
  count.value = 2;
}); // effect logs once with doubled === 4
```

## Tracked vs untracked reads

A read is **tracked** when it happens inside an active reactive context (an effect, computed, watcher, or render function). Tracked reads subscribe the surrounding context to the signal.

To read without subscribing:

- `signal.peek()` — read once, do not register a dependency.
- `untrack(() => …)` — run a block whose reads are not tracked.

```ts
effect(() => {
  // Subscribed to user.value, not to debugMode.value
  if (untrack(() => debugMode.value)) {
    console.log(user.value);
  }
});
```

## Scopes and disposal

Effects and computeds that escape their host (a component, a route, a request) leak. Use a **scope** to dispose them together:

```ts
import { effectScope, onScopeDispose } from '@bquery/bquery/reactive';

const scope = effectScope();
scope.run(() => {
  effect(() => /* … */);
  onScopeDispose(() => /* cleanup */);
});
scope.stop(); // disposes all effects/computeds registered inside
```

Components collect their `use*` composables (`useSignal`, `useComputed`, `useEffect`) in a component scope and dispose them on disconnect — but a bare `effect()` created inside a component is **not** auto-collected. Composables like `useResource()` don't create a scope either; call the `dispose()` they return. Use a manual `effectScope()` whenever you create reactivity outside such an owner.

## Watch with comparison

`watch()` runs a callback with `(newValue, oldValue)` whenever a signal or computed changes. Debounced and throttled variants share the same callback shape:

```ts
import { watch, watchDebounce, watchThrottle } from '@bquery/bquery/reactive';

watch(query, (next, prev) => console.log(`query: ${prev} → ${next}`));
watchDebounce(query, fetchSuggestions, 200);
watchThrottle(scrollY, syncScroll, 16);
```

## Async data primitives

Beyond the four primitives, the `reactive` module exposes a **signal-shaped async layer**:

- `useAsyncData()` / `useFetch()` / `createUseFetch()` — async resources as signals with `data`, `error`, `pending`, `refresh`.
- `usePolling()`, `usePaginatedFetch()`, `useInfiniteFetch()` — long-running and paginated fetches.
- `useWebSocket()`, `useWebSocketChannel()`, `useEventSource()` — realtime transports.
- `useResource()`, `useResourceList()`, `useSubmit()` — REST-shaped resources with optimistic updates.
- `createHttp()`, `http`, `HttpError` — imperative HTTP client.
- `createRestClient()`, `createRequestQueue()`, `deduplicateRequest()` — REST helpers and concurrency utilities.

All of these expose signals, so the rest of the framework (view directives, components, devtools timeline) plugs in without ceremony.

## Mental model — what to internalize

1. **Signals are the unit of change.** Anything that should "react" must ultimately read a signal.
2. **Reads register, writes notify.** This means `.value` and `.peek()` are not interchangeable.
3. **Effects own subscriptions; scopes own effects.** When something should die, dispose its scope.
4. **Batches collapse churn.** When updating multiple signals together, wrap them in `batch()`.
5. **Async is just signals.** The async layer is built on the same primitives; you can integrate any custom transport by exposing it as a signal.

## Common pitfalls

- Reading `.value` inside an unrelated handler will silently subscribe the surrounding effect — use `.peek()` if you only want the current value.
- Arrow functions for store actions can break the intended `this` context. Use method shorthand syntax.
- Forgetting to dispose a scope outside of a component leaks effects and any DOM subscriptions they created.

## See also

- [Reactive module guide](/guide/reactive) — full API, async layer, recipes
- [Store](/guide/store) — signal-based state containers built on these primitives
- [View](/guide/view) — declarative `bq-*` directives that read signals
- [Devtools](/guide/devtools) — inspect signals, computeds, effects, and the timeline at runtime

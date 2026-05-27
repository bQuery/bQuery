# Off-main-thread work

Heavy work — markdown rendering, syntax highlighting, image processing, JSON normalisation — does not have to block the main thread. This workflow uses [Concurrency](/guide/concurrency) pools and reactive metrics from [Reactive](/guide/reactive) / [Devtools](/guide/devtools).

## 1. Define a worker task

```ts
// src/workers/highlight.ts
import { createReactiveTaskPool, withTransferables } from '@bquery/bquery/concurrency';

interface HighlightInput { source: string; lang: string }
interface HighlightOutput { html: string }

export const highlighter = createReactiveTaskPool<HighlightInput, HighlightOutput>({
  size: 2,
  priority: 'background',
  maxInFlight: 4,
  async task({ source, lang }) {
    // Runs inside the worker. Import third-party libs lazily so the main
    // thread does not pull them.
    const { highlight } = await import('https://esm.sh/shiki@1');
    const html = await highlight(source, { lang });
    return withTransferables({ html }, []);
  },
});
```

`createReactiveTaskPool` returns a pool with reactive metrics (`metrics.queued`, `metrics.running`, `metrics.completed`, `metrics.avgMs`) you can read inside any `effect()`.

## 2. Call it from a component

```ts
import { defineComponent } from '@bquery/bquery/component';
import { useAsync } from '@bquery/bquery/component';
import { highlighter } from '../workers/highlight';

defineComponent('code-block', {
  props: { lang: { type: 'string', default: 'ts' } },
  setup({ props, slot }) {
    const source = slot.text();
    const { data, isPending } = useAsync(() => highlighter.run({ source, lang: props.lang }));

    return ({ html }) => html`
      <pre data-lang=${props.lang}>
        ${isPending.value ? html`<code>${source}</code>` : html`<code .innerHTML=${data.value?.html ?? ''}></code>`}
      </pre>
    `;
  },
});
```

`useAsync` schedules the task off the render path and exposes `isPending` so the component shows raw source first and upgrades to highlighted markup when the worker returns.

## 3. Surface metrics

```ts
import { effect } from '@bquery/bquery/reactive';
import { highlighter } from './workers/highlight';

effect(() => {
  const { queued, running, completed, avgMs } = highlighter.metrics;
  console.debug('[highlight]', queued.value, running.value, completed.value, `${avgMs.value.toFixed(1)}ms`);
});
```

Wire the same signals into a tiny status bar or a [Devtools](/guide/devtools) timeline mark via `mark('highlight:burst', { source: 'pool', payload: { queued: queued.value } })`.

## 4. Backpressure and graceful pause

```ts
// Pause during a busy interaction (e.g. scroll), resume when idle
import { useScroll } from '@bquery/bquery/media';

const scroll = useScroll();
let paused = false;
scroll.isScrolling.subscribe((scrolling) => {
  if (scrolling && !paused) { highlighter.pause(); paused = true; }
  if (!scrolling && paused)  { highlighter.resume(); paused = false; }
});

// Drain before navigation
await highlighter.onIdle();
```

`pause()` lets in-flight tasks finish before holding the queue; `resume()` releases the queue; `onIdle()` resolves once both queue and in-flight count reach zero.

## 5. Shared memory (when applicable)

For image / audio buffers, use `createSharedBuffer({ size })` to avoid copy costs. This requires the page to be `crossOriginIsolated`:

```ts
import { createSharedBuffer } from '@bquery/bquery/concurrency';

const shared = createSharedBuffer({ size: 1024 * 1024 });
await highlighter.run({ source: '...', lang: 'ts', shared });
```

## What you exercised

- **Reactive pools** — pool metrics are signals; UIs and observability layer subscribe with no polling.
- **Transferables** — `withTransferables` avoids serialising large outputs back to the main thread.
- **Priority + concurrency control** — `priority: 'background'` and `maxInFlight` keep interaction snappy.
- **Pause / resume / idle** — graceful backpressure without dropping work.

## Constraints

- Worker bodies are serialised via `new Function(...)`; your CSP must allow `'unsafe-eval'`. See the [Security concept page](/concepts/security-model) for guidance.
- `createSharedBuffer` requires COOP/COEP headers and `crossOriginIsolated === true`.

## Next steps

- Visualise pool metrics over time with a [Devtools](/guide/devtools) timeline subscription.
- Combine with the [Streaming SSR workflow](./streaming-ssr) to offload server-side markdown rendering to a pool.
- Persist long jobs across navigations with a shared worker (advanced — see [Concurrency](/guide/concurrency) for the lifecycle contract).

---
layout: page
pageClass: bq-landing
sidebar: false
aside: false
title: bQuery.js
titleTemplate: The full-stack framework that speaks jQuery
description: Batteries-included TypeScript framework for the modern web — signals, SSR, Web Components, routing, and more — with a jQuery-inspired API and zero mandatory build step.
footer: false
hero:
  kicker:
    - TypeScript
    - ESM only
    - zero dependencies
    - MIT
  title: The full-stack framework that speaks
  accent: jQuery
  lead: Signals, Web Components, routing, forms, motion, runtime-agnostic SSR and a dependency-free server — 23 tree-shakeable entry points behind the $() you already know. A bundler is a choice, not a prerequisite.
  actions:
    - text: get started
      link: /guide/getting-started
      theme: brand
    - text: what is bQuery?
      link: /introduction
    - text: github
      link: https://github.com/bQuery/bQuery
      external: true
---

<BqHero>
<template #install>

<span class="bq-label">install</span>

<div class="vp-doc bq-code-frame">

::: code-group

```bash [npm]
npm install @bquery/bquery
```

```bash [bun]
bun add @bquery/bquery
```

```bash [pnpm]
pnpm add @bquery/bquery
```

```html [cdn]
<script type="module">
  import { $, signal, effect } from 'https://unpkg.com/@bquery/bquery@1/dist/full.es.mjs';
</script>
```

:::

</div>

<p class="bq-label bq-hero__runtimes">Node ≥ 24 · Bun ≥ 1.4 · Deno · edge · evergreen browsers — <a href="/concepts/runtimes">support matrix</a></p>

</template>
<template #code>

::: code-group

```ts [counter.ts]
import { $, effect, signal } from '@bquery/bquery';

const count = signal(0);

// No virtual DOM: the effect writes straight to
// the element it read, and nothing else re-renders.
effect(() => {
  $('#counter').text(`Count: ${count.value}`);
});

$('#counter').on('click', () => {
  count.value++;
});
```

```ts [server.ts]
import { createServer } from '@bquery/bquery/server';

const app = createServer();

app.get('/', async (ctx) => {
  return ctx.renderResponse(`<h1 bq-text="message"></h1>`, {
    message: 'Hello from bQuery SSR',
  });
});

// No framework dependencies. Runs on Node, Bun or Deno.
await app.listen({ port: 3000 });
```

```html [zero-build.html]
<button id="counter">Count: 0</button>

<script type="module">
  import { $, signal, effect } from 'https://unpkg.com/@bquery/bquery@1/dist/full.es.mjs';

  const count = signal(0);

  effect(() => $('#counter').text(`Count: ${count.value}`));
  $('#counter').on('click', () => count.value++);
</script>
```

:::

</template>
</BqHero>

<BqSpecBar />

<BqSection index="01" label="Positioning" title="A familiar surface over a modern core" lead="bQuery keeps the ergonomics that made $() stick — a typed, chainable wrapper around real DOM nodes — and puts fine-grained reactivity, components, routing and SSR underneath it.">

<div class="vp-doc bq-prose">

| You want…                                     | bQuery gives you                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A jQuery-style DOM API on reactive primitives | `$(selector)` returns a typed `BQueryElement`; signals and effects join the same chain — no virtual DOM, no diffing pass. |
| Zero build for small projects                 | One `<script type="module">` from a CDN. No Vite, no bundler, no transpiler.                                              |
| A real framework once the project grows       | 23 tree-shakeable entry points: routing, state, forms, SSR, server, motion, a11y, i18n, devtools, testing, plugins.       |
| One stack for client and server               | `@bquery/bquery/ssr` and `/server` render and serve from the same runtime — Node, Bun, Deno or edge.                      |
| Security defaults that don't fight you        | Every HTML-writing API sanitizes untrusted input; Trusted Types and CSP-friendly patterns are first-class.                |
| Predictable bundle size                       | Zero runtime dependencies, `sideEffects: false`, one entry point per module. `/full` exists for CDN consumers only.       |

</div>
</BqSection>

<BqSection index="02" label="Reactivity" title="From a write to the DOM, with nothing in between" lead="A signal write notifies exactly the computeds and effects that read it. Effects write to the elements they touched. There is no component re-render to opt out of.">

<BqSignalFlow />

<div class="vp-doc bq-prose">

```ts
import { batch, computed, effect, signal } from '@bquery/bquery/reactive';

const items = signal([{ done: false }, { done: true }]);
const open = computed(() => items.value.filter((item) => !item.done).length);

effect(() => {
  console.log(`${open.value} open`); // runs once now, then on every change
});

batch(() => {
  items.value = [...items.value, { done: false }]; // one notification,
  items.value = [...items.value, { done: false }]; // not two
});
```

Read the whole model in **[Reactivity](/concepts/reactivity-model)**, or the API surface in **[reactive](/guide/reactive)**.

</div>
</BqSection>

<BqSection index="03" label="Surface" title="23 entry points. Import exactly what you use." lead="Every public module is its own sub-path export with its own types, so bundlers drop what you never touch. The root entry is a convenience, not a requirement." wide>

<BqModuleMap />

</BqSection>

<BqSection index="04" label="Capabilities" title="What ships in the box" lead="Batteries included means the boring parts are already solved — sanitization, focus management, locale negotiation, request dedup, worker pools, hydration." wide>

<BqFeatureGrid />

</BqSection>

<BqSection index="05" label="Start" title="Pick the layer you need today" lead="You do not have to adopt the whole framework at once. Start where your app is, and compose more modules in when you need them.">

<BqStartPaths />

<BqCta />

</BqSection>

<BqSiteFooter />

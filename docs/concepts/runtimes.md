# Supported Runtimes

bQuery.js targets multiple JavaScript runtimes from a single codebase. This page lists the supported targets, the minimum versions, and which modules have runtime-specific behaviour.

## Engines

| Runtime       | Minimum version                 | Status    | Notes                                                                  |
| ------------- | ------------------------------- | --------- | ---------------------------------------------------------------------- |
| Node.js       | **24.0.0**                      | Primary   | Used for the canonical `examples/ssr-node` and CI baseline.            |
| Bun           | **1.4.0**                       | Primary   | Used for repo workflows (`bun run lint`, `bun test`, `bun run build`). |
| Deno          | latest stable                   | Supported | `examples/ssr-deno` demonstrates the SSR adapter.                      |
| Chrome        | 90+                             | Browser   | Baseline for all browser-facing features.                              |
| Firefox       | 90+                             | Browser   | Same baseline.                                                         |
| Safari        | 15+                             | Browser   | Same baseline.                                                         |
| Edge          | 90+                             | Browser   | Same baseline.                                                         |
| Edge runtimes | Workers / Vercel / Netlify Edge | Supported | Use the SSR module's edge adapter (`createEdgeHandler`).               |

The engine ranges are enforced in `package.json` under `engines`.

## Modules by runtime

Most modules are runtime-agnostic. The ones with runtime-specific behaviour:

| Module        | Browser | Node | Bun | Deno | Edge | Notes                                                                          |
| ------------- | :-----: | :--: | :-: | :--: | :--: | ------------------------------------------------------------------------------ |
| `core`        |   ✅    |  -   |  -  |  -   |  -   | DOM-only; in non-browser contexts use only its non-DOM utilities.              |
| `reactive`    |   ✅    |  ✅  | ✅  |  ✅  |  ✅  | Pure logic. HTTP / WebSocket helpers use the runtime's `fetch` / `WebSocket`.  |
| `concurrency` |   ✅    |  ✅  | ✅  |  ✅  |  -   | Uses `Worker` / `MessagePort`. Feature-detect with `isConcurrencySupported()`. |
| `component`   |   ✅    |  -   |  -  |  -   |  -   | Custom elements (browser-only).                                                |
| `motion`      |   ✅    |  -   |  -  |  -   |  -   | DOM and `requestAnimationFrame`.                                               |
| `view`        |   ✅    |  -   |  -  |  -   |  -   | DOM directive compilation.                                                     |
| `router`      |   ✅    |  -   |  -  |  -   |  -   | Uses `history` and `URL`.                                                      |
| `store`       |   ✅    |  ✅  | ✅  |  ✅  |  ✅  | Pure; persistence plugins are browser-only.                                    |
| `forms`       |   ✅    |  ✅  | ✅  |  ✅  |  ✅  | Validation is pure; `bindField` / `bindForm` are browser-only.                 |
| `security`    |   ✅    |  ✅  | ✅  |  ✅  |  ✅  | Trusted Types integration is browser-only.                                     |
| `platform`    |   ✅    |  -   |  -  |  -   |  -   | Storage, cookies, page meta are browser APIs.                                  |
| `i18n`        |   ✅    |  ✅  | ✅  |  ✅  |  ✅  | Uses `Intl.*` everywhere.                                                      |
| `a11y`        |   ✅    |  -   |  -  |  -   |  -   | Focus management is browser-only.                                              |
| `dnd`         |   ✅    |  -   |  -  |  -   |  -   | Pointer / keyboard events; browser-only.                                       |
| `media`       |   ✅    |  -   |  -  |  -   |  -   | Media queries, clipboard, network info — browser-only.                         |
| `plugin`      |   ✅    |  ✅  | ✅  |  ✅  |  ✅  | Pure registry; directives need a browser.                                      |
| `devtools`    |   ✅    |  ✅  | ✅  |  ✅  |  ✅  | Inspection is pure; browser bridge uses `postMessage`.                         |
| `testing`     |   ✅    |  ✅  | ✅  |  ✅  |  -   | Runs under `happy-dom` in test environments.                                   |
| `ssr`         |    -    |  ✅  | ✅  |  ✅  |  ✅  | DOM-free; runtime-agnostic; adapters per runtime.                              |
| `server`      |    -    |  ✅  | ✅  |  ✅  |  ✅  | Dependency-free routing; SSR responses; WebSocket sessions.                    |
| `storybook`   |   ✅    |  -   |  -  |  -   |  -   | Browser-only (Storybook host).                                                 |

A blank cell means "not applicable" — not "broken".

## SSR adapters

`@bquery/bquery/ssr` provides runtime-specific adapters that bridge the renderer to the host's request / response abstractions:

- **Node** — uses `IncomingMessage` / `ServerResponse`. See `examples/ssr-node`.
- **Bun** — uses `Request` / `Response` directly.
- **Deno** — uses `Request` / `Response` from the standard Deno HTTP server.
- **Edge** — `createEdgeHandler()` produces a `Request → Promise<Response>` function suitable for Cloudflare Workers, Vercel Edge, Netlify Edge, Deno Deploy.

All four share the same `renderToStringAsync` / `renderToStream` / `renderToResponse` underneath.

## TypeScript baseline

The TypeScript compile target is ES2020 with `lib: ["ES2022", "DOM"]`. Public APIs do not depend on stage < 4 proposals.

## Polyfills

bQuery does **not** ship polyfills. If you target older browsers than the baseline, add the polyfills your bundler recommends. The repository's own build does not register any polyfill globally.

## See also

- [Architecture](/concepts/architecture)
- [Rendering Modes](/concepts/rendering-modes)
- [SSR module guide](/guide/ssr)
- [Server module guide](/guide/server)
- [Examples](https://github.com/bQuery/bQuery/tree/main/examples) — `ssr-node`, `ssr-bun`, `ssr-deno`

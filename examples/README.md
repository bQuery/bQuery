# bQuery SSR examples

Three minimal SSR servers — one per runtime — all using **the exact same**
bQuery template + binding context. They demonstrate the `1.11.0` runtime-agnostic
SSR surface built around `createSSRContext()`, `resolveSSRRoute()`, and
`renderToResponse()` running untouched on Node, Bun, and Deno.

| Runtime | Folder                    | How to run                                                               |
| ------- | ------------------------- | ------------------------------------------------------------------------ |
| Bun     | [`ssr-bun/`](./ssr-bun)   | `bun examples/ssr-bun/serve.ts`                                          |
| Deno    | [`ssr-deno/`](./ssr-deno) | `deno run -A examples/ssr-deno/serve.ts`                                 |
| Node    | [`ssr-node/`](./ssr-node) | `node --experimental-strip-types examples/ssr-node/serve.ts` (Node ≥ 24) |

All three serve <http://localhost:3000/>. They share [`shared/app.ts`](./shared/app.ts),
which builds the binding context, resolves the route, and produces a
`Response` via `renderToResponse()`.

These examples import directly from `src/` inside this repository checkout, so they do **not** require a prebuilt `dist/` bundle before you run them. Install dependencies once:

```bash
bun install
```

If you want to verify the built package surface as well, running `bun run build` first is still a good optional smoke test.

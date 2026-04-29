# bQuery SSR examples

Three minimal SSR servers — one per runtime — all using **the exact same**
bQuery template + binding context. They demonstrate that
`@bquery/bquery/ssr` runs untouched on Node, Bun, and Deno.

| Runtime | Folder                    | How to run                                                                     |
| ------- | ------------------------- | ------------------------------------------------------------------------------ |
| Bun     | [`ssr-bun/`](./ssr-bun)   | `cd examples/ssr-bun && bun serve.ts`                                          |
| Deno    | [`ssr-deno/`](./ssr-deno) | `cd examples/ssr-deno && deno run -A serve.ts`                                 |
| Node    | [`ssr-node/`](./ssr-node) | `cd examples/ssr-node && node --experimental-strip-types serve.ts` (Node ≥ 24) |

All three serve <http://localhost:3000/>. They share [`shared/app.ts`](./shared/app.ts),
which builds the binding context, resolves the route, and produces a
`Response` via `renderToResponse()`.

Build the dist bundle once:

```bash
bun install
bun run build
```

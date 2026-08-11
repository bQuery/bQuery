# Deploy SSR to Node, Bun, or Deno

**Problem.** Choose an SSR runtime without rewriting the application.

**Solution.** Use the runtime-agnostic SSR pipeline from [`@bquery/bquery/ssr`](/guide/ssr) plus the matching runtime adapter.

| Runtime  | Entry                        | Run                                                                          |
| -------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Node 24+ | `examples/ssr-node/serve.ts` | `node --experimental-strip-types examples/ssr-node/serve.ts`                 |
| Bun      | `examples/ssr-bun/serve.ts`  | `bun examples/ssr-bun/serve.ts`                                              |
| Deno     | `examples/ssr-deno/serve.ts` | `deno run -A examples/ssr-deno/serve.ts`                                     |
| Edge     | `createEdgeHandler(handler)` | Deploy as a fetch handler on Cloudflare Workers / Vercel Edge / Deno Deploy. |

The cross-runtime CI matrix (`.github/workflows/ssr-cross-runtime.yml`) guards the public surface across all three runtimes.

## Related

- [Workflow — SSR + hydration on Node, Bun, and Deno](/workflows/ssr-hydration)
- [Workflow — Streaming SSR](/workflows/streaming-ssr)
- [SSR guide](/guide/ssr)
- [Server guide](/guide/server)
- Runnable samples: [`examples/`](https://github.com/bQuery/bQuery/tree/main/examples)

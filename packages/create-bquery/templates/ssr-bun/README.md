# {{projectName}}

A server-rendered [bQuery](https://bquery.js.org) app on [Bun](https://bun.sh).

## Run it

```bash
bun install
bun run dev          # bun --watch src/server.ts → http://localhost:3000/
bun run start        # without watching; PORT changes the port
```

## Files

```text
├── src/
│   ├── app.ts       # handle(request): routes + template → Response (runtime-agnostic)
│   └── server.ts    # Bun.serve()
└── test/
    └── app.test.ts  # node:test (bun test runs it); queries the HTML with within()
```

`src/app.ts` only uses the Fetch API (`Request` / `Response`), so the same file
runs on Node and Deno; only `server.ts` is Bun-specific.

## Test it

```bash
bun run test         # bun test
bun run typecheck    # tsc
```

The test uses [`@bquery/bquery/testing`](https://bquery.js.org/guide/testing)
queries on the server's HTML, parsed with happy-dom.

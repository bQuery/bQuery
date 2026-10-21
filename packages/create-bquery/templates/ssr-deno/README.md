# {{projectName}}

A server-rendered [bQuery](https://bquery.js.org) app on [Deno](https://deno.com).
Dependencies come from npm through the import map in `deno.json`.

## Run it

```bash
deno task dev        # deno run --watch src/server.ts → http://localhost:3000/
deno task start      # without watching; PORT changes the port
```

## Files

```text
├── deno.json        # tasks, import map, compiler options
├── src/
│   ├── app.ts       # handle(request): routes + template → Response (runtime-agnostic)
│   └── server.ts    # Deno.serve()
└── test/
    └── app.test.ts  # node:test (deno test runs it); queries the HTML with within()
```

`src/app.ts` only uses the Fetch API (`Request` / `Response`), so the same file
runs on Node and Bun; only `server.ts` is Deno-specific.

## Test it

```bash
deno task test       # deno test
deno task check      # deno check
```

The test uses [`@bquery/bquery/testing`](https://bquery.js.org/guide/testing)
queries on the server's HTML, parsed with happy-dom.

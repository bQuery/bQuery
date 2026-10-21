# {{projectName}}

A server-rendered [bQuery](https://bquery.js.org) app on Node.js. Node 24 runs
the TypeScript sources directly — there is no build step.

## Run it

```bash
npm install
npm run dev          # node --watch src/server.ts → http://localhost:3000/
npm start            # without watching; PORT changes the port
```

## Files

```text
├── src/
│   ├── app.ts       # handle(request): routes + template → Response (runtime-agnostic)
│   └── server.ts    # node:http + createNodeHandler()
└── test/
    └── app.test.ts  # node:test; parses the HTML and queries it with within()
```

`src/app.ts` only uses the Fetch API (`Request` / `Response`), so the same file
runs on Bun and Deno; only `server.ts` is Node-specific. Relative imports keep
their `.ts` extension because Node resolves files exactly as written.

## Test it

```bash
npm test             # node --test
npm run typecheck    # tsc
```

The test uses [`@bquery/bquery/testing`](https://bquery.js.org/guide/testing)
queries on the server's HTML, parsed with happy-dom.

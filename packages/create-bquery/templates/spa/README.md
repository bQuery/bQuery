# {{projectName}}

A single-page [bQuery](https://bquery.js.org) app: the router switches pages,
a store holds the todos, and the view module binds `bq-*` markup to them.
Built with [Vite](https://vite.dev) and TypeScript.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173/
npm run build        # type-check, then bundle into dist/
npm run preview      # serve dist/
```

## Files

```text
├── index.html
├── src/
│   ├── main.ts          # entry: createApp(#app)
│   ├── app.ts           # router, <bq-link> navigation, page outlet
│   ├── stores/todos.ts  # createStore(): state, getters, actions
│   ├── pages/           # one module per route, loaded lazily
│   └── style.css
└── test/
    ├── setup.ts         # happy-dom, preloaded by bunfig.toml
    ├── app.test.ts      # the app in a DOM: screen, userEvent, fireEvent, waitFor
    └── todos.test.ts    # the store on its own
```

Add a page: create `src/pages/<name>.ts` exporting `title` and `render(host)`,
then add a route to `src/app.ts`. History-mode URLs need the server to answer
unknown paths with `index.html`; Vite's dev and preview servers already do.

## Test it

The tests run with [Bun](https://bun.sh) and
[`@bquery/bquery/testing`](https://bquery.js.org/guide/testing):

```bash
npm test             # bun test
npm run typecheck    # tsc
```

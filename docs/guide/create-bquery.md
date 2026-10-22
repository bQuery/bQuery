# Create a project

`create-bquery` scaffolds a new bQuery project from one of four templates — a
zero-build CDN page, a single-page app, a server-rendered app on Node, Bun or
Deno, or a full-stack app. Every template ships with tests wired to
[`@bquery/bquery/testing`](./testing.md), so the first `npm test` already runs.

```bash
npm create bquery@latest my-app
```

The scaffolder has no dependencies of its own; it only copies files. Nothing
is installed until you run your package manager in the new project.

`@bquery/bquery` ships the same scaffolder as its `create-bquery` command, so
once bQuery is installed — globally or in an existing project — you can run
it without fetching anything:

```bash
npx create-bquery my-app --template spa
```

The bundled copy is always the one written for the installed bQuery release.

## Usage

Run it with the package manager you use — the printed next steps follow it:

```bash
npm create bquery@latest my-app
bun create bquery my-app
pnpm create bquery my-app
yarn create bquery my-app
deno run -A npm:create-bquery@latest my-app
```

Without options it asks for the directory, the template and (for `ssr`) the
runtime. With `--yes`, or when stdin is not a terminal (CI, scripts), it asks
nothing and uses the defaults for whatever the command line leaves out.

```bash
# An SSR app for Deno, no prompts
npm create bquery@latest api -- --template ssr --runtime deno --yes
```

::: tip npm needs `--`
`npm create` passes options to the scaffolder only after `--`. Bun, pnpm and
Yarn pass them through directly: `pnpm create bquery api --template ssr`.
:::

### Options

| Option                  | Default            | Description                                                                                  |
| ----------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| `[dir]`                 | `bquery-app`       | Directory to create. Its name is the package name.                                           |
| `-t, --template <name>` | `spa`              | `cdn`, `spa`, `ssr` or `fullstack`.                                                          |
| `-r, --runtime <name>`  | `node`             | `node`, `bun` or `deno` — the server runtime of the `ssr` template.                          |
| `--pm <name>`           | detected           | `npm`, `bun`, `pnpm` or `yarn` — only changes the printed commands.                          |
| `--name <name>`         | the directory name | The package name, when the directory name is not a valid one.                                |
| `-y, --yes`             | —                  | Do not prompt.                                                                               |
| `-f, --force`           | —                  | Write into a non-empty directory. Files with the same name are overwritten; others are kept. |
| `-h, --help`            | —                  | Show the help.                                                                               |
| `-v, --version`         | —                  | Print the scaffolder's version.                                                              |

The scaffolder refuses to write into a directory that has files in it (a lone
`.git` folder is fine) unless you pass `--force` or confirm the prompt. Package
names follow npm's rules: lowercase, URL-safe, no leading `.` or `_`, not a
Node.js core module name. An invalid directory name is rejected with a
suggestion, e.g. `My App` → `--name my-app`. With `--force`, it refuses to
write through a symbolic link inside the directory, so it never changes files
outside it.

## Templates

### `cdn` — zero-build page

The `<script type="module">` story: one HTML page, bQuery from a CDN, no
toolchain. An [import map](https://developer.mozilla.org/docs/Web/HTML/Element/script/type/importmap)
points `@bquery/bquery` at a pinned unpkg URL, so `app.js` imports bQuery like
an npm package and the tests load the same version from `node_modules`.

```text
my-app/
├── index.html      # import map → https://unpkg.com/@bquery/bquery@<version>/dist/full.es.mjs
├── app.js          # mountGreeting(): $ + signal + computed + effect; <click-counter> component
├── styles.css
├── serve.js        # tiny static server (`npm start`); module scripts need http://
├── package.json    # test script and dev dependencies only
├── bunfig.toml     # preloads the DOM for tests
└── test/
    ├── setup.js
    └── app.test.js # fireEvent, renderComponent, within, waitFor
```

`npm start` serves the folder on `http://localhost:3000/`; any static server
works. The bQuery version is pinned in two places, the import map and
`package.json` — change both together.

### `spa` — single-page app

[Router](./router.md), [store](./store.md) and [view](./view.md) together, built
with Vite and TypeScript. Pages load lazily, `<bq-link>` navigates without a page
load, and a todo store keeps its state across pages.

```text
my-app/
├── index.html
├── src/
│   ├── main.ts           # createApp(#app)
│   ├── app.ts            # createRouter(), registerBqLink(), the page outlet
│   ├── stores/todos.ts   # createStore(): state, getters, actions
│   ├── pages/            # home (bq-model, bq-for, bq-on), about, not-found
│   └── style.css
├── package.json          # scripts: dev, build, preview, test, typecheck
├── tsconfig.json
├── bunfig.toml           # preloads the DOM for tests
└── test/
    ├── setup.ts
    ├── app.test.ts       # the whole app in a DOM: screen, within, userEvent, fireEvent, waitFor
    └── todos.test.ts     # the store on its own, with flushEffects()
```

### `ssr` — server-rendered app (Node, Bun or Deno)

The runtime-parity setup from [`examples/ssr-*`](https://github.com/bQuery/bQuery/tree/main/examples):
`src/app.ts` turns a `Request` into a `Response` with
[`resolveSSRRoute()`](./ssr.md) and `renderToResponse()` (ETag and `304`
included), using only the Fetch API. `src/server.ts` is the only file that
differs per runtime.

```text
my-app/
├── src/
│   ├── app.ts       # handle(request): routes + bq-* template → Response
│   └── server.ts    # node:http + createNodeHandler() | Bun.serve() | Deno.serve()
├── test/
│   └── app.test.ts  # node:test + within() on the parsed HTML
├── package.json     # Node and Bun: dev, start, test, typecheck scripts
├── tsconfig.json    # Node and Bun
└── deno.json        # Deno instead of both: tasks, npm: import map, compiler options
```

| Runtime | Start                | Test             | Notes                                                                   |
| ------- | -------------------- | ---------------- | ----------------------------------------------------------------------- |
| Node    | `node src/server.ts` | `node --test`    | Node ≥ 24 runs TypeScript directly; imports keep their `.ts` extension. |
| Bun     | `bun src/server.ts`  | `bun test`       |                                                                         |
| Deno    | `deno task dev`      | `deno task test` | No `package.json`; npm packages come through `deno.json` imports.       |

The test uses `node:test`, which all three runtimes run unchanged. It parses
the rendered HTML in a separate happy-dom window rather than installing a
global DOM, because the server code under test is meant to run without one.

### `fullstack` — server, forms and SSR

A trimmed version of the [bQuery Notes example](https://github.com/bQuery/bQuery/tree/main/examples/fullstack),
on Bun: notes rendered on the server from routes with loaders
(`createSSRRouterContext()`), hydrated in the browser (`hydrate()`), a form
built with [`createForm()`](./forms.md) whose validation rules the API runs as
well, an optimistic delete, and a JSON API protected by [`csrf()`](./server.md).

```text
my-app/
├── server.ts            # entry: bundles client.ts with Bun.build() and listens
├── server/
│   ├── app.ts           # createApp(): csrf(), JSON API, pages with loaders
│   └── notes-repo.ts    # in-memory storage
├── client.ts            # browser entry
├── client/notes.ts      # createForm(), createHttp(), hydrate()
├── shared/
│   ├── note.ts          # note type + validation rules used on both sides
│   └── pages.ts         # templates rendered on the server, hydrated in the browser
├── styles.css
└── test/
    ├── setup.ts
    ├── server.test.ts   # app.handle() in-process: SSR, CSRF, validation, bundling
    └── client.test.ts   # hydrates the server's real HTML; mockFetch() answers the API
```

Sign-in with `session()`, rate limiting and i18n are left out; the full example
shows how to add them.

## Tests in every template

Each template's tests use `@bquery/bquery/testing` from the start:

| Template    | Runner                                   | Helpers shown                                              |
| ----------- | ---------------------------------------- | ---------------------------------------------------------- |
| `cdn`       | `bun test` + happy-dom                   | `renderComponent`, `fireEvent.input`, `within`, `waitFor`  |
| `spa`       | `bun test` + happy-dom                   | `screen`, `within`, `userEvent`, `waitFor`, `flushEffects` |
| `ssr`       | `node --test` / `bun test` / `deno test` | `within` on server-rendered HTML                           |
| `fullstack` | `bun test` + happy-dom                   | `screen`, `userEvent`, `waitFor`, `mockFetch`              |

The `cdn`, `spa` and `fullstack` tests run with [Bun](https://bun.sh), whatever
package manager installed the project. When you extend them, query the way a
user finds things — `screen.getByRole('button', { name: 'Add' })`,
`getByLabelText('Title')` — and interact through `userEvent`. Its clicks are
left-button `MouseEvent`s, so clicking a submit button submits its form, a
checkbox toggles and fires `change`, and a `<bq-link>` navigates.

## Versions

The templates depend on the bQuery release the scaffolder was published with
(`^<version>`; the CDN template pins the exact version). Scaffolding never
contacts the registry.

## Programmatic API

The CLI is a thin wrapper around `scaffold()`, which you can call yourself:

```ts
import { scaffold } from 'create-bquery';

const { targetDir, files } = await scaffold({
  targetDir: 'my-app',
  template: 'ssr', // 'cdn' | 'spa' | 'ssr' | 'fullstack'
  runtime: 'bun', // ssr only: 'node' | 'bun' | 'deno'
  projectName: 'my-app', // default: the directory name
  force: false,
});
```

It throws a `ScaffoldError` with a `code` (`INVALID_TEMPLATE`,
`INVALID_RUNTIME`, `INVALID_NAME`, `DIR_NOT_EMPTY`, `NOT_A_DIRECTORY`,
`MISSING_TARGET`, `SYMLINK_IN_TARGET`). `validateProjectName()`, `detectPackageManager()` and
`projectCommands()` are exported too.

## Related

- [Getting Started](./getting-started.md) — the CDN and package-manager setups by hand.
- [Testing](./testing.md) — the full `@bquery/bquery/testing` API.
- [SSR](./ssr.md) and [Server](./server.md) — what the `ssr` and `fullstack` templates build on.

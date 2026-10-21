# create-bquery

Scaffold a new [bQuery.js](https://bquery.js.org) project.

```bash
npm create bquery@latest my-app
```

Pick a template interactively, or pass everything on the command line:

```bash
npm create bquery@latest my-app -- --template ssr --runtime bun --yes
bun create bquery my-app --template fullstack
```

## Templates

| Template    | What you get                                                                     |
| ----------- | -------------------------------------------------------------------------------- |
| `cdn`       | One HTML page, bQuery from a pinned CDN URL, no toolchain.                       |
| `spa`       | Router + store + view, Vite and TypeScript.                                      |
| `ssr`       | Server-rendered pages on Node, Bun or Deno (`--runtime`), one shared `handle()`. |
| `fullstack` | Server + forms + SSR with hydration and CSRF protection, on Bun.                 |

Every template ships with tests written against
[`@bquery/bquery/testing`](https://bquery.js.org/guide/testing).

## Options

| Option                  | Default      | Description                                            |
| ----------------------- | ------------ | ------------------------------------------------------ |
| `[dir]`                 | `bquery-app` | Directory to create; its name is the package name.     |
| `-t, --template <name>` | `spa`        | `cdn`, `spa`, `ssr`, `fullstack`.                      |
| `-r, --runtime <name>`  | `node`       | `node`, `bun`, `deno` (`ssr` only).                    |
| `--pm <name>`           | detected     | `npm`, `bun`, `pnpm`, `yarn` for the printed commands. |
| `--name <name>`         | dir name     | Package name.                                          |
| `-y, --yes`             |              | Do not prompt; use defaults.                           |
| `-f, --force`           |              | Write into a non-empty directory.                      |

Prompts appear only when stdin is a terminal and an option is missing.

## Programmatic use

```js
import { scaffold } from 'create-bquery';

await scaffold({ targetDir: 'my-app', template: 'ssr', runtime: 'deno' });
```

Full documentation: <https://bquery.js.org/guide/create-bquery>

## License

MIT

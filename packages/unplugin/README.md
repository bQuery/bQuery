# @bquery/unplugin

The official bundler plugin for [bQuery](https://bquery.js.org). It is built on
[unplugin](https://unplugin.unjs.io/): one implementation, with adapters for
**Vite**, **Rollup**, **webpack**, **Rspack** and **esbuild**.

- **Views** (on by default): imports of `*.view.html` and `*.html?bq-view` are
  precompiled with `@bquery/bquery/view/compiler`. The output is CSP-safe and
  never calls `new Function()`. Supports HMR in Vite.
- **File routes** (on by default): `virtual:bquery/routes` builds the route
  table from `src/routes` with `createFileRoutes()`, using lazy `import()`.
  It regenerates when files are added or removed in Vite.
- **i18n** (opt-in): keeps JSON catalogs in sync with `t()` / `tc()` /
  `defineMessages()` in your source, and serves them as
  `virtual:bquery/messages` with hot reloading in Vite.
- **CSP** (opt-in, Vite only): stamps a nonce on every script and style tag in
  dev and sends a matching `Content-Security-Policy` header.
- **SSR** (opt-in, Vite only): a dev middleware that renders HTML navigations
  through your server entry with `ssrLoadModule()`.

```sh
npm install -D @bquery/unplugin
```

```ts
// vite.config.ts
import bquery from '@bquery/unplugin/vite';

export default {
  plugins: [
    bquery({
      i18n: { catalog: 'locales/en.json', locales: ['locales/de.json'] },
      csp: true,
      ssr: { entry: 'src/entry-server.ts' },
    }),
  ],
};
```

Each bundler has its own entry: `@bquery/unplugin/rollup`,
`@bquery/unplugin/webpack`, `@bquery/unplugin/rspack` and
`@bquery/unplugin/esbuild`. To type the virtual modules, add
`/// <reference types="@bquery/unplugin/client" />`.

```ts
import { createRouter } from '@bquery/bquery/router';
import { createI18n } from '@bquery/bquery/i18n';
import { routes } from 'virtual:bquery/routes';
import { messages, hotReload } from 'virtual:bquery/messages';
import template from './views/app.view.html';

const router = createRouter({ routes });
const i18n = hotReload(createI18n({ locale: 'en', messages }));
```

The SSR entry exports `render(request: Request, ctx)`. `ctx` holds `url`,
`template`, `nonce`, `dev` and `server`. `render` returns an HTML string, a
`Response`, or `null` to fall through to the next middleware.

See the [bundler plugin guide](https://bquery.js.org/guide/bundler-plugin) for
every option, the render contract and the limitations.

## License

MIT

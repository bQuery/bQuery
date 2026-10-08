# bQuery Notes — a full-stack example

A small notes app that shows the bQuery modules working together at
application scale: one TypeScript codebase, no framework besides bQuery, no
bundler config.

```bash
bun install            # from the repository root
bun examples/fullstack/server.ts
```

Open <http://localhost:3000/> and sign in with **ada@example.com /
lovelace**. Set `PORT` to change the port and `SESSION_SECRET` to keep
sessions across restarts.

## What it covers

| Concern                   | Where                                               | bQuery APIs                                                                                       |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Auth                      | [`server/app.ts`](./server/app.ts)                  | `session()`, `$regenerate()` on sign-in, `guard()`, `rateLimit()` per account                     |
| CSRF                      | `server/app.ts`, [`client.ts`](./client.ts)         | `csrf()` bound to the session, `csrfToken()`, `x-csrf-token` header                               |
| Forms + server validation | [`shared/schema.ts`](./shared/schema.ts)            | one Standard Schema for `createForm({ schema })` and `validate()`                                 |
| Router with loaders       | `server/app.ts`                                     | routes with `meta.loader`, `createSSRRouterContext()`                                             |
| SSR + hydration           | [`shared/pages.ts`](./shared/pages.ts), `client.ts` | `renderToString()`, embedded state, `hydrate({ onMismatch: 'repair' })`                           |
| Store persistence         | `client.ts`                                         | `createPersistedStore()` keeps the unsent draft across reloads                                    |
| i18n                      | [`shared/messages.ts`](./shared/messages.ts)        | `defineMessages()`, ICU plurals, `negotiateLocale()` from `?lang=`, a cookie or `Accept-Language` |
| Optimistic updates        | `client.ts`                                         | deleting a note updates the list first and rolls back on failure                                  |

The schema's error messages are i18n keys, so the browser and the server
report the same problems in the user's language.

## Layout

```text
fullstack/
├── server.ts           # entry: bundles client.ts with Bun.build() and listens
├── server/
│   ├── app.ts          # createApp(): the request pipeline (testable via app.handle())
│   └── notes-repo.ts   # in-memory storage — swap for a database
├── client.ts           # hydration, form, persisted draft
├── shared/
│   ├── schema.ts       # Standard Schema definitions used on both sides
│   ├── messages.ts     # en/de catalogs
│   └── pages.ts        # page templates rendered by the server, hydrated by the client
└── styles.css
```

`shared/schema.ts` hand-rolls a minimal Standard Schema builder only to keep
the example dependency-free; in a real app write the schemas with Zod,
Valibot or ArkType and nothing else changes.

## Notes on the patterns

- **Loop templates and hydration.** The server output of `bq-for` contains
  the rendered items but not the loop template, so `client.ts` puts
  `noteItemTemplate` back into the list before calling `hydrate()`; the list
  is then re-rendered from client state.
- **Handlers inside `bq-for`.** `bq-on` handlers see raw signals (so
  `count.value++` works), and loop variables are signals — the delete button
  calls `remove(note.value.id)`, while `bq-text` reads `note.id`.
- **Cookies.** `secureCookies` is on when `NODE_ENV=production`; then the
  session and CSRF cookies get the `__Host-` prefix and need HTTPS.

## Tests

- `bun test tests/example-fullstack.test.ts` drives the pipeline in-process:
  redirects, locale negotiation, CSRF, rate limiting, loaders, schema
  validation and the client bundle build.
- `bun run test:browser` starts this app next to the browser fixtures and runs
  [`browser/fullstack.pw.ts`](../../browser/fullstack.pw.ts) end to end in
  Chromium, Firefox and WebKit.

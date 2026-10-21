# {{projectName}}

A full-stack [bQuery](https://bquery.js.org) app on [Bun](https://bun.sh): a
notes list rendered on the server and hydrated in the browser, a form validated
on both sides with the same rules, and a JSON API protected against CSRF.

## Run it

```bash
bun install
bun run dev          # bun --watch server.ts → http://localhost:3000/
```

Set `PORT` to change the port and `CSRF_SECRET` to keep tokens valid across
restarts. With `NODE_ENV=production` (`bun run start`) cookies are `Secure`,
which needs HTTPS.

## Files

```text
├── server.ts            # entry: bundles client.ts with Bun.build() and listens
├── server/
│   ├── app.ts           # createApp(): CSRF, JSON API, pages with route loaders
│   └── notes-repo.ts    # in-memory storage — swap for a database
├── client.ts            # browser entry: reads the embedded state, hydrates
├── client/notes.ts      # createForm(), optimistic delete, hydrate()
├── shared/
│   ├── note.ts          # the note type and validation rules (both sides)
│   └── pages.ts         # templates rendered on the server, hydrated in the browser
├── styles.css
└── test/
    ├── setup.ts         # happy-dom, preloaded by bunfig.toml
    ├── server.test.ts   # drives app.handle() in-process: SSR, CSRF, validation
    └── client.test.ts   # hydrates the server's HTML; mockFetch() stands in for the API
```

## Test it

```bash
bun run test         # bun test
bun run typecheck    # tsc
```

The tests use [`@bquery/bquery/testing`](https://bquery.js.org/guide/testing):
`screen` queries (by role and accessible name, label and text), `userEvent`,
`waitFor` and `mockFetch()`.

## Where to go next

The [bQuery Notes example](https://github.com/bQuery/bQuery/tree/main/examples/fullstack)
this template is cut down from adds sign-in with `session()`, rate limiting and
English/German messages with the i18n module.

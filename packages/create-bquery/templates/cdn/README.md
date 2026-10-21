# {{projectName}}

A zero-build [bQuery](https://bquery.js.org) page: plain HTML and JavaScript,
bQuery loaded from a CDN, no bundler and no compile step.

## Run it

Browsers only load module scripts over `http://`, so serve the folder:

```bash
npm start            # node serve.js → http://localhost:3000/
```

Any static file server works too, for example `python3 -m http.server`.

## Files

```text
├── index.html     # the page; its import map points "@bquery/bquery" at the CDN
├── app.js         # mountGreeting() and the <click-counter> component
├── styles.css
├── serve.js       # tiny static server for `npm start`
└── test/
    ├── setup.js   # happy-dom, preloaded by bunfig.toml
    └── app.test.js
```

## Test it

The tests run with [Bun](https://bun.sh) against the same bQuery version from
npm, using [`@bquery/bquery/testing`](https://bquery.js.org/guide/testing):

```bash
npm install
npm test             # bun test
```

## Upgrading bQuery

The version is pinned in two places — the import map in `index.html` and
`devDependencies` in `package.json`. Change both together.

# bQuery DevTools (browser extension)

A reference DevTools extension for inspecting bQuery apps: a **component tree**,
live **signal/store** values, and a reactive **timeline**. It connects to the
stable bridge protocol shipped in `@bquery/bquery/devtools` (`connectDevtoolsBridge`,
protocol **v1**).

## Enable the bridge in your app

```ts
import { enableDevtools, connectDevtoolsBridge } from '@bquery/bquery/devtools';

enableDevtools(true);
connectDevtoolsBridge(); // exposes the v1 protocol over window.postMessage
```

## Load the extension (Chromium)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.
4. Open DevTools on a page running a bQuery app with the bridge enabled; select
   the **bQuery** panel.

> Firefox: load via `about:debugging` → **This Firefox** → **Load Temporary
> Add-on**. The same Manifest V3 + `chrome.*` (polyfilled as `browser.*`) APIs
> apply; minor manifest tweaks may be required depending on the Firefox version.

## Protocol (v1)

Messages carry `source: 'bquery-devtools'` and a version `v`.

| Direction    | `kind`     | Purpose                                      |
| ------------ | ---------- | -------------------------------------------- |
| panel → page | `hello`    | Announce the panel; page replies with `init` |
| panel → page | `request`  | `{ id, method, params }`                     |
| page → panel | `init`     | `{ capabilities }` handshake                 |
| page → panel | `response` | `{ id, result \| error }`                    |
| page → panel | `event`    | A streamed timeline `entry`                  |

**Methods:** `ping`, `getSnapshot`, `getTimeline` (`{ limit }`), `getComponentTree`.
Extra/override methods can be supplied to `connectDevtoolsBridge({ methods })`.

Time-travel is built on the `getSnapshot` / `getTimeline` primitives plus the
module's existing snapshot/diff helpers (`exportDevtoolsSnapshot`,
`diffSignals`, `diffStores`).

This extension is a reference scaffold: the bridge protocol is the stable,
versioned contract; the panel UI is intentionally minimal and meant to be
extended.

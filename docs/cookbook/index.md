# Cookbook

Short, focused recipes that solve one problem each. Each recipe states the **problem**, gives a **minimal working solution**, and links to the relevant module guide for depth.

::: tip Work in progress
The cookbook is being split out from the long-form [Examples & Recipes](/guide/examples) page into one recipe per file. Until that work lands, the [Examples & Recipes](/guide/examples) page remains the most complete source of copy-paste snippets.
:::

## Recipe categories (planned)

| Category               | What it covers                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **DOM basics**         | Selectors, traversal, events, manipulation, delegated handlers.                                          |
| **Reactivity**         | Signals, computed, effects, batching, watching, untracking.                                              |
| **Async & data**       | Fetch with `useFetch`, polling, paginated lists, infinite scrolls, REST resources, optimistic updates.   |
| **Realtime**           | WebSocket, channels, SSE, heartbeats, reconnect strategies.                                              |
| **Components**         | Defining a component, slots, refs, lifecycle, errorBoundary, props & attributes, delegated events.       |
| **Routing**            | Programmatic navigation, guards, lazy routes, route params, navigation results, beforeResolve.           |
| **State**              | Store actions, persistence plugins, snapshots, testing stores with `mockStore`.                          |
| **Forms**              | Schema validation, field arrays, async validators, SSR-safe form state, `bindForm`.                      |
| **i18n & a11y**        | Locale negotiation, RTL, focus traps, live regions, keyboard-user detection.                             |
| **Motion**             | Springs, tweens, timelines, FLIP, parallax, reduced-motion-aware animations.                             |
| **Drag & drop**        | Sortable lists with keyboard support, grid snapping, viewport bounds.                                    |
| **SSR & server**       | Streaming, cache keys, edge handlers, `app.listen()`, body parsing, cookies, SSE responses.              |
| **Devtools & testing** | Trace a signal, diff stores, mock a fetch, write a shadow-DOM-aware screen query.                        |
| **Bundle & deploy**    | Pick a sub-path import, configure Vite, deploy SSR to Node / Bun / Deno / edge.                          |

## Today

Until each recipe has its own page, the existing [Examples & Recipes](/guide/examples) page contains ~30 worked snippets covering the categories above. Each module guide also has its own recipes section.

## See also

- [Examples & Recipes](/guide/examples)
- [Workflows](/workflows/) — longer end-to-end tutorials
- [Module guides](/guide/api-core) — depth for each topic
- [Runnable examples on GitHub](https://github.com/bQuery/bQuery/tree/main/examples)

---
layout: home
title: bQuery.js
hero:
  name: bQuery.js
  text: The jQuery for the modern Web Platform.
  tagline: Zero build. Secure by default. DOM-first reactivity, runtime-agnostic SSR, and server primitives.
  image:
    src: /assets/bquerry-logo.svg
    alt: bQuery Logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Core API
      link: /guide/api-core
features:
  - title: Zero Build
    details: Works directly in the browser via CDN or ES modules. Vite is optional, not required.
  - title: Async Data Primitives
    details: Signal-based async data, fetch, HTTP client, polling, pagination, and request-state workflows without framework ceremony.
  - title: Off-Main-Thread Concurrency
    details: Zero-build worker tasks, explicit RPC helpers, bounded pools, reactive worker state, and collection helpers for predictable background work.
  - title: Realtime & REST
    details: Typed WebSocket/SSE composables, channel multiplexing, REST helpers, optimistic resources, and reactive submissions.
  - title: Secure by Default
    details: Sanitized DOM operations and Trusted Types compatibility.
  - title: Foundation Components
    details: Register a default Web Component library, wire signals into components, and preview it in Storybook.
  - title: Storybook Helpers
    details: Author safe stories with storyHtml(), when(), and boolean attribute shorthand.
  - title: Platform APIs
    details: Storage, cache, cookies, page metadata, announcers, and shared runtime config.
  - title: Forms & i18n
    details: Reactive forms, validators, locale-aware messages, pluralization, and Intl formatting.
  - title: Accessibility & media
    details: Focus traps, skip links, audits, media preference signals, viewport/network state, and clipboard helpers.
  - title: Testing, SSR & Server
    details: Testing utilities, runtime devtools, runtime-agnostic SSR, hydration strategies, and lightweight backend helpers.
---

## Why bQuery

bQuery.js bridges vanilla JavaScript and build-step frameworks. It keeps the directness of jQuery while adding reactivity, async data composables, HTTP clients, polling, pagination, WebSocket/SSE transports, REST helpers, lightweight server middleware, runtime-agnostic SSR, WebSocket sessions, native components, motion, forms, i18n, accessibility, media signals, drag-and-drop, plugins, devtools, and testing in a modular, progressive way.

## New in 1.11.0

Runtime-agnostic SSR now spans synchronous, async, streaming, and full `Response` rendering with a DOM-free fallback for Node.js ≥ 24, Deno, and Bun. The new `@bquery/bquery/server` entry point adds dependency-free routing, safe response helpers, and runtime-agnostic WebSocket sessions — while `1.10.0`'s concurrency pools, RPC workers, and collection helpers remain first-class citizens.

## New to bQuery?

Start with the [Getting Started](/guide/getting-started) guide, then explore the [Examples & Recipes](/guide/examples) for practical, copy-paste-ready code. Coming from jQuery? The [Migration Guide](/guide/migration) maps jQuery patterns to bQuery equivalents.

## Looking for answers?

Check the [FAQ & Troubleshooting](/guide/faq) for common questions, or read the [Best Practices](/guide/best-practices) guide for patterns that scale from small scripts to large applications.

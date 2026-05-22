---
layout: home
title: bQuery.js
hero:
  name: bQuery.js
  text: The full-stack web framework that speaks jQuery.
  tagline: Batteries-included TypeScript framework with signals, Web Components, SSR, routing, and zero mandatory build step.
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
    details: Testing utilities, runtime devtools, runtime-agnostic SSR, hydration strategies, and dependency-free backend helpers.
---

## Why bQuery

bQuery.js is a batteries-included framework for the modern web. It brings jQuery's direct API ergonomics to reactivity, async data, HTTP clients, polling, pagination, WebSocket/SSE transports, REST helpers, dependency-free server routing, runtime-agnostic SSR, WebSocket sessions, native components, motion, forms, i18n, accessibility, media signals, drag-and-drop, plugins, devtools, and testing in one modular system.

## New in 1.13.0

`@bquery/bquery/forms` graduates into a batteries-included tier (new validators, combinators, dynamic field arrays via `createFieldArray`, fluent `schema()`, `bindForm`/`bindField`, scope-aware composables, and SSR resumability). `@bquery/bquery/component` adds slot/ref helpers, DI (`provide`/`inject`), `beforeUnmount` and `errorBoundary` hooks, `useAsync`/`whenIdle`, sanitizer-safe delegated events, a `css` tagged template with adoptable stylesheets, and keyed list rendering. `@bquery/bquery/motion` ships a major expansion (full Penner easings + composers, `tween()`/`animateValue()`, `animateTo()`, `springVector`, label-aware timelines with `reverse`/`repeat`/`yoyo`/`progress`, and new `scrollProgress`/`inView`/`magnetic`/`tilt`/`shake`/`pulse`/`countUp` primitives). `@bquery/bquery/core` grows with array, function, object, string, number, misc, and type-guard helpers via its utilities exports — while all 1.12.x and earlier APIs remain unchanged.

## New to bQuery?

Start with the [Getting Started](/guide/getting-started) guide for installation and orientation, then follow the step-by-step [Tutorial](/guide/tutorial) to build a real Notes app that exercises Core, Reactive, View, Store, Forms, Router, Component, Motion, Platform, A11y, and Testing in one project. The [Examples & Recipes](/guide/examples) cookbook has copy-paste-ready snippets for common tasks. Coming from jQuery? The [Migration Guide](/guide/migration) maps jQuery patterns to bQuery equivalents.

## Looking for answers?

Check the [FAQ & Troubleshooting](/guide/faq) for common questions, or read the [Best Practices](/guide/best-practices) guide for patterns that scale from small scripts to large applications.

# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to Semantic Versioning.

## Releases

- [Changelog](#changelog)
  - [Releases](#releases)
  - [[1.2.0] - 2026-01-24](#120---2026-01-24)
    - [Added](#added)
  - [[1.1.2] - 2026-01-24](#112---2026-01-24)
    - [Fixed](#fixed)
    - [Security](#security)
  - [[1.1.1] - 2026-01-24](#111---2026-01-24)
    - [Fixed](#fixed-1)
  - [[1.1.0] - 2026-01-23](#110---2026-01-23)
    - [Added](#added-1)
    - [Changed](#changed)
    - [Security](#security-1)
  - [[1.0.2] - 2026-01-23](#102---2026-01-23)
    - [Fixed](#fixed-2)
  - [[1.0.1] - 2026-01-23](#101---2026-01-23)
    - [Fixed](#fixed-3)
  - [[1.0.0] - 2026-01-21](#100---2026-01-21)
    - [Added](#added-2)

## [1.2.0] - 2026-01-24

### Added

- **Router**: New SPA client-side routing module with History API support.
  - `createRouter()` factory with routes, base path, and hash mode options.
  - `navigate()`, `back()`, `forward()` navigation functions.
  - `beforeEach` / `afterEach` navigation guards.
  - Route params (`:id`), query string parsing, and wildcard (`*`) routes.
  - `currentRoute` reactive signal for tracking current route state.
  - `link()` and `interceptLinks()` helpers for declarative navigation.
  - `resolve()` for named route URL generation.
  - `isActive()` and `isActiveSignal()` for active link styling.
- **Store**: New Pinia/Vuex-style state management module built on signals.
  - `createStore({ id, state, getters, actions })` for defining stores.
  - Reactive getters via `computed()` and state via `signal()`.
  - Actions with automatic `this` context binding.
  - `$reset()`, `$patch()`, `$subscribe()`, `$state` store utilities.
  - `createPersistedStore()` for localStorage persistence.
  - `registerPlugin()` for extending store functionality.
  - `mapState()` and `mapActions()` composition helpers.
  - `getStore()`, `listStores()`, `destroyStore()` for store registry.
  - Devtools integration via `window.__BQUERY_DEVTOOLS__`.
- **View**: New declarative DOM binding module (Vue/Alpine-style directives).
  - `bq-text` and `bq-html` for content binding.
  - `bq-if` and `bq-show` for conditional rendering.
  - `bq-class` and `bq-style` for class/style binding.
  - `bq-model` for two-way input binding.
  - `bq-bind:attr` for attribute binding.
  - `bq-on:event` for event binding.
  - `bq-for` for list rendering with `(item, index) in items` syntax.
  - `bq-ref` for element references.
  - `mount()` function to bind context to DOM.
  - `createTemplate()` for reusable template factories.
  - Custom directive prefix support.
  - Automatic HTML sanitization for security.

## [1.1.2] - 2026-01-24

### Fixed

- **Docs**: Fixed import paths and added error handling in agents documentation.

### Security

- Added `rel="noopener noreferrer"` to external links for improved security.

## [1.1.1] - 2026-01-24

### Fixed

- Fixed a possibly dangrous html handling in the playground examples.

## [1.1.0] - 2026-01-23

### Added

- **Core**: `delegate(event, selector, handler)` method for event delegation on dynamically added elements.
- **Core**: `wrap(wrapper)` method to wrap elements with a new parent container.
- **Core**: `unwrap()` method to remove parent element while keeping children.
- **Core**: `replaceWith(content)` method to replace an element with new content.
- **Core**: `scrollTo(options?)` method for smooth scrolling to elements.
- **Core**: `serialize()` method to serialize form data as an object.
- **Core**: `serializeString()` method to serialize form data as URL-encoded string.
- **Reactive**: `watch(signal, callback)` function to observe signal changes with old/new values.
- **Reactive**: `readonly(signal)` function to create immutable signal wrappers.
- **Reactive**: `untrack(fn)` function to read signals without creating dependencies.
- **Reactive**: `isSignal(value)` type guard to check if a value is a Signal.
- **Reactive**: `isComputed(value)` type guard to check if a value is a Computed.
- **Reactive**: `ReadonlySignal<T>` type for read-only signal interfaces.
- **Component**: `beforeMount()` lifecycle hook that runs before initial render.
- **Component**: `beforeUpdate(props)` lifecycle hook that can prevent updates by returning `false`.
- **Component**: `onError(error)` lifecycle hook for error handling in components.
- **Component**: `validator` property for prop definitions to validate prop values.
- **Security**: Extended dangerous tag list including `svg`, `math`, `template`, `slot`, `base`, `meta`.
- **Security**: DOM clobbering protection with reserved ID/name filtering.
- **Security**: Zero-width Unicode character stripping in URL normalization.

### Changed

- **Reactive**: Optimized observer stack operations from O(n) array copy to O(1) push/pop (~40% performance improvement).
- **Security**: Added `file:` protocol to blocked URL schemes.
- **Security**: Extended dangerous attribute prefixes with `xlink:` and `xmlns:`.

### Security

- Fixed prototype pollution vulnerability in `utils.merge()` by filtering `__proto__`, `constructor`, and `prototype` keys.
- Enhanced HTML sanitizer to block additional XSS vectors through SVG, MathML, and template elements.
- Added protection against DOM clobbering attacks by preventing reserved IDs like `document`, `cookie`, `location`.
- Improved URL sanitization to prevent Unicode bypass attacks using zero-width characters.

## [1.0.2] - 2026-01-23

### Fixed

- Fixed brodken documentation links in README.md.

## [1.0.1] - 2026-01-23

### Fixed

- Corrected the package name in `package.json` to `@bquery/bquery` for proper npm publishing.
- Updated the author field in `package.json` to reflect the main maintainer.
- Revised the homepage URL in `package.json` to point to the official bQuery website.
- Added publish configuration in `package.json` to ensure public accessibility on npm registry.

## [1.0.0] - 2026-01-21

### Added

- Core API with selectors (`$`, `$$`), `BQueryElement`/`BQueryCollection`, DOM operations, events, and utilities.
- Reactive module with `signal`, `computed`, `effect`, `batch`, plus `Signal`/`Computed` types.
- Component helper for Web Components including `component()` and the `html` template tag, prop definitions, and lifecycle hooks.
- Motion module with view transitions, FLIP animations (`capturePosition`, `flip`, `flipList`), and spring physics (`spring`, presets).
- Security module with sanitizing utilities, Trusted Types integration, and CSP helpers.
- Platform module with unified adapters for storage, buckets, cache, and notifications.
- VitePress documentation and Vite playground for quick demos.
- Test suite for Core, Reactive, Motion, Component, and Security.

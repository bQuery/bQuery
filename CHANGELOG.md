# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to Semantic Versioning.

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

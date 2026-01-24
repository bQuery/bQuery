/**
 * bQuery.js — The jQuery for the Modern Web Platform
 *
 * A zero-build, TypeScript-first library that bridges vanilla JavaScript
 * and build-step frameworks with modern features.
 *
 * @module bquery
 * @see https://github.com/bquery/bquery
 */

// Core module: selectors, DOM ops, events, utils
export * from './core/index';

// Reactive module: signals, computed, effects, binding
export * from './reactive/index';

// Component module: Web Components helper
export * from './component/index';

// Motion module: view transitions, FLIP, springs
export * from './motion/index';

// Security module: sanitizer, CSP, Trusted Types
export * from './security/index';

// Platform module: storage, buckets, notifications, cache
export * from './platform/index';

// Router module: SPA routing, navigation guards
export * from './router/index';

// Store module: state management with signals
export * from './store/index';

// View module: declarative DOM bindings
export * from './view/index';

/**
 * bQuery.js Testing Utilities
 *
 * Helpers for mounting components, controlling signals, mocking the router,
 * dispatching events, and asserting async conditions in tests.
 *
 * @module bquery/testing
 *
 * @example
 * ```ts
 * import {
 *   renderComponent,
 *   flushEffects,
 *   mockSignal,
 *   mockRouter,
 *   fireEvent,
 *   waitFor,
 * } from '@bquery/bquery/testing';
 * ```
 */

// Runtime API
export {
  renderComponent,
  flushEffects,
  mockSignal,
  mockRouter,
  fireEvent,
  waitFor,
} from './testing';

// 1.14+ — Extension helpers
export {
  autoCleanup,
  cleanup,
  expectAccessible,
  flushPromises,
  getReactiveSummary,
  mockComputed,
  mockEffect,
  mockFetch,
  mockForm,
  mockI18n,
  mockStore,
  mockWebSocket,
  nextTick,
  prettyDOM,
  runScheduled,
  screen,
  tick,
  userEvent,
  within,
} from './extensions';

// Types
export type {
  FireEventOptions,
  MockRouter,
  MockRouterOptions,
  MockSignal,
  RenderComponentOptions,
  RenderResult,
  TestRoute,
  WaitForOptions,
} from './types';

export type {
  AccessibilityResult,
  MockFetchRoute,
  MockForm,
  MockI18n,
  MockStore,
  MockWebSocket,
  Queries,
} from './extensions';

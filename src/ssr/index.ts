/**
 * SSR / Pre-rendering module for bQuery.js.
 *
 * Server-side rendering, hydration, store-state serialization and runtime
 * adapters for bQuery applications. The module is **runtime-agnostic** and
 * runs on Bun, Deno and Node.js ≥ 24 without any external dependency.
 *
 * The synchronous `renderToString()` keeps its previous behaviour for
 * backward compatibility but now automatically falls back to a fully
 * DOM-free renderer when no `DOMParser` is available — that is what makes
 * the same code path work on every server runtime.
 *
 * ## Highlights
 *
 * - **`renderToString(template, data)`** — synchronous render to HTML.
 * - **`renderToStringAsync(template, data, ctx?)`** — awaits Promises and
 *   `defer()` values in the binding context.
 * - **`renderToStream(template, data, ctx?)`** — Web `ReadableStream<Uint8Array>`.
 * - **`renderToResponse(template, data, ctx?)`** — high-level `Response`
 *   wrapper with ETag, Cache-Control, head & store-state injection.
 * - **`createSSRContext(...)`** — request/response context bag.
 * - **`createHeadManager()`** — `<title>`, `<meta>`, `<link>` and
 *   `<script>` collection.
 * - **`hydrateMount` / `hydrateOnVisible` / `hydrateOnIdle` /
 *   `hydrateOnInteraction` / `hydrateOnMedia` / `hydrateIsland`** — full
 *   progressive-hydration toolkit.
 * - **Runtime adapters** — `createWebHandler`, `createBunHandler`,
 *   `createDenoHandler`, `createNodeHandler`, `createSSRHandler`.
 *
 * @module bquery/ssr
 */

// ---------------------------------------------------------------------------
// Existing public API (unchanged)
// ---------------------------------------------------------------------------
export { hydrateMount } from './hydrate';
export type { HydrateMountOptions } from './hydrate';
export { renderToString } from './render';
export {
  deserializeStoreState,
  hydrateStore,
  hydrateStores,
  serializeStoreState,
} from './serialize';
export type { SerializeResult } from './serialize';
export type {
  DeserializedStoreState,
  HydrationOptions,
  RenderOptions,
  SSRResult,
  SerializeOptions,
} from './types';

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------
export { detectRuntime, getSSRRuntimeFeatures, isBrowserRuntime, isServerRuntime } from './runtime';
export type { SSRRuntime, SSRRuntimeFeatures } from './runtime';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export { configureSSR, getSSRConfig } from './config';
export type { SSRDocumentImpl, SSRRendererBackend } from './config';

// ---------------------------------------------------------------------------
// Async/streaming render pipeline
// ---------------------------------------------------------------------------
export { renderToResponse, renderToStream, renderToStringAsync } from './render-async';
export type { AsyncRenderOptions, AsyncSSRResult, RenderToResponseOptions } from './render-async';

// ---------------------------------------------------------------------------
// SSR context
// ---------------------------------------------------------------------------
export { createSSRContext } from './context';
export type { CreateSSRContextOptions, SSRContext } from './context';

// ---------------------------------------------------------------------------
// Head + assets + nonce
// ---------------------------------------------------------------------------
export { createAssetManager, createHeadManager } from './head';
export type {
  AssetManager,
  HeadManager,
  SSRAsset,
  SSRHeadState,
  SSRLink,
  SSRMeta,
  SSRScript,
  UseHeadOptions,
} from './head';

// ---------------------------------------------------------------------------
// Async loaders / defer
// ---------------------------------------------------------------------------
export { defer, defineLoader } from './async';
export type { SSRLoader } from './async';

// ---------------------------------------------------------------------------
// Hydration strategies
// ---------------------------------------------------------------------------
export {
  hydrateIsland,
  hydrateOnIdle,
  hydrateOnInteraction,
  hydrateOnMedia,
  hydrateOnVisible,
} from './strategies';
export type { HydrationHandle } from './strategies';

// ---------------------------------------------------------------------------
// Hydration mismatch detection
// ---------------------------------------------------------------------------
export { verifyHydration } from './mismatch';
export type { HydrationMismatch, VerifyHydrationOptions } from './mismatch';
export { HYDRATION_HASH_ATTR } from './hash';

// ---------------------------------------------------------------------------
// Suspense / out-of-order streaming
// ---------------------------------------------------------------------------
export { renderToStreamSuspense } from './suspense';
export type { SuspenseStreamOptions } from './suspense';

// ---------------------------------------------------------------------------
// Router ↔ SSR bridge
// ---------------------------------------------------------------------------
export { createSSRRouterContext, resolveSSRRoute, runRouteLoaders } from './router-bridge';
export type { ResolvedSSRRoute, SSRRouteLoader } from './router-bridge';

// ---------------------------------------------------------------------------
// Versioned store snapshots
// ---------------------------------------------------------------------------
export { hydrateStoreSnapshot, readStoreSnapshot, serializeStoreSnapshot } from './store-snapshot';
export type {
  HydrateSnapshotOptions,
  HydrateSnapshotResult,
  SerializeSnapshotOptions,
  SerializeSnapshotResult,
  SSRStoreSnapshot,
} from './store-snapshot';

// ---------------------------------------------------------------------------
// Resumability
// ---------------------------------------------------------------------------
export { createResumableState, resumeState } from './resumability';
export type { CreateResumableStateOptions, ResumableState, ResumeReader } from './resumability';

// ---------------------------------------------------------------------------
// Runtime adapters
// ---------------------------------------------------------------------------
export {
  createBunHandler,
  createDenoHandler,
  createNodeHandler,
  createSSRHandler,
  createWebHandler,
} from './adapters';
export type {
  NodeHandlerOptions,
  NodeIncomingMessage,
  NodeServerResponse,
  SSRRequestHandler,
} from './adapters';

/**
 * Lightweight backend helpers for bQuery.js.
 *
 * Provides an Express-inspired middleware and routing layer that stays
 * dependency-free, tree-shakeable, and SSR-aware.
 *
 * @module bquery/server
 */

export { createServer } from './create-server';
export type {
  CreateServerOptions,
  ServerApp,
  ServerContext,
  ServerHandler,
  ServerHtmlResponseInit,
  ServerMiddleware,
  ServerNext,
  ServerQuery,
  ServerRenderResponseOptions,
  ServerRequestInit,
  ServerResponseInit,
  ServerRoute,
} from './types';

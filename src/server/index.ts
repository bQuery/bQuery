/**
 * Lightweight backend helpers for bQuery.js.
 *
 * Provides an Express-inspired middleware and routing layer that stays
 * dependency-free, tree-shakeable, and SSR-aware.
 *
 * @module bquery/server
 */

export { createServer, isServerWebSocketSession, isWebSocketRequest } from './create-server';
export type {
  CreateServerOptions,
  ServerApp,
  ServerContext,
  ServerHandler,
  ServerResult,
  ServerHtmlResponseInit,
  ServerMiddleware,
  ServerNext,
  ServerQuery,
  ServerRenderResponseOptions,
  ServerRequestInit,
  ServerResponseInit,
  ServerRoute,
  ServerWebSocketConnection,
  ServerWebSocketData,
  ServerWebSocketHandlerSet,
  ServerWebSocketMiddleware,
  ServerWebSocketNext,
  ServerWebSocketPeer,
  ServerWebSocketRouteHandler,
  ServerWebSocketSession,
} from './types';

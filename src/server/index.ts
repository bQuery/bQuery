/**
 * Lightweight backend helpers for bQuery.js.
 *
 * Provides an Express-inspired middleware and routing layer that stays
 * dependency-free, tree-shakeable, and SSR-aware.
 *
 * @module bquery/server
 */

export { createServer, isServerWebSocketSession, isWebSocketRequest } from './create-server';
export {
  ServerHttpError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from './errors';
export type {
  CreateServerOptions,
  ServerApp,
  ServerCookieOptions,
  ServerContext,
  ServerHandler,
  ServerResult,
  ServerHtmlResponseInit,
  ServerLimits,
  ServerListenHandle,
  ServerListenOptions,
  ServerMiddleware,
  ServerNext,
  ServerQuery,
  ServerRenderResponseOptions,
  ServerRequestInit,
  ServerResponseInit,
  ServerRoute,
  ServerSseEvent,
  ServerSseOptions,
  ServerWebSocketConnection,
  ServerWebSocketData,
  ServerWebSocketHandlerSet,
  ServerWebSocketMiddleware,
  ServerWebSocketNext,
  ServerWebSocketPeer,
  ServerWebSocketRouteHandler,
  ServerWebSocketSession,
} from './types';

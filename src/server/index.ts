/**
 * Lightweight backend helpers for bQuery.js.
 *
 * Provides an Express-inspired middleware and routing layer that stays
 * dependency-free, tree-shakeable, and SSR-aware, plus first-party session,
 * CSRF, guard, and auth primitives.
 *
 * @remarks
 * Stability: **targeting Stable in 1.15.0**. The `ctx`/`app` contract is frozen;
 * see the {@link https://bquery.js.org/guide/server | Server guide} for the
 * exit-criteria checklist and per-runtime support matrix.
 *
 * @module bquery/server
 */

export { createServer, isServerWebSocketSession, isWebSocketRequest } from './create-server';
export { createFileRouteServerRoutes, mountFileRoutes } from './file-routes';
export type { FileRouteServerOptions } from './file-routes';
export { ServerHttpError, badRequest, conflict, forbidden, notFound, unauthorized } from './errors';
export { memoryStore, session } from './session';
export { csrf, csrfToken } from './csrf';
export { guard } from './guard';
export { basicAuth, bearerAuth } from './auth';
export {
  base64UrlDecode,
  base64UrlEncode,
  randomId,
  randomToken,
  signValue,
  timingSafeEqual,
  unsignValue,
} from './crypto';
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
  ServerSession,
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
export type { MemoryStoreOptions, SessionData, SessionOptions, SessionStore } from './session';
export type { CsrfOptions } from './csrf';
export type { GuardOptions } from './guard';
export type { BasicAuthCredentials, BasicAuthOptions, BearerAuthOptions } from './auth';

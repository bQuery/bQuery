/**
 * Route guard primitive for the server module.
 *
 * Mirrors the router's guard ergonomics: a predicate decides whether the request
 * may proceed. Compose it as global or route-scoped middleware.
 *
 * @module bquery/server
 */

import { ServerHttpError } from './errors';
import type { ServerContext, ServerHandler, ServerMiddleware } from './types';

/** Options for {@link guard}. */
export interface GuardOptions {
  /** Status used when the predicate denies the request. Default `403`. */
  status?: number;
  /** Message used for the default denial response. Default `'Forbidden'`. */
  message?: string;
  /**
   * Custom handler invoked when the predicate denies the request. Overrides
   * `status`/`message` and lets you return a redirect or JSON body.
   */
  onDeny?: ServerHandler;
}

/**
 * Create middleware that allows the request only when `predicate` resolves
 * truthy; otherwise it denies with `onDeny` (if provided) or a
 * {@link ServerHttpError}.
 *
 * @example
 * ```ts
 * import { createServer, guard } from '@bquery/bquery/server';
 *
 * const app = createServer();
 * const requireUser = guard((ctx) => Boolean(ctx.session?.userId), { status: 401 });
 * app.get('/me', (ctx) => ctx.json({ id: ctx.session?.userId }), [requireUser]);
 * ```
 */
export const guard = (
  predicate: (ctx: ServerContext) => boolean | Promise<boolean>,
  options: GuardOptions = {}
): ServerMiddleware => {
  return async (ctx, next) => {
    if (await predicate(ctx)) {
      return next();
    }
    if (options.onDeny) {
      return options.onDeny(ctx);
    }
    throw new ServerHttpError(options.status ?? 403, options.message ?? 'Forbidden');
  };
};

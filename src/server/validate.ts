/**
 * Request validation middleware backed by Standard Schema.
 *
 * Any validator implementing [Standard Schema](https://standardschema.dev) —
 * Zod, Valibot, ArkType, … — validates the request body, query or route
 * params. The same schema can drive `createForm({ schema })` on the client, so
 * one definition covers client validation, server validation and the types.
 *
 * @module bquery/server
 */

import {
  validateWithSchema,
  type SchemaIssue,
  type StandardSchemaV1,
} from '../forms/standard-schema';
import type { ServerContext, ServerMiddleware } from './types';

/** Where {@link validate} reads the value to check. */
export type ValidateSource = 'body' | 'query' | 'params';

/** Options for {@link validate}. */
export interface ValidateOptions {
  /** Value to validate. Default `'body'` (parsed with `ctx.body()`). */
  source?: ValidateSource;
  /** Status of the default failure response. Default `400`. */
  status?: number;
  /**
   * Custom failure response. Receives the issues with their paths flattened
   * to plain keys. Default: `ctx.json({ error: 'Validation failed', issues }, { status })`.
   */
  onInvalid?: (issues: SchemaIssue[], ctx: ServerContext) => Response | Promise<Response>;
}

/** Middleware returned by {@link validate}, with a typed accessor for the result. */
export interface ValidateMiddleware<S extends StandardSchemaV1> extends ServerMiddleware {
  /**
   * The validated (and, for transforming schemas, parsed) value for this
   * request. Throws when called on a request this middleware did not validate.
   */
  data(ctx: ServerContext): StandardSchemaV1.InferOutput<S>;
}

const validatedValues = new WeakMap<ServerContext, Map<object, unknown>>();

/** Turn a multipart `Map` into a plain object; leave other bodies as they are. */
const toPlainBody = (body: unknown): unknown => {
  if (!(body instanceof Map)) return body;
  const out = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of body) out[String(key)] = value;
  return out;
};

const readSource = async (ctx: ServerContext, source: ValidateSource): Promise<unknown> => {
  if (source === 'query') return ctx.query;
  if (source === 'params') return ctx.params;
  return toPlainBody(await ctx.body());
};

/**
 * Validate the request against a Standard Schema before the route runs.
 *
 * On failure the request is answered with `400` and a JSON body
 * `{ error: 'Validation failed', issues: [{ message, path }] }`. On success
 * the validated value is available through the middleware's `data(ctx)`
 * accessor, and for `source: 'body'` also from `ctx.body()`.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { createServer, validate } from '@bquery/bquery/server';
 *
 * const Signup = z.object({ email: z.string().email(), age: z.number().min(18) });
 * const signup = validate(Signup);
 *
 * const app = createServer();
 * app.post('/signup', (ctx) => {
 *   const { email, age } = signup.data(ctx); // typed as z.output<typeof Signup>
 *   return ctx.json({ email, age }, { status: 201 });
 * }, [signup]);
 * ```
 */
export const validate = <S extends StandardSchemaV1>(
  schema: S,
  options: ValidateOptions = {}
): ValidateMiddleware<S> => {
  const source = options.source ?? 'body';
  const status = options.status ?? 400;

  const middleware = (async (ctx, next) => {
    const result = await validateWithSchema(schema, await readSource(ctx, source));
    if (!result.success) {
      if (options.onInvalid) return options.onInvalid(result.issues, ctx);
      return ctx.json({ error: 'Validation failed', issues: result.issues }, { status });
    }

    let values = validatedValues.get(ctx);
    if (!values) {
      values = new Map();
      validatedValues.set(ctx, values);
    }
    values.set(middleware, result.value);
    if (source === 'body') {
      const parsed = Promise.resolve(result.value);
      ctx.body = () => parsed;
    }
    return next();
  }) as ValidateMiddleware<S>;

  middleware.data = (ctx) => {
    const values = validatedValues.get(ctx);
    if (!values?.has(middleware)) {
      throw new Error(
        'bQuery server: validate().data(ctx) was called for a request this middleware did not validate. Register the middleware on the route.'
      );
    }
    return values.get(middleware) as StandardSchemaV1.InferOutput<S>;
  };

  return middleware;
};

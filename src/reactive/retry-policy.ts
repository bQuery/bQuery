/**
 * Shared retry policy for the HTTP client and `useFetch()`.
 *
 * Retries are limited to idempotent methods and to the statuses that signal a
 * transient condition by default, and a server-sent `Retry-After` header wins
 * over the client's own backoff.
 *
 * @module bquery/reactive
 * @internal
 */

/**
 * Methods retried by default. They are idempotent per RFC 9110 §9.2.2, so
 * repeating one after a timeout cannot create a duplicate side effect.
 */
export const DEFAULT_RETRY_METHODS: readonly string[] = Object.freeze([
  'GET',
  'HEAD',
  'OPTIONS',
  'PUT',
  'DELETE',
]);

/**
 * Statuses retried by default: request timeout, rate limiting and the gateway
 * errors. `500`/`501` are rarely transient and are not retried.
 */
export const DEFAULT_RETRY_STATUSES: readonly number[] = Object.freeze([408, 429, 502, 503, 504]);

/** Default upper bound for a server-requested `Retry-After` delay (ms). */
export const DEFAULT_MAX_RETRY_AFTER = 60_000;

/** @internal Whether `method` is in the retryable method list (`'*'` matches all). */
export const isRetryableMethod = (
  method: string | undefined,
  methods: readonly string[] = DEFAULT_RETRY_METHODS
): boolean => {
  const normalized = (method ?? 'GET').toUpperCase();
  return methods.some((entry) => entry === '*' || entry.toUpperCase() === normalized);
};

/** @internal Whether `status` is in the retryable status list. */
export const isRetryableStatus = (
  status: number,
  statuses: readonly number[] = DEFAULT_RETRY_STATUSES
): boolean => statuses.includes(status);

/**
 * Parse a `Retry-After` header value into a delay in milliseconds.
 *
 * Accepts delta-seconds (`120`) and HTTP dates. Returns `undefined` for a
 * missing or malformed value and for a date that has already passed.
 *
 * @internal
 */
export const parseRetryAfter = (
  value: string | null | undefined,
  now: number = Date.now()
): number | undefined => {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds * 1000 : undefined;
  }
  // HTTP dates always carry letters (day/month names); bare numbers with a sign
  // or fraction are malformed delta-seconds and must not reach Date.parse().
  if (!/[a-z]/i.test(trimmed)) return undefined;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  // A date in the past says nothing about when to retry; fall back to backoff
  // rather than retrying immediately.
  return date > now ? date - now : undefined;
};

/**
 * Resolve the delay requested by a response's `Retry-After` header, capped at
 * `maxRetryAfter`. Returns `undefined` when the header is absent or invalid.
 *
 * @internal
 */
export const resolveRetryAfterDelay = (
  headers: Headers | undefined,
  maxRetryAfter: number = DEFAULT_MAX_RETRY_AFTER
): number | undefined => {
  const requested = parseRetryAfter(headers?.get('retry-after'));
  if (requested === undefined) return undefined;
  return Math.min(requested, Math.max(0, maxRetryAfter));
};

/** @internal Exponential backoff used when no explicit delay is configured. */
export const resolveBackoffDelay = (
  delay: number | ((attempt: number) => number) | undefined,
  attempt: number
): number => {
  if (delay == null) return Math.min(1000 * 2 ** attempt, 30_000);
  if (typeof delay === 'number') return delay;
  return delay(attempt);
};

/** Retry options both clients share. */
export interface RetryDelayOptions {
  delay?: number | ((attempt: number) => number);
  maxRetryAfter?: number;
  respectRetryAfter?: boolean;
}

/**
 * Delay before the next attempt: the response's `Retry-After` first (capped
 * at `maxRetryAfter`), then the configured backoff.
 *
 * @internal
 */
export const resolveRetryDelay = (
  retry: RetryDelayOptions,
  headers: Headers | undefined,
  attempt: number
): number => {
  if (retry.respectRetryAfter !== false) {
    const retryAfter = resolveRetryAfterDelay(
      headers,
      retry.maxRetryAfter ?? DEFAULT_MAX_RETRY_AFTER
    );
    if (retryAfter !== undefined) return retryAfter;
  }
  return resolveBackoffDelay(retry.delay, attempt);
};

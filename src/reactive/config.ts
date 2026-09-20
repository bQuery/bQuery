/**
 * Global reactive configuration.
 *
 * Selects how observers are dispatched when a signal is written outside an
 * explicit {@link batch} (#210).
 *
 * @module bquery/reactive
 */

/**
 * How observers are dispatched after a signal write.
 *
 * - `'sync'` (default through 1.x) — every write notifies its observers
 *   immediately. Effect timing is observable, so this stays the default for
 *   the whole 1.x line.
 * - `'batched'` — writes are coalesced and flushed on a microtask, the same
 *   way an explicit `batch()` coalesces them. This removes the glitches a
 *   diamond dependency graph otherwise produces, and collapses a burst of
 *   writes in one tick into a single effect run.
 */
export type ReactiveScheduler = 'sync' | 'batched';

interface ReactiveConfig {
  scheduler: ReactiveScheduler;
}

const config: ReactiveConfig = {
  scheduler: 'sync',
};

/**
 * Delivers anything queued under the outgoing scheduler.
 *
 * Registered by `internals.ts` rather than imported from it: `internals`
 * already imports this module for {@link getScheduler}, so importing back
 * would be a cycle.
 * @internal
 */
let drainPending: (() => void) | null = null;

/** @internal */
export const setPendingDrain = (drain: () => void): void => {
  drainPending = drain;
};

/**
 * Update the global reactive configuration.
 *
 * @example Opt into glitch-free, auto-batched effects
 * ```ts
 * import { configureReactive } from '@bquery/bquery/reactive';
 *
 * configureReactive({ scheduler: 'batched' });
 * ```
 */
export const configureReactive = (options: Partial<ReactiveConfig>): void => {
  if (options.scheduler === undefined || options.scheduler === config.scheduler) return;

  // Hand over cleanly. Switching back to `'sync'` while work is queued left
  // the earlier write's microtask in flight, so it replayed an observer a
  // later synchronous write had already notified — one logical change, two
  // effect runs. Effects are not required to be idempotent: that is a
  // duplicate POST, analytics event or list append.
  drainPending?.();
  config.scheduler = options.scheduler;
};

/** A snapshot of the current reactive configuration. */
export const getReactiveConfig = (): Readonly<ReactiveConfig> => ({ scheduler: config.scheduler });

/**
 * The scheduler in force right now.
 * @internal
 */
export const getScheduler = (): ReactiveScheduler => config.scheduler;

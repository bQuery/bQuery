/**
 * Optimistic-update primitive for forms.
 *
 * Lets the UI reflect the *expected* result of a mutation immediately and
 * reconcile when the real result arrives. Built on bQuery signals: an
 * {@link OptimisticController} exposes a reactive {@link OptimisticController.value}
 * that folds the base state through every pending draft, so bindings update
 * instantly when a draft is applied and revert automatically when it is removed.
 *
 * @module bquery/forms
 */

import { computed, signal, toValue } from '../reactive/index';
import type { Computed, MaybeSignal } from '../reactive/index';

/**
 * Folds an optimistic `draft` into the current state, returning the next state.
 * Pure: must not mutate `current`.
 */
export type OptimisticReducer<S, D> = (current: S, draft: D) => S;

/**
 * Handle to a single applied optimistic overlay.
 */
export interface OptimisticHandle {
  /**
   * Remove this overlay. Call it once the server has reconciled the change into
   * the base state (success) or the request has failed (rollback). Idempotent.
   */
  remove: () => void;
  /** Whether this overlay is still applied. */
  readonly active: boolean;
}

/**
 * Reactive optimistic-update controller returned by {@link optimistic}.
 */
export interface OptimisticController<S, D = S> {
  /** The base state folded through every pending draft via the reducer. */
  value: Computed<S>;
  /** `true` while at least one optimistic overlay is applied. */
  pending: Computed<boolean>;
  /** The currently-applied drafts, in apply order. */
  drafts: Computed<readonly D[]>;
  /** Apply an optimistic draft and return a handle that removes it. */
  add: (draft: D) => OptimisticHandle;
  /**
   * Apply an optimistic draft for the duration of `task`, removing the overlay
   * when the task settles (resolve *or* reject). Rejections are re-thrown after
   * cleanup, so `await run(...)` reflects the real outcome while the UI shows
   * the optimistic state meanwhile.
   *
   * @example
   * ```ts
   * await todos.run(draft, async () => {
   *   const saved = await api.create(draft); // overlay visible while this runs
   *   list.value = [...list.peek(), saved];  // reconcile base with server truth
   * });                                       // overlay removed here
   * ```
   */
  run: <R>(draft: D, task: () => Promise<R> | R) => Promise<R>;
  /** Remove all optimistic overlays. */
  clear: () => void;
}

interface Entry<D> {
  id: number;
  draft: D;
}

/**
 * Create an optimistic-update controller over a base state.
 *
 * @param base - The confirmed state: a plain value, signal, or computed. Reading
 * it through the controller participates in reactivity, so reconciling the base
 * (e.g. writing the server response back to a signal) updates `value` too.
 * @param reducer - Pure fold of a draft into the current state.
 *
 * @example
 * ```ts
 * import { signal } from '@bquery/bquery/reactive';
 * import { optimistic } from '@bquery/bquery/forms';
 *
 * const todos = signal<string[]>([]);
 * const list = optimistic(todos, (current, draft: string) => [...current, draft]);
 *
 * const tx = list.add('Buy milk'); // list.value === ['Buy milk'] immediately
 * // ...server responds...
 * todos.value = ['Buy milk'];      // reconcile the base
 * tx.remove();                     // drop the overlay (no double entry)
 * ```
 */
export const optimistic = <S, D = S>(
  base: MaybeSignal<S>,
  reducer: OptimisticReducer<S, D>
): OptimisticController<S, D> => {
  const entries = signal<readonly Entry<D>[]>([]);
  let nextId = 0;

  const value = computed<S>(() => {
    let acc = toValue(base);
    for (const entry of entries.value) {
      acc = reducer(acc, entry.draft);
    }
    return acc;
  });

  const pending = computed<boolean>(() => entries.value.length > 0);
  const drafts = computed<readonly D[]>(() => entries.value.map((entry) => entry.draft));

  const removeEntry = (id: number): void => {
    const current = entries.peek();
    const next = current.filter((entry) => entry.id !== id);
    if (next.length !== current.length) {
      entries.value = next;
    }
  };

  const add = (draft: D): OptimisticHandle => {
    const id = nextId;
    nextId += 1;
    entries.value = [...entries.peek(), { id, draft }];
    return {
      remove: () => removeEntry(id),
      get active(): boolean {
        return entries.peek().some((entry) => entry.id === id);
      },
    };
  };

  const run = async <R>(draft: D, task: () => Promise<R> | R): Promise<R> => {
    const handle = add(draft);
    try {
      return await task();
    } finally {
      handle.remove();
    }
  };

  const clear = (): void => {
    if (entries.peek().length > 0) {
      entries.value = [];
    }
  };

  return { value, pending, drafts, add, run, clear };
};

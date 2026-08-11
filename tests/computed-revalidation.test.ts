/**
 * Regression tests for the `Computed` revalidation path (PR #203 review).
 *
 * `Computed` re-validates before waking subscribers so an unchanged recompute
 * stays silent. These tests pin the cases where that optimization must NOT
 * swallow an update: a compute that threw, a subscriber generation change, and
 * a value that a late reader observed before it reverted.
 */

import { describe, expect, it } from 'bun:test';
import { batch, computed, effect, signal } from '../src/reactive/index';

describe('reactive/computed - revalidation', () => {
  it('stays silent when a recompute yields an equal value', () => {
    const source = signal(1);
    const isPositive = computed(() => source.value > 0);

    let runs = 0;
    const stop = effect(() => {
      void isPositive.value;
      runs++;
    });
    expect(runs).toBe(1);

    // Dependency changed, derived value did not: no subscriber wake-up.
    source.value = 2;
    expect(runs).toBe(1);

    source.value = -1;
    expect(runs).toBe(2);

    stop();
  });

  it('recovers a subscriber after the compute function threw', () => {
    const user = signal<{ name: string } | null>(null);
    const name = computed(() => (user.value as { name: string }).name);

    const seen: string[] = [];
    let errors = 0;
    const stop = effect(() => {
      try {
        seen.push(name.value);
      } catch {
        errors++;
      }
    });

    // The first read throws, which leaves the computed dirty with no pending
    // revalidate — a later dependency change must still schedule one.
    expect(errors).toBe(1);
    expect(seen).toEqual([]);

    user.value = { name: 'ada' };
    expect(seen).toEqual(['ada']);

    stop();
  });

  it('notifies a new subscriber when the value reverts to an earlier generation', () => {
    const source = signal(1);
    const mirrored = computed(() => source.value);

    const stopFirst = effect(() => {
      void mirrored.value;
    });
    stopFirst();

    // Changed while nobody was subscribed: the notified-value baseline must not
    // survive into the next generation of subscribers.
    source.value = 2;

    const seen: number[] = [];
    const stopSecond = effect(() => {
      seen.push(mirrored.value);
    });
    expect(seen).toEqual([2]);

    source.value = 1;
    expect(seen).toEqual([2, 1]);

    stopSecond();
  });

  it('leaves a subscriber that joined mid-batch in sync with the final value', () => {
    const source = signal(1);
    const mirrored = computed(() => source.value);

    const seenFirst: number[] = [];
    const stopFirst = effect(() => {
      seenFirst.push(mirrored.value);
    });

    const seenSecond: number[] = [];
    let stopSecond = () => {};
    batch(() => {
      source.value = 2;
      // Subscribes while a revalidation is still pending, then the value is
      // written back to what the existing subscriber was last notified about.
      stopSecond = effect(() => {
        seenSecond.push(mirrored.value);
      });
      source.value = 1;
    });

    // Whatever the batch collapses to, no subscriber may be left displaying a
    // value the computed no longer holds.
    expect(seenSecond[seenSecond.length - 1]).toBe(mirrored.value);
    expect(seenFirst[seenFirst.length - 1]).toBe(mirrored.value);

    stopFirst();
    stopSecond();
  });
});

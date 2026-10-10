/**
 * Signal graph benchmarks: write/notify throughput for wide fan-out, deep
 * computed chains and diamond dependencies.
 */

import { bench, do_not_optimize, group } from 'mitata';
import { batch, computed, effect, signal } from '../src/reactive/index';

group('reactive', () => {
  bench('fan-out: 1 signal → 1,000 effects, 100 writes', function* () {
    const source = signal(0);
    const stops = Array.from({ length: 1_000 }, () => effect(() => do_not_optimize(source.value)));
    yield () => {
      for (let i = 0; i < 100; i++) source.value = i;
    };
    for (const stop of stops) stop();
  });

  bench('deep chain: 50 computeds, 1,000 writes', function* () {
    const source = signal(0);
    let tail = computed(() => source.value + 1);
    for (let i = 1; i < 50; i++) {
      const previous = tail;
      tail = computed(() => previous.value + 1);
    }
    const stop = effect(() => do_not_optimize(tail.value));
    yield () => {
      for (let i = 0; i < 1_000; i++) source.value = i;
    };
    stop();
  });

  bench('diamond: 100 branches joined in one computed, 100 writes', function* () {
    const source = signal(0);
    const branches = Array.from({ length: 100 }, (_, i) => computed(() => source.value * i));
    const joined = computed(() => branches.reduce((sum, branch) => sum + branch.value, 0));
    const stop = effect(() => do_not_optimize(joined.value));
    yield () => {
      for (let i = 0; i < 100; i++) source.value = i;
    };
    stop();
  });

  bench('batch: 1,000 signals written in one batch, 1 effect', function* () {
    const signals = Array.from({ length: 1_000 }, () => signal(0));
    const stop = effect(() => do_not_optimize(signals.reduce((sum, s) => sum + s.value, 0)));
    let round = 0;
    yield () => {
      round++;
      batch(() => {
        for (const s of signals) s.value = round;
      });
    };
    stop();
  });

  bench('create and dispose 1,000 signal + effect pairs', () => {
    for (let i = 0; i < 1_000; i++) {
      const s = signal(i);
      effect(() => do_not_optimize(s.value))();
    }
  });
});

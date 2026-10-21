import plugin from '../src/index.js';
import { ruleTester } from './rule-tester';

const rule = plugin.rules['no-value-in-untracked'];

ruleTester.run('no-value-in-untracked', rule, {
  valid: [
    // Explicit untracked reads.
    `import { untrack, signal } from '@bquery/bquery/reactive';
     const count = signal(0);
     untrack(() => count.peek());`,
    // Tracked contexts.
    `import { effect, computed, signal } from '@bquery/bquery';
     const count = signal(0);
     effect(() => count.value);
     computed(() => count.value * 2);`,
    // Writes are not reads.
    `import { watch, signal } from '@bquery/bquery';
     const a = signal(0); const b = signal(0);
     watch(a, () => { b.value = 1; b.value++; b.value += 1; [b.value] = [2]; ({ x: b.value } = { x: 3 }); });`,
    // Callback parameters and locals hold plain values.
    `import { watch, signal } from '@bquery/bquery';
     const user = signal({ value: 1 });
     watch(user, (next, prev) => { next.value; prev?.value; const input = document.createElement('input'); input.value; });`,
    // Nested functions are not part of the untracked callback.
    `import { watch, effect, signal } from '@bquery/bquery';
     const a = signal(0); const b = signal(0);
     watch(a, () => { effect(() => b.value); });`,
    // The watch source argument is tracked.
    `import { watch, signal } from '@bquery/bquery';
     const a = signal(0);
     watch(a, () => {}, { equals: (x, y) => a.value === x && x === y });`,
    // Not bQuery's helpers; unresolved globals.
    `import { untrack } from 'other-lib';
     const s = { value: 1 };
     untrack(() => s.value);`,
    `import { untrack } from '@bquery/bquery';
     untrack(() => globalThing.value);`,
    // Computed member access is left alone.
    `import { untrack, signal } from '@bquery/bquery';
     const s = signal(1);
     untrack(() => s['value']);`,
  ],
  invalid: [
    {
      code: `import { untrack, signal } from '@bquery/bquery/reactive';
const count = signal(0);
const snapshot = untrack(() => count.value);`,
      errors: [
        {
          messageId: 'valueInUntracked',
          data: { name: 'count', helper: 'untrack' },
          suggestions: [
            {
              messageId: 'usePeek',
              data: { name: 'count', helper: 'untrack' },
              output: `import { untrack, signal } from '@bquery/bquery/reactive';
const count = signal(0);
const snapshot = untrack(() => count.peek());`,
            },
          ],
        },
      ],
    },
    {
      code: `import { watch as observe, signal } from '@bquery/bquery';
const query = signal(''); const page = signal(1);
observe(query, (next) => { load(next, page.value); });`,
      errors: [
        {
          messageId: 'valueInUntracked',
          data: { name: 'page', helper: 'watch' },
          suggestions: [
            {
              messageId: 'usePeek',
              output: `import { watch as observe, signal } from '@bquery/bquery';
const query = signal(''); const page = signal(1);
observe(query, (next) => { load(next, page.peek()); });`,
            },
          ],
        },
      ],
    },
    {
      code: `import * as reactive from '@bquery/bquery/reactive';
import { filter, sort } from './state';
reactive.watchDebounce(filter, function () { render(filter.value, sort?.value); }, 100);
reactive.watchThrottle(filter, () => sort.value(), 100);`,
      errors: [
        {
          messageId: 'valueInUntracked',
          data: { name: 'filter', helper: 'watchDebounce' },
          suggestions: [
            {
              messageId: 'usePeek',
              output: `import * as reactive from '@bquery/bquery/reactive';
import { filter, sort } from './state';
reactive.watchDebounce(filter, function () { render(filter.peek(), sort?.value); }, 100);
reactive.watchThrottle(filter, () => sort.value(), 100);`,
            },
          ],
        },
        {
          messageId: 'valueInUntracked',
          data: { name: 'sort', helper: 'watchDebounce' },
          suggestions: [
            {
              messageId: 'usePeek',
              output: `import * as reactive from '@bquery/bquery/reactive';
import { filter, sort } from './state';
reactive.watchDebounce(filter, function () { render(filter.value, sort?.peek()); }, 100);
reactive.watchThrottle(filter, () => sort.value(), 100);`,
            },
          ],
        },
        {
          messageId: 'valueInUntracked',
          data: { name: 'sort', helper: 'watchThrottle' },
          suggestions: [
            {
              messageId: 'usePeek',
              output: `import * as reactive from '@bquery/bquery/reactive';
import { filter, sort } from './state';
reactive.watchDebounce(filter, function () { render(filter.value, sort?.value); }, 100);
reactive.watchThrottle(filter, () => sort.peek()(), 100);`,
            },
          ],
        },
      ],
    },
  ],
});

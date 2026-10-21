import plugin from '../src/index.js';
import { ruleTester } from './rule-tester';

const rule = plugin.rules['prefer-scoped-reactivity'];

ruleTester.run('prefer-scoped-reactivity', rule, {
  valid: [
    // Scoped primitives.
    `import { component, useEffect, useSignal } from '@bquery/bquery/component';
     component('x-a', {
       connected() { const n = useSignal(0); useEffect(() => n.value); },
       render: () => '',
     });`,
    // Unscoped primitives outside components.
    `import { effect, signal } from '@bquery/bquery/reactive';
     const n = signal(0);
     effect(() => n.value);`,
    // Definition-time signals shared by every instance are intentional.
    `import { component } from '@bquery/bquery/component';
     import { signal } from '@bquery/bquery/reactive';
     component('x-b', { signals: { count: signal(0) }, render: () => '' });`,
    // Hooks without an active scope: the use* variants would throw there.
    `import { component } from '@bquery/bquery';
     import { effect, signal } from '@bquery/bquery';
     component('x-c', {
       render() { const n = signal(0); return String(n.value); },
       disconnected() { effect(() => {}); },
     });`,
    // Nested callbacks may run after the scope is gone.
    `import { component, effect } from '@bquery/bquery';
     component('x-d', {
       connected() { this.addEventListener('click', () => { effect(() => {}); }); },
       render: () => '',
     });`,
    // Not bQuery's component() / effect().
    `import { component } from 'other-lib';
     import { effect } from '@bquery/bquery/reactive';
     component('x-e', { connected() { effect(() => {}); } });`,
    `import { component } from '@bquery/bquery/component';
     import { effect } from 'other-lib';
     component('x-f', { connected() { effect(() => {}); } });`,
  ],
  invalid: [
    {
      // Adds the import to the existing component import.
      code: `import { component } from '@bquery/bquery/component';
import { effect, signal } from '@bquery/bquery/reactive';
component('x-a', {
  connected() {
    const n = signal(0);
  },
});`,
      errors: [
        {
          messageId: 'preferScoped',
          data: { name: 'signal', scoped: 'useSignal', hook: 'connected' },
          suggestions: [
            {
              messageId: 'useScoped',
              data: { name: 'signal', scoped: 'useSignal', hook: 'connected' },
              output: `import { component, useSignal } from '@bquery/bquery/component';
import { effect, signal } from '@bquery/bquery/reactive';
component('x-a', {
  connected() {
    const n = useSignal(0);
  },
});`,
            },
          ],
        },
      ],
    },
    {
      // Reuses an existing scoped import; works for defineComponent and other hooks.
      code: `import { defineComponent, useEffect } from '@bquery/bquery';
import { effect } from '@bquery/bquery';
defineComponent('x-b', {
  beforeMount() { effect(() => {}); },
  onAttributeChanged: () => { effect(() => {}); },
});`,
      errors: [
        {
          messageId: 'preferScoped',
          suggestions: [
            {
              messageId: 'useScoped',
              output: `import { defineComponent, useEffect } from '@bquery/bquery';
import { effect } from '@bquery/bquery';
defineComponent('x-b', {
  beforeMount() { useEffect(() => {}); },
  onAttributeChanged: () => { effect(() => {}); },
});`,
            },
          ],
        },
        {
          messageId: 'preferScoped',
          suggestions: [
            {
              messageId: 'useScoped',
              output: `import { defineComponent, useEffect } from '@bquery/bquery';
import { effect } from '@bquery/bquery';
defineComponent('x-b', {
  beforeMount() { effect(() => {}); },
  onAttributeChanged: () => { useEffect(() => {}); },
});`,
            },
          ],
        },
      ],
    },
    {
      // Renamed imports and namespace calls.
      code: `import * as bq from '@bquery/bquery';
bq.component('x-c', {
  onAdopted() { bq.computed(() => 1); },
});`,
      errors: [
        {
          messageId: 'preferScoped',
          suggestions: [
            {
              messageId: 'useScoped',
              output: `import * as bq from '@bquery/bquery';
bq.component('x-c', {
  onAdopted() { bq.useComputed(() => 1); },
});`,
            },
          ],
        },
      ],
    },
    {
      // No safe rewrite: `useSignal` is already a different local binding,
      // and the reactive-only namespace does not export the scoped variant.
      code: `import { component as define } from '@bquery/bquery/component';
import { signal as makeSignal } from '@bquery/bquery/reactive';
import * as reactive from '@bquery/bquery/reactive';
const useSignal = () => null;
define('x-d', {
  connected() { makeSignal(1); reactive.effect(() => {}); },
});`,
      errors: [
        { messageId: 'preferScoped', suggestions: [] },
        { messageId: 'preferScoped', suggestions: [] },
      ],
    },
    {
      // No named component import to extend: report only.
      code: `import * as c from '@bquery/bquery/component';
import { effect } from '@bquery/bquery/reactive';
c.component('x-e', { connected() { effect(() => {}); } });`,
      errors: [{ messageId: 'preferScoped', suggestions: [] }],
    },
    {
      // The /full bundle exports the scoped variants too.
      code: `import { component, effect } from '@bquery/bquery/full';
component('x-f', { connected() { effect(() => {}); } });`,
      errors: [
        {
          messageId: 'preferScoped',
          suggestions: [
            {
              messageId: 'useScoped',
              output: `import { component, effect, useEffect } from '@bquery/bquery/full';
component('x-f', { connected() { useEffect(() => {}); } });`,
            },
          ],
        },
      ],
    },
  ],
});

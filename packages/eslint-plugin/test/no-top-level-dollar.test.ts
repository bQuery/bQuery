import plugin from '../src/index.js';
import { jsRuleTester, ruleTester } from './rule-tester';

const rule = plugin.rules['no-top-level-dollar'];
const error = { messageId: 'topLevelDollar' };

const cases = {
  valid: [
    // Inside functions, handlers and hooks.
    `import { $ } from '@bquery/bquery';
     export function init() { $('#app').text('hi'); }`,
    `import { $ } from '@bquery/bquery/core';
     document.addEventListener('DOMContentLoaded', () => { $('#app'); });`,
    `import { $ } from '@bquery/bquery';
     class Widget { el = $('#widget'); }`,
    `import { $ } from '@bquery/bquery';
     class Widget { mount() { return $('#widget'); } }`,
    // $$() never throws.
    `import { $$ } from '@bquery/bquery';
     $$('.item').addClass('ready');`,
    // Not bQuery's $.
    `import $ from 'jquery';
     $('#app');`,
    `const $ = (s) => document.querySelector(s);
     $('#app');`,
    `$('#app');`,
    // Shadowed binding.
    `import { $ } from '@bquery/bquery';
     function f($) { return $; }
     { const $ = () => null; $('#x'); }`,
    `import * as bq from '@bquery/bquery';
     export const init = () => bq.$('#app');`,
  ],
  invalid: [
    {
      code: `import { $ } from '@bquery/bquery';
             const app = $('#app');`,
      errors: [error],
    },
    {
      code: `import { $ } from '@bquery/bquery/core';
             $('#counter').text('0');`,
      errors: [error],
    },
    {
      code: `import { $ as select } from '@bquery/bquery';
             select('#app');`,
      errors: [error],
    },
    {
      code: `import { $ } from '@bquery/bquery/full';
             if (typeof document !== 'undefined') { $('#app'); }`,
      errors: [error],
    },
    {
      code: `import * as bq from '@bquery/bquery';
             bq.$('#app');`,
      errors: [error],
    },
    {
      // Immediately invoked functions run on import too.
      code: `import { $ } from '@bquery/bquery';
             (() => { $('#app'); })();
             (async function () { $('#app'); })();`,
      errors: [error, error],
    },
    {
      code: `import { $ } from '@bquery/bquery';
             class Widget { static root = $('#root'); static { $('#other'); } }`,
      errors: [error, error],
    },
    {
      code: `import { $ } from '@bquery/bquery';
             export const app = $('#app') as unknown;`,
      errors: [{ ...error, line: 2, column: 33 }],
    },
  ],
};

ruleTester.run('no-top-level-dollar', rule, cases);
jsRuleTester.run('no-top-level-dollar (espree)', rule, {
  valid: cases.valid.filter((code) => !code.includes(' as unknown')),
  invalid: cases.invalid.filter(({ code }) => !code.includes(' as unknown')),
});

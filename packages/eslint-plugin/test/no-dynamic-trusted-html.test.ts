import plugin from '../src/index.js';
import { ruleTester } from './rule-tester';

const rule = plugin.rules['no-dynamic-trusted-html'];

ruleTester.run('no-dynamic-trusted-html', rule, {
  valid: [
    // Static markup.
    `import { trusted } from '@bquery/bquery/security';
     trusted('<strong>New</strong>');
     trusted(\`<em>static</em>\`);
     trusted('<b>' + 'x' + '</b>');`,
    `import { unsafeHtml, storyHtml } from '@bquery/bquery/storybook';
     const trustedSvg = '<svg width="16" height="16"><circle cx="8" cy="8" r="6"/></svg>';
     storyHtml\`<bq-icon>\${unsafeHtml(trustedSvg)}</bq-icon>\`;`,
    // Nested story templates are sanitized already.
    `import { repeat, storyHtml, unsafeHtml } from '@bquery/bquery/storybook';
     storyHtml\`<ul>\${repeat(items, (item) => unsafeHtml(storyHtml\`<li>\${item.label}</li>\`))}</ul>\`;`,
    // Direct sanitizer output.
    `import { trusted, sanitizeHtml, sanitize, escapeHtml } from '@bquery/bquery';
     trusted(sanitizeHtml(userInput));
     trusted(sanitize(userInput, { allowTags: ['b'] }));
     trusted(escapeHtml(name));`,
    `import { trusted } from '@bquery/bquery';
     import { safeHtml } from '@bquery/bquery/component';
     trusted(safeHtml\`<span>\${name}</span>\`);`,
    `import * as security from '@bquery/bquery/security';
     security.trusted(security.sanitizeHtml(input) as never);`,
    // Not bQuery's helpers.
    `import { trusted } from 'other-lib';
     trusted(userInput);`,
    `const unsafeHtml = (value) => value;
     unsafeHtml(userInput);`,
  ],
  invalid: [
    {
      code: `import { trusted, sanitizeHtml } from '@bquery/bquery/security';
trusted(userInput);`,
      errors: [
        {
          messageId: 'dynamicTrusted',
          line: 2,
          column: 9,
          suggestions: [
            {
              messageId: 'wrapInSanitizer',
              data: { sanitizer: 'sanitizeHtml' },
              output: `import { trusted, sanitizeHtml } from '@bquery/bquery/security';
trusted(sanitizeHtml(userInput));`,
            },
          ],
        },
      ],
    },
    {
      // Template literal with expressions; renamed sanitizer import.
      code: `import { trusted as t, sanitize as clean } from '@bquery/bquery';
t(\`<b>\${name}</b>\`);`,
      errors: [
        {
          messageId: 'dynamicTrusted',
          suggestions: [
            {
              messageId: 'wrapInSanitizer',
              output: `import { trusted as t, sanitize as clean } from '@bquery/bquery';
t(clean(\`<b>\${name}</b>\`));`,
            },
          ],
        },
      ],
    },
    {
      // A sanitizer that is not bQuery's, a mutable binding and no sanitizer import.
      code: `import { trusted } from '@bquery/bquery/full';
import { sanitizeHtml } from 'other-lib';
let markup = '<b>x</b>';
trusted(sanitizeHtml(input));
trusted(markup);`,
      errors: [
        { messageId: 'dynamicTrusted', suggestions: [] },
        { messageId: 'dynamicTrusted', suggestions: [] },
      ],
    },
    {
      code: `import { trusted } from '@bquery/bquery';
trusted(...parts);`,
      errors: [{ messageId: 'dynamicTrusted', suggestions: [] }],
    },
    {
      code: `import { storyHtml, unsafeHtml } from '@bquery/bquery/storybook';
storyHtml\`<div>\${unsafeHtml(args.content)}</div>\`;`,
      errors: [
        {
          messageId: 'dynamicUnsafeHtml',
          suggestions: [
            {
              messageId: 'removeUnsafeHtml',
              output: `import { storyHtml, unsafeHtml } from '@bquery/bquery/storybook';
storyHtml\`<div>\${args.content}</div>\`;`,
            },
          ],
        },
      ],
    },
    {
      // Outside a template the call cannot simply be unwrapped.
      code: `import { unsafeHtml } from '@bquery/bquery/storybook';
const marker = unsafeHtml(\`<p>\${text}</p>\`);`,
      errors: [{ messageId: 'dynamicUnsafeHtml', suggestions: [] }],
    },
  ],
});

import plugin from '../src/index.js';
import { jsRuleTester, ruleTester } from './rule-tester';

const rule = plugin.rules['prefer-subpath-imports'];

ruleTester.run('prefer-subpath-imports', rule, {
  valid: [
    `import { signal, effect } from '@bquery/bquery/reactive';`,
    `import { $ } from '@bquery/bquery/core';`,
    `import { $ } from '@bquery/bquery/full';`,
    // Side-effect and namespace imports have no per-name subpath.
    `import '@bquery/bquery';`,
    `import * as bq from '@bquery/bquery';`,
    `import { signal } from 'other-lib';`,
  ],
  invalid: [
    {
      code: `import { signal, effect } from '@bquery/bquery';`,
      output: `import { signal, effect } from '@bquery/bquery/reactive';`,
      errors: [{ messageId: 'preferSubpath', data: { source: '@bquery/bquery/reactive' } }],
    },
    {
      // Renamed, type-only and string-quoted specifiers keep their shape.
      code: `import { $ as select, type BQueryElement } from "@bquery/bquery"`,
      output: `import { $ as select, type BQueryElement } from "@bquery/bquery/core"`,
      errors: [{ messageId: 'preferSubpath' }],
    },
    {
      code: `import type { Signal, Computed } from '@bquery/bquery';`,
      output: `import type { Signal, Computed } from '@bquery/bquery/reactive';`,
      errors: [{ messageId: 'preferSubpath' }],
    },
    {
      // Re-exported aliases map to the module that defines them.
      code: `import { sanitize, trusted } from '@bquery/bquery';`,
      output: `import { sanitize, trusted } from '@bquery/bquery/security';`,
      errors: [{ messageId: 'preferSubpath' }],
    },
    {
      // Comments survive a single-subpath fix.
      code: `import {
  component, // define elements
  useSignal,
} from '@bquery/bquery';`,
      output: `import {
  component, // define elements
  useSignal,
} from '@bquery/bquery/component';`,
      errors: [{ messageId: 'preferSubpath' }],
    },
    {
      // Several subpaths: split into one import per subpath.
      code: `import { $, signal, component, effect, type Signal } from '@bquery/bquery';`,
      output: [
        `import { $ } from '@bquery/bquery/core';`,
        `import { signal, effect, type Signal } from '@bquery/bquery/reactive';`,
        `import { component } from '@bquery/bquery/component';`,
      ].join('\n'),
      errors: [
        {
          messageId: 'preferSubpaths',
          data: {
            sources: "'@bquery/bquery/core', '@bquery/bquery/reactive', '@bquery/bquery/component'",
          },
        },
      ],
    },
    {
      code: `import type { Signal, ComponentDefinition } from '@bquery/bquery'`,
      output: [
        `import type { Signal } from '@bquery/bquery/reactive'`,
        `import type { ComponentDefinition } from '@bquery/bquery/component'`,
      ].join('\n'),
      errors: [{ messageId: 'preferSubpaths' }],
    },
    {
      // Splitting would drop the comment: report without a fix.
      code: `import { $, /* reactive */ signal } from '@bquery/bquery';`,
      output: null,
      errors: [{ messageId: 'preferSubpaths' }],
    },
    {
      // Unknown names: report without a fix.
      code: `import { signal, doesNotExist } from '@bquery/bquery';`,
      output: null,
      errors: [{ messageId: 'unknownExport', data: { name: 'doesNotExist' } }],
    },
    {
      code: `import bq from '@bquery/bquery';`,
      output: null,
      errors: [{ messageId: 'unknownExport', data: { name: 'default' } }],
    },
    {
      // Prototype keys are not exports.
      code: `import { constructor } from '@bquery/bquery';`,
      output: null,
      errors: [{ messageId: 'unknownExport' }],
    },
  ],
});

jsRuleTester.run('prefer-subpath-imports (espree)', rule, {
  valid: [`import { signal } from '@bquery/bquery/reactive';`],
  invalid: [
    {
      code: `function setup() {}\n  import { $$, computed } from '@bquery/bquery';`,
      output: `function setup() {}\n  import { $$ } from '@bquery/bquery/core';\n  import { computed } from '@bquery/bquery/reactive';`,
      errors: [{ messageId: 'preferSubpaths' }],
    },
  ],
});

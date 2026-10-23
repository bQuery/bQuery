/**
 * Rendering under an enforced `require-trusted-types-for 'script'` CSP. The
 * server sends the header for every `/tt/*` page; the `bquery-sanitizer`
 * policy is the only one the CSP allows.
 */

import { expect, test } from '@playwright/test';
import { FULL, openBlank } from './helpers';

test.beforeEach(async ({ page, browserName }) => {
  await openBlank(page, { trustedTypes: true });
  const supported = await page.evaluate(() => 'trustedTypes' in window);
  test.skip(!supported, `${browserName} does not implement Trusted Types`);
});

test('the CSP is enforced: a raw string in an HTML sink throws', async ({ page }) => {
  const threw = await page.evaluate(() => {
    try {
      document.getElementById('app')!.innerHTML = '<b>raw</b>';
      return false;
    } catch (error) {
      return error instanceof TypeError;
    }
  });
  expect(threw).toBe(true);
});

test('components, compiled views and the sanitizer render without violations', async ({ page }) => {
  const result = await page.evaluate(async (url) => {
    const violations: string[] = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective}: ${event.sample}`);
    });
    const { component, html, mount, registerCompiledExpressions, sanitizeHtml, signal } =
      await import(url);
    // The runtime evaluator needs `new Function()`, which Trusted Types blocks;
    // views under this CSP use the view compiler. This is what
    // `compileToModule('<div bq-html="markup"></div>')` emits.
    registerCompiledExpressions({
      markup: (ctx: { markup: unknown }) => ctx.markup,
    });

    component('x-tt', {
      render: () => html`<p class="tt">component <b>ok</b></p>`,
    });
    const app = document.getElementById('app')!;
    const host = document.createElement('x-tt');
    app.append(host);

    const view = document.createElement('div');
    view.setAttribute('bq-html', 'markup');
    app.append(view);
    const markup = signal('<i>view ok</i><img src="x" onerror="alert(1)">');
    mount(view, { markup });

    const sanitized = String(sanitizeHtml('<a href="javascript:alert(1)">x</a><b>kept</b>'));
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      component: host.shadowRoot!.querySelector('.tt')?.textContent,
      view: view.innerHTML,
      sanitized,
      violations,
    };
  }, FULL);

  expect(result.component).toBe('component ok');
  expect(result.view).toBe('<i>view ok</i><img src="x">');
  expect(result.sanitized).toBe('<a>x</a><b>kept</b>');
  expect(result.violations).toEqual([]);
});

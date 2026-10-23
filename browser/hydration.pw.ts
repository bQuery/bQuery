/**
 * Hydrating server-rendered markup in a real browser, including a mismatch.
 */

import { expect, test } from '@playwright/test';
import { FULL, openBlank } from './helpers';

test.beforeEach(async ({ page }) => openBlank(page));

test('hydrates matching markup without mismatches and stays reactive', async ({ page }) => {
  const result = await page.evaluate(async (url) => {
    const { hydrate, renderToString, signal } = await import(url);
    const template = '<p bq-text="msg"></p><a bq-bind:href="href">link</a>';
    const app = document.getElementById('app')!;
    app.innerHTML = renderToString(template, { msg: 'hello', href: '/a' }).html;

    const msg = signal('hello');
    const { mismatches } = hydrate(app, { msg, href: '/a' });
    msg.value = 'updated';
    return { mismatches: mismatches.length, text: app.querySelector('p')!.textContent };
  }, FULL);

  expect(result).toEqual({ mismatches: 0, text: 'updated' });
});

test('reports and repairs a mismatch between server and client state', async ({ page }) => {
  const result = await page.evaluate(async (url) => {
    const { hydrate, renderToString } = await import(url);
    const app = document.getElementById('app')!;
    app.innerHTML = renderToString('<p bq-text="msg"></p>', { msg: 'server' }).html;

    const { mismatches } = hydrate(app, { msg: 'client' }, { onMismatch: 'repair' });
    return {
      mismatches: mismatches.map((mismatch: { directive: string }) => mismatch.directive),
      text: app.querySelector('p')!.textContent,
    };
  }, FULL);

  expect(result).toEqual({ mismatches: ['bq-text'], text: 'client' });
});

test("onMismatch: 'error' refuses to hydrate diverging markup", async ({ page }) => {
  const message = await page.evaluate(async (url) => {
    const { hydrate, renderToString } = await import(url);
    const app = document.getElementById('app')!;
    app.innerHTML = renderToString('<p bq-text="msg"></p>', { msg: 'server' }).html;
    try {
      hydrate(app, { msg: 'client' }, { onMismatch: 'error' });
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  }, FULL);

  expect(message).toContain('bq-text');
});

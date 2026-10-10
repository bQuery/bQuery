/**
 * Declarative enter/leave transitions and FLIP moves, timed by the real Web
 * Animations implementation.
 */

import { expect, test } from '@playwright/test';
import { FULL, openBlank } from './helpers';

test.beforeEach(async ({ page }) => openBlank(page));

test('bq-transition animates enter and leave, then removes the element', async ({ page }) => {
  const result = await page.evaluate(async (url) => {
    const { mount, signal } = await import(url);
    const app = document.getElementById('app')!;
    app.innerHTML =
      '<p id="box" bq-if="open" bq-transition="fade" bq-transition-duration="150">Hi</p>';
    const open = signal(false);
    mount(app, { open });

    open.value = true;
    const box = () => document.getElementById('box');
    const enterAnimations = box()?.getAnimations().length ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 250));

    open.value = false;
    const stillThereDuringLeave = box() !== null;
    const leaveAnimations = box()?.getAnimations().length ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 300));

    return { enterAnimations, stillThereDuringLeave, leaveAnimations, removed: box() === null };
  }, FULL);

  expect(result.enterAnimations).toBeGreaterThan(0);
  expect(result.stillThereDuringLeave).toBe(true);
  expect(result.leaveAnimations).toBeGreaterThan(0);
  expect(result.removed).toBe(true);
});

test('bq-animate="flip" animates items that moved', async ({ page }) => {
  const result = await page.evaluate(async (url) => {
    const { mount, signal } = await import(url);
    const app = document.getElementById('app')!;
    app.innerHTML =
      '<ul><li bq-for="item in items" :key="item" bq-animate="flip" bq-text="item" style="height: 20px"></li></ul>';
    const items = signal(['a', 'b', 'c']);
    mount(app, { items });

    items.value = ['c', 'b', 'a'];
    await new Promise(requestAnimationFrame);
    const animated = Array.from(app.querySelectorAll('li'))
      .filter((li) => li.getAnimations().length > 0)
      .map((li) => li.textContent);
    return { order: Array.from(app.querySelectorAll('li')).map((li) => li.textContent), animated };
  }, FULL);

  expect(result.order).toEqual(['c', 'b', 'a']);
  expect(result.animated).toEqual(expect.arrayContaining(['a', 'c']));
  expect(result.animated).not.toContain('b');
});

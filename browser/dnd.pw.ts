/**
 * Drag and drop with real pointer and keyboard events.
 */

import { expect, test } from '@playwright/test';
import { FULL, openBlank } from './helpers';

type Ended = { x: number; y: number } | null;

test.beforeEach(async ({ page }) => {
  await openBlank(page);
  await page.evaluate(async (url) => {
    const { draggable } = await import(url);
    const box = document.createElement('div');
    box.id = 'box';
    box.textContent = 'drag me';
    box.style.cssText = 'width: 80px; height: 80px; background: teal; margin: 40px;';
    document.getElementById('app')!.append(box);
    const state = window as unknown as { ended: Ended };
    state.ended = null;
    draggable(box, {
      keyboard: true,
      keyboardStep: 10,
      onDragEnd: ({ position }: { position: { x: number; y: number } }) => {
        state.ended = { x: position.x, y: position.y };
      },
    });
  }, FULL);
});

const ended = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { ended: Ended }).ended);

test('pointer path: dragging moves the element by the pointer delta', async ({ page }) => {
  const box = page.locator('#box');
  const start = (await box.boundingBox())!;
  await page.mouse.move(start.x + 10, start.y + 10);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 25, { steps: 5 });
  await page.mouse.move(start.x + 60, start.y + 30, { steps: 5 });
  await page.mouse.up();

  expect(await ended(page)).toEqual({ x: 50, y: 20 });
  const moved = (await box.boundingBox())!;
  expect(Math.round(moved.x - start.x)).toBe(50);
  expect(Math.round(moved.y - start.y)).toBe(20);
});

test('keyboard path: Space picks up, arrows move, Space drops', async ({ page }) => {
  await page.locator('#box').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');

  expect(await ended(page)).toEqual({ x: 20, y: 10 });
});

test('keyboard path: Escape cancels back to the pickup position', async ({ page }) => {
  const box = page.locator('#box');
  const start = (await box.boundingBox())!;
  await box.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');

  const after = (await box.boundingBox())!;
  expect(Math.round(after.x)).toBe(Math.round(start.x));
});

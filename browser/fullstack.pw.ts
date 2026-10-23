/**
 * End-to-end run through the full-stack example (#226): sign-in, SSR with
 * route loaders, hydration, schema validation on both sides, the persisted
 * draft and locale negotiation.
 */

import { expect, test, type Page } from '@playwright/test';
import { examplePort } from './playwright.config';

const base = `http://127.0.0.1:${examplePort}`;

const signIn = async (page: Page): Promise<void> => {
  await page.goto(`${base}/login?lang=en`);
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Password').fill('lovelace');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${base}/`);
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
};

test.describe.configure({ mode: 'serial' });

test('redirects to the sign-in page and rejects wrong credentials', async ({ page }) => {
  await page.goto(`${base}/`);
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(`${base}/login?lang=en`);
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.');
});

test('renders the login page in the negotiated locale', async ({ page }) => {
  await page.goto(`${base}/login?lang=de`);
  await expect(page.getByRole('heading')).toHaveText('Anmelden');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('validates, adds, persists and deletes notes', async ({ page }) => {
  await signIn(page);
  const title = `E2E ${Date.now()}`;

  // Client-side validation from the shared schema.
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.locator('small.error').first()).toHaveText('Give the note a title.');

  // The draft survives a reload (persisted store).
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Title').blur();
  await page.reload();
  await expect(page.getByLabel('Title')).toHaveValue(title);

  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('');

  // Server-rendered by the route loader after a reload.
  await page.reload();
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  await page.getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await page.goBack();

  const item = page.locator('li', { has: page.getByRole('link', { name: title }) });
  await item.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('link', { name: title })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: title })).toHaveCount(0);
});

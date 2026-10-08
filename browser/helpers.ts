import type { Page } from '@playwright/test';

/** The `/full` ESM bundle, loaded inside the page. */
export const FULL = '/dist/full.es.mjs';

/** Open a blank fixture page, optionally under the enforced Trusted Types CSP. */
export const openBlank = async (page: Page, { trustedTypes = false } = {}): Promise<void> => {
  await page.goto(trustedTypes ? '/tt/blank.html' : '/fixtures/blank.html');
};

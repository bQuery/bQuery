/**
 * Browser entry, served as `/client.js` (`server.ts` bundles it with
 * `Bun.build()`). Reads the state the server embedded and hydrates the page.
 */

import { hydrateNotes, type PageState } from './client/notes';

const state = JSON.parse(document.getElementById('bq-state')?.textContent ?? '{}') as PageState;
const root = document.getElementById('app');

if (root && state.page === '/') hydrateNotes(root, state);
document.documentElement.dataset.hydrated = 'true';

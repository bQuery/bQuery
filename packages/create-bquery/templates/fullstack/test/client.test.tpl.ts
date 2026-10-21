import { afterEach, describe, expect, it } from 'bun:test';
import { mockFetch, screen, userEvent, waitFor } from '@bquery/bquery/testing';
import { hydrateNotes, type PageState } from '../client/notes';
import { createApp } from '../server/app';
import { createNotesRepo } from '../server/notes-repo';

let restoreFetch = (): void => {};
const json = { 'content-type': 'application/json' };

/** Renders `/` with the real server, then hydrates it like the browser does. */
const loadNotesPage = async (seed: Array<{ title: string; body: string }> = []) => {
  const notes = createNotesRepo();
  for (const note of seed) notes.add(note);
  const { app } = createApp({ secret: 'test-secret-0123456789abcdef', notes });
  const html = await (await app.handle('http://localhost/')).text();

  const server = new DOMParser().parseFromString(html, 'text/html');
  document.body.innerHTML = `<div id="app">${server.querySelector('#app')!.innerHTML}</div>`;
  const state = JSON.parse(server.querySelector('#bq-state')!.textContent!) as PageState;
  return { state, ...hydrateNotes(document.querySelector<HTMLElement>('#app')!, state) };
};

afterEach(() => {
  restoreFetch();
  document.body.replaceChildren();
});

describe('notes page in the browser', () => {
  it('validates the form before sending anything', async () => {
    const api = mockFetch({});
    restoreFetch = api.restore;
    await loadNotesPage();

    await userEvent.click(screen.getByRole('button', { name: 'Add note' }));

    expect(await screen.findByText('Give the note a title.')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('posts a new note with the CSRF token and shows it', async () => {
    const api = mockFetch({
      'POST /api/notes': async (request) => ({
        status: 201,
        headers: json,
        body: { id: 'n9', ...(await request.json()), createdAt: 0 },
      }),
    });
    restoreFetch = api.restore;
    const { state } = await loadNotesPage();

    await userEvent.type(screen.getByLabelText('Title'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Add note' }));

    expect(await screen.findByText('Hello')).toBeTruthy();
    expect(screen.getByText('1 note')).toBeTruthy();
    expect(api.calls[0].headers.get('x-csrf-token')).toBe(state.csrf);
  });

  it('shows the errors the server sends back', async () => {
    const api = mockFetch({
      'POST /api/notes': {
        status: 400,
        headers: json,
        body: { errors: { body: 'The server says no.' } },
      },
    });
    restoreFetch = api.restore;
    await loadNotesPage();

    await userEvent.type(screen.getByLabelText('Title'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Add note' }));

    expect(await screen.findByText('The server says no.')).toBeTruthy();
  });

  it('deletes optimistically and rolls back when the server fails', async () => {
    const api = mockFetch({ 'DELETE /api/notes/n1': { status: 500 } });
    restoreFetch = api.restore;
    const { notes } = await loadNotesPage([{ title: 'Keep me', body: '' }]);

    await userEvent.click(screen.getByRole('button', { name: 'Delete Keep me' }));

    await waitFor(() => api.calls.length === 1);
    await waitFor(() => notes.value.length === 1);
    expect(await screen.findByText('Keep me')).toBeTruthy();
  });
});

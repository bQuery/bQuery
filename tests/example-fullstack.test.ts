/**
 * Smoke test for the full-stack example (#226): drives the real request
 * pipeline in-process, and checks that the browser bundle builds. The
 * Playwright lane (`browser/fullstack.pw.ts`) runs the same app in browsers.
 */

import { describe, expect, it } from 'bun:test';
import { createApp } from '../examples/fullstack/server/app';
import { createNotesRepo } from '../examples/fullstack/server/notes-repo';

const BASE = 'http://localhost';

/** A tiny cookie jar + CSRF-aware client around `app.handle()`. */
const createClient = () => {
  const { app, notes } = createApp({
    secret: 'smoke-test-secret-0123456789abcdef',
    notes: createNotesRepo(),
  });
  const cookies = new Map<string, string>();
  let csrf = '';

  const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (cookies.size > 0) {
      headers.set('cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '));
    }
    const response = await app.handle(new Request(`${BASE}${path}`, { ...init, headers }));
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index);
      if (/max-age=0/i.test(cookie)) cookies.delete(name);
      else cookies.set(name, pair.slice(index + 1));
    }
    const type = response.headers.get('content-type') ?? '';
    if (type.includes('text/html')) {
      const html = await response.clone().text();
      csrf = /name="csrf-token" content="([^"]*)"/.exec(html)?.[1] ?? csrf;
    }
    return response;
  };

  const form = (path: string, fields: Record<string, string>) =>
    request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: csrf, ...fields }),
    });

  const json = (path: string, method: string, body?: unknown) =>
    request(path, {
      method,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-csrf-token': csrf,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const signIn = async () => {
    await request('/login');
    const response = await form('/login', { email: 'ada@example.com', password: 'lovelace' });
    expect(response.status).toBe(303);
    await request('/'); // picks up the post-login CSRF token
  };

  return { request, form, json, signIn, notes, csrf: () => csrf };
};

describe('full-stack example (#226)', () => {
  it('sends signed-out visitors to the sign-in page', async () => {
    const client = createClient();
    const response = await client.request('/');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login');
    expect((await client.json('/api/notes', 'GET')).status).toBe(401);
  });

  it('renders the sign-in page in the negotiated locale', async () => {
    const client = createClient();
    const german = await client.request('/login', {
      headers: { 'accept-language': 'de-DE,de;q=0.9' },
    });
    const html = await german.text();
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('Anmelden');

    const english = await (await client.request('/login?lang=en')).text();
    expect(english).toContain('Sign in');
  });

  it('rejects wrong credentials and a missing CSRF token', async () => {
    const client = createClient();
    await client.request('/login');
    const wrong = await client.form('/login', { email: 'ada@example.com', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(await wrong.text()).toContain('Wrong email or password.');

    const forged = await client.request('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=ada%40example.com&password=lovelace',
    });
    expect(forged.status).toBe(403);
  });

  it('rate-limits sign-in attempts per account', async () => {
    const client = createClient();
    await client.request('/login');
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (await client.form('/login', { email: 'ada@example.com', password: 'x' })).status
      );
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('server-renders notes from the route loader after sign-in', async () => {
    const client = createClient();
    await client.signIn();
    client.notes.add('u1', { title: 'From the loader', body: 'SSR' });

    const html = await (await client.request('/')).text();
    expect(html).toContain('From the loader');
    expect(html).toContain('1 note');
    expect(html).toContain('<script id="bq-state" type="application/json">');
  });

  it('validates notes on the server with the shared schema', async () => {
    const client = createClient();
    await client.signIn();

    const invalid = await client.json('/api/notes', 'POST', { title: '   ', body: '' });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      error: 'Validation failed',
      issues: [{ message: 'validation.titleRequired', path: ['title'] }],
    });

    const created = await client.json('/api/notes', 'POST', { title: '  Trimmed  ', body: 'x' });
    expect(created.status).toBe(201);
    const note = (await created.json()) as { id: string; title: string };
    expect(note.title).toBe('Trimmed');

    const detail = await client.request(`/notes/${note.id}`);
    expect(detail.status).toBe(200);
    expect(await detail.text()).toContain('Trimmed');
    expect((await client.request('/notes/missing')).status).toBe(404);

    expect((await client.json(`/api/notes/${note.id}`, 'DELETE')).status).toBe(204);
    expect((await client.json(`/api/notes/${note.id}`, 'DELETE')).status).toBe(404);
  });

  it('signs out', async () => {
    const client = createClient();
    await client.signIn();
    const response = await client.form('/logout', {});
    expect(response.headers.get('location')).toBe('/login');
    expect((await client.request('/')).status).toBe(303);
  });

  it('bundles the browser entry', async () => {
    const result = await Bun.build({
      entrypoints: [new URL('../examples/fullstack/client.ts', import.meta.url).pathname],
      target: 'browser',
    });
    expect(result.logs.filter((log) => log.level === 'error')).toEqual([]);
    expect(result.success).toBe(true);
  });
});

/**
 * The server: CSRF protection, a JSON API validated with the shared note
 * rules, and pages rendered from routes with loaders.
 *
 * `createApp()` only builds the request pipeline, so tests drive it with
 * `app.handle()` and `server.ts` binds it to a port.
 */

import type { RouteDefinition } from '@bquery/bquery/router';
import {
  createServer,
  csrf,
  csrfToken,
  type ServerApp,
  type ServerContext,
} from '@bquery/bquery/server';
import { createSSRContext, createSSRRouterContext, renderToString } from '@bquery/bquery/ssr';
import { countLabel, validateNote, type Note } from '../shared/note';
import { documentShell, noteTemplate, notesTemplate } from '../shared/pages';
import { createNotesRepo, type NotesRepo } from './notes-repo';

export interface AppOptions {
  /** Signs the CSRF cookie. Keep it stable across restarts in production. */
  secret: string;
  /** Mark cookies `Secure` (needs HTTPS; enable in production). */
  secureCookies?: boolean;
  /** JavaScript served as `/client.js`. */
  clientScript?: () => Promise<string>;
  /** CSS served as `/styles.css`. */
  stylesheet?: string;
  notes?: NotesRepo;
}

export const createApp = (options: AppOptions): { app: ServerApp; notes: NotesRepo } => {
  const notes = options.notes ?? createNotesRepo();
  const app = createServer();

  // Safe requests get a token (`csrfToken(ctx)`); every POST/PUT/DELETE must
  // send it back in the `x-csrf-token` header or a `_csrf` field, or gets 403.
  app.use(csrf({ secret: options.secret, cookie: { secure: options.secureCookies ?? false } }));

  // JSON API, validated with the rules the browser form uses.
  app.get('/api/notes', (ctx) => ctx.json(notes.list()));
  app.post('/api/notes', async (ctx) => {
    const result = validateNote(await ctx.body());
    if ('errors' in result) return ctx.json({ errors: result.errors }, { status: 400 });
    return ctx.json(notes.add(result.value), { status: 201 });
  });
  app.delete('/api/notes/:id', (ctx) =>
    notes.remove(ctx.params.id)
      ? ctx.response(null, { status: 204 })
      : ctx.json({ error: 'Not found' }, { status: 404 })
  );

  // Pages: the SSR router bridge runs a route's `meta.loader` before rendering.
  const routes: RouteDefinition[] = [
    {
      path: '/',
      component: () => null,
      meta: { template: notesTemplate, loader: () => ({ notes: notes.list() }) },
    },
    {
      path: '/notes/:id',
      component: () => null,
      meta: {
        template: noteTemplate,
        loader: ({
          ctx,
          route,
        }: {
          ctx: { status: number };
          route: { params: Record<string, string> };
        }) => {
          const note = notes.get(route.params.id) ?? null;
          if (!note) ctx.status = 404;
          return { note };
        },
      },
    },
  ];

  const renderPage = async (ctx: ServerContext) => {
    const ssr = createSSRContext({ request: ctx.request });
    const resolved = await createSSRRouterContext({ url: ctx.url, routes, ctx: ssr });
    if (!resolved.matched) return ctx.text('Not Found', { status: 404 });

    const data = resolved.data as { notes?: Note[]; note?: Note | null };
    // Embedded in the page; the browser hydrates from it.
    const state = {
      page: resolved.route.matched?.path,
      csrf: csrfToken(ctx) ?? '',
      ...data,
      countLabel: countLabel(data.notes?.length ?? 0),
    };
    const template = (resolved.route.matched?.meta as { template: string }).template;
    const body = renderToString(template, {
      ...state,
      // Server-side stand-ins for the browser's form and handlers.
      form: { fields: { title: { value: '', error: '' }, body: { value: '', error: '' } } },
      remove: () => undefined,
      submit: () => undefined,
    }).html;
    const title = data.note ? `${data.note.title} · Notes` : 'Notes';
    return ctx.html(documentShell({ title, body, csrf: state.csrf, state }), {
      status: ssr.status,
      trusted: true,
    });
  };
  app.get('/', renderPage);
  app.get('/notes/:id', renderPage);

  app.get('/client.js', async (ctx) =>
    ctx.response(options.clientScript ? await options.clientScript() : '', {
      headers: { 'content-type': 'text/javascript; charset=utf-8' },
    })
  );
  app.get('/styles.css', (ctx) =>
    ctx.response(options.stylesheet ?? '', {
      headers: { 'content-type': 'text/css; charset=utf-8' },
    })
  );

  return { app, notes };
};

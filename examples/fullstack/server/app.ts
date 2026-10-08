/**
 * The bQuery Notes server: sessions, CSRF, rate-limited sign-in, routes with
 * loaders rendered on the server, Standard Schema validation shared with the
 * browser, and locale negotiation.
 *
 * `createApp()` only builds the request pipeline, so tests drive it with
 * `app.handle()` and `server.ts` binds it to a port.
 */

import { createI18n, negotiateLocale } from '../../../src/i18n/index';
import type { RouteDefinition } from '../../../src/router/index';
import {
  createServer,
  csrf,
  csrfToken,
  guard,
  memoryStore,
  rateLimit,
  session,
  validate,
  type ServerApp,
  type ServerContext,
} from '../../../src/server/index';
import {
  createSSRContext,
  createSSRRouterContext,
  renderToString,
  type SSRContext,
} from '../../../src/ssr/index';
import { LOCALES, messages, type Locale } from '../shared/messages';
import { documentShell, loginTemplate, noteTemplate, notesTemplate } from '../shared/pages';
import { LoginSchema, NoteSchema } from '../shared/schema';
import { createNotesRepo, type Note, type NotesRepo } from './notes-repo';

/** Demo users. Store password hashes (e.g. Argon2id) in a real app. */
const USERS = new Map([['ada@example.com', { id: 'u1', password: 'lovelace' }]]);

export interface AppOptions {
  /** Signing secret for session and CSRF cookies. */
  secret: string;
  /** Set cookies with `Secure` (enable in production, behind HTTPS). */
  secureCookies?: boolean;
  /** JavaScript served as `/client.js`. */
  clientScript?: () => Promise<string>;
  /** CSS served as `/styles.css`. */
  stylesheet?: string;
  notes?: NotesRepo;
}

/** Per-request services the route loaders read, keyed by the request. */
interface Locals {
  userId: string;
  notes: NotesRepo;
}
const locals = new WeakMap<Request, Locals>();
const localsOf = (ctx: SSRContext): Locals => {
  const value = locals.get(ctx.request);
  if (!value) throw new Error('Route loader ran without request locals');
  return value;
};

/** Routes with loaders. The SSR router bridge runs `meta.loader` before render. */
const pageRoutes: RouteDefinition[] = [
  {
    path: '/',
    component: () => null,
    meta: {
      template: notesTemplate,
      loader: ({ ctx }: { ctx: SSRContext }) => {
        const { notes, userId } = localsOf(ctx);
        return { notes: notes.list(userId) };
      },
    },
  },
  {
    path: '/notes/:id',
    component: () => null,
    meta: {
      template: noteTemplate,
      loader: ({ ctx, route }: { ctx: SSRContext; route: { params: Record<string, string> } }) => {
        const { notes, userId } = localsOf(ctx);
        const note = notes.get(userId, route.params.id) ?? null;
        if (!note) ctx.status = 404;
        return { note };
      },
    },
  },
];

const LOCALE_COOKIE = 'locale';

const resolveLocale = (ctx: ServerContext): Locale => {
  const fromQuery = typeof ctx.query.lang === 'string' ? ctx.query.lang : undefined;
  const requested = [
    fromQuery,
    ctx.cookies[LOCALE_COOKIE],
    ...(ctx.request.headers.get('accept-language') ?? '')
      .split(',')
      .map((part) => part.split(';')[0].trim()),
  ].filter((tag): tag is string => Boolean(tag));
  return negotiateLocale(requested, LOCALES, { fallback: 'en' }) as Locale;
};

const translator = (locale: Locale) =>
  createI18n({ locale, fallbackLocale: 'en', messages: messages as never });

export const createApp = (options: AppOptions): { app: ServerApp; notes: NotesRepo } => {
  const notes = options.notes ?? createNotesRepo();
  const cookie = { secure: options.secureCookies ?? false };
  const app = createServer();

  app.use(session({ secret: options.secret, store: memoryStore(), cookie }));
  app.use(csrf({ secret: options.secret, cookie }));

  // The locale picked from ?lang=, a cookie or Accept-Language, remembered.
  app.use(async (ctx, next) => {
    const locale = resolveLocale(ctx);
    ctx.state.locale = locale;
    if (typeof ctx.query.lang === 'string') {
      ctx.setCookie(LOCALE_COOKIE, locale, { path: '/', sameSite: 'lax', maxAge: 31_536_000 });
    }
    return next();
  });

  const userId = (ctx: ServerContext): string | undefined =>
    typeof ctx.session?.userId === 'string' ? ctx.session.userId : undefined;
  const signedIn = guard((ctx) => Boolean(userId(ctx)), {
    onDeny: (ctx) =>
      ctx.request.headers.get('accept')?.includes('application/json')
        ? ctx.json({ error: 'Unauthorized' }, { status: 401 })
        : ctx.redirect('/login', 303),
  });

  const page = (ctx: ServerContext, title: string, body: string, state: unknown, status = 200) =>
    ctx.html(
      documentShell({
        locale: ctx.state.locale as string,
        title,
        body,
        csrf: csrfToken(ctx) ?? '',
        state,
      }),
      { status, trusted: true }
    );

  const renderLogin = (ctx: ServerContext, error = '', email = '', status = 200) => {
    const locale = ctx.state.locale as Locale;
    const i18n = translator(locale);
    const state = {
      page: 'login',
      locale,
      csrf: csrfToken(ctx) ?? '',
      error,
      email,
      labels: {
        heading: i18n.t('login.heading'),
        hint: i18n.t('login.hint'),
        email: i18n.t('login.email'),
        password: i18n.t('login.password'),
        submit: i18n.t('login.submit'),
      },
      locales: LOCALES.map((tag) => ({
        href: `/login?lang=${tag}`,
        label: tag.toUpperCase(),
        current: tag === locale ? 'page' : false,
      })),
    };
    return page(ctx, i18n.t('app.title'), renderToString(loginTemplate, state).html, state, status);
  };

  app.get('/login', (ctx) => (userId(ctx) ? ctx.redirect('/', 303) : renderLogin(ctx)));

  // Five attempts per minute per email address, before the password check.
  const loginLimit = rateLimit({
    window: 60_000,
    max: 5,
    keyBy: async (ctx) => {
      const body = (await ctx.body()) as { email?: string } | null;
      return typeof body?.email === 'string' ? body.email.toLowerCase() : 'anonymous';
    },
  });

  app.post(
    '/login',
    async (ctx) => {
      const body = (await ctx.body()) as { email?: string; password?: string };
      const email = String(body?.email ?? '')
        .trim()
        .toLowerCase();
      const result = await LoginSchema['~standard'].validate(body);
      const user = USERS.get(email);
      if (result.issues || !user || user.password !== body?.password) {
        const i18n = translator(ctx.state.locale as Locale);
        return renderLogin(ctx, i18n.t('login.failed'), email, 401);
      }
      // A new session id on sign-in defeats session fixation.
      ctx.session!.$regenerate();
      ctx.session!.userId = user.id;
      return ctx.redirect('/', 303);
    },
    [loginLimit]
  );

  app.post('/logout', (ctx) => {
    ctx.session?.$destroy();
    return ctx.redirect('/login', 303);
  });

  // JSON API, validated with the schema the browser form uses.
  const noteBody = validate(NoteSchema);
  app.get('/api/notes', (ctx) => ctx.json(notes.list(userId(ctx)!)), [signedIn]);
  app.post(
    '/api/notes',
    (ctx) => ctx.json(notes.add(userId(ctx)!, noteBody.data(ctx)), { status: 201 }),
    [signedIn, noteBody]
  );
  app.delete(
    '/api/notes/:id',
    (ctx) =>
      notes.remove(userId(ctx)!, ctx.params.id)
        ? ctx.response(null, { status: 204 })
        : ctx.json({ error: 'Not found' }, { status: 404 }),
    [signedIn]
  );

  // Server-rendered pages: resolve the route, run its loader, render.
  const renderPage = async (ctx: ServerContext) => {
    const ssr = createSSRContext({ request: ctx.request });
    locals.set(ctx.request, { userId: userId(ctx)!, notes });
    const resolved = await createSSRRouterContext({ url: ctx.url, routes: pageRoutes, ctx: ssr });
    if (!resolved.matched) return ctx.text('Not Found', { status: 404 });

    const locale = ctx.state.locale as Locale;
    const i18n = translator(locale);
    const data = resolved.data as { notes?: Note[]; note?: Note | null };
    const state = {
      page: resolved.route.matched?.path,
      locale,
      csrf: csrfToken(ctx) ?? '',
      ...data,
      countLabel: i18n.t('notes.count', { count: data.notes?.length ?? 0 }),
      labels: {
        heading: i18n.t('notes.heading'),
        signOut: i18n.t('notes.signOut'),
        remove: i18n.t('notes.remove'),
        title: i18n.t('notes.title'),
        body: i18n.t('notes.body'),
        add: i18n.t('notes.add'),
        draftSaved: i18n.t('notes.draftSaved'),
        back: i18n.t('notes.back'),
        notFound: i18n.t('notes.notFound'),
      },
    };
    const template = (resolved.route.matched?.meta as { template: string }).template;
    const html = renderToString(template, {
      ...state,
      // Server-side stand-ins for the client's form, handlers and draft state.
      form: { fields: { title: { value: '' }, body: { value: '' } } },
      fieldError: () => '',
      remove: () => undefined,
      draftSaved: false,
    }).html;
    return page(ctx, i18n.t('app.title'), html, state, ssr.status);
  };
  app.get('/', renderPage, [signedIn]);
  app.get('/notes/:id', renderPage, [signedIn]);

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

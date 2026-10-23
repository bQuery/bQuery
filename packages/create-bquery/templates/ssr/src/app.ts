/**
 * The application: turns any `Request` into a `Response`. It uses only the
 * standard Fetch API, so the same code runs on Node, Bun and Deno — the
 * runtime-specific part is the few lines in `server.ts`.
 */
import { createSSRContext, renderToResponse, resolveSSRRoute } from '@bquery/bquery/ssr';

// The `bq-*` directives are the same ones the view module uses in the browser.
const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title bq-text="title">bQuery SSR</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
    <main>
      <h1 bq-text="title"></h1>
      <p bq-text="message"></p>
      <p>Runtime: <strong bq-text="runtime"></strong></p>
      <p>Path: <code bq-text="route.path"></code></p>
      <ul bq-show="items.length > 0">
        <li bq-for="item in items" bq-text="item"></li>
      </ul>
    </main>
  </body>
</html>`;

interface PageMeta {
  title: string;
  message: string;
  items: string[];
}

const ROUTES = [
  {
    path: '/',
    component: () => null,
    meta: {
      title: 'Home',
      message: 'This page was rendered on the server.',
      items: ['signals', 'computeds', 'streaming', 'islands'],
    } satisfies PageMeta,
  },
  {
    path: '/about',
    component: () => null,
    meta: {
      title: 'About',
      message: 'Add a route in src/app.ts to add a page.',
      items: [],
    } satisfies PageMeta,
  },
];

const NOT_FOUND: PageMeta = {
  title: 'Not Found',
  message: 'No route matched this URL.',
  items: [],
};

/** Renders the page for `request`. `runtime` is only shown on the page. */
export const handle = async (request: Request, runtime: string): Promise<Response> => {
  const ctx = createSSRContext({ request, mode: 'string' });
  const resolved = resolveSSRRoute({ url: ctx.url, routes: ROUTES });

  if (resolved.isRedirect && resolved.redirectTo) {
    return Response.redirect(new URL(resolved.redirectTo, ctx.url), 302);
  }

  const page = resolved.matched ? (resolved.route.matched?.meta as unknown as PageMeta) : NOT_FOUND;

  return renderToResponse(
    TEMPLATE,
    { ...page, runtime, route: resolved.route },
    {
      context: ctx,
      // A stable ETag lets browsers revalidate with `304 Not Modified`.
      etag: true,
      cacheControl: 'public, max-age=0, must-revalidate',
      status: resolved.matched ? 200 : 404,
    }
  );
};

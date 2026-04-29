/**
 * Shared SSR application used by every runtime example.
 *
 * Imports come from the source so the examples can be run before the
 * library is built. Once published, real apps would import from
 * `@bquery/bquery/ssr` instead.
 */
import { createSSRContext, renderToResponse, resolveSSRRoute } from '../../src/ssr/index.ts';

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title bq-text="title">bQuery SSR</title>
  </head>
  <body>
    <main>
      <h1 bq-text="title"></h1>
      <p bq-text="message"></p>
      <p>Runtime: <strong bq-text="runtime"></strong></p>
      <p>Path: <code bq-text="route.path"></code></p>
      <ul>
        <li bq-for="item in items" bq-text="item"></li>
      </ul>
    </main>
  </body>
</html>`;

const ROUTES = [
  { path: '/', component: () => null, meta: { title: 'Home' } },
  { path: '/about', component: () => null, meta: { title: 'About' } },
];

/** Build the same `Response` from any `Request`, regardless of runtime. */
export const handle = async (request: Request, runtime: string): Promise<Response> => {
  const ctx = createSSRContext({ request, mode: 'string' });
  const resolved = resolveSSRRoute({ url: ctx.url, routes: ROUTES });

  if (resolved.isRedirect && resolved.redirectTo) {
    return Response.redirect(new URL(resolved.redirectTo, ctx.url), 302);
  }

  const title =
    (resolved.route.matched?.meta as { title?: string } | undefined)?.title ?? 'Not Found';

  return renderToResponse(
    TEMPLATE,
    {
      title,
      message: resolved.matched
        ? `Welcome to bQuery SSR on ${runtime}.`
        : 'No route matched this URL.',
      runtime,
      route: resolved.route,
      items: ['signals', 'computeds', 'streaming', 'islands'],
    },
    {
      context: ctx,
      etag: true,
      cacheControl: 'public, max-age=0, must-revalidate',
      status: resolved.matched ? 200 : 404,
    }
  );
};

/**
 * Static server for the real-browser test lane (#214), built on bQuery's own
 * `createServer()` + `serveStatic()`.
 *
 * - `/dist/*`      — the built library (`bun run build` first)
 * - `/fixtures/*`  — test pages
 * - `/tt/*`        — the same pages under an enforced Trusted Types CSP
 */

import { fileURLToPath } from 'node:url';
import { createServer, serveStatic } from '../src/server/index';

const root = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export const TRUSTED_TYPES_CSP =
  "require-trusted-types-for 'script'; trusted-types bquery-sanitizer";

const app = createServer();

app.use(async (ctx, next) => {
  const response = await next();
  if (ctx.path.startsWith('/tt/')) {
    const headers = new Headers(response.headers);
    headers.set('content-security-policy', TRUSTED_TYPES_CSP);
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
  return response;
});
app.use(serveStatic({ root: root('../dist'), prefix: '/dist' }));
app.use(serveStatic({ root: root('./fixtures'), prefix: '/fixtures' }));
app.use(serveStatic({ root: root('./fixtures'), prefix: '/tt' }));

const port = Number(process.env.PORT ?? 4173);
await app.listen({ hostname: '127.0.0.1', port });
console.log(`bQuery browser fixtures on http://127.0.0.1:${port}`);

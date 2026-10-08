/**
 * bQuery Notes — full-stack example.
 *
 *   bun examples/fullstack/server.ts
 *
 * Listens on http://localhost:3000/ (override with PORT). Sign in with
 * ada@example.com / lovelace.
 */

import { readFile } from 'node:fs/promises';
import { createApp } from './server/app';

const here = (path: string): string => new URL(path, import.meta.url).pathname;

/** Bundle client.ts for the browser once, on first request. */
let clientBundle: Promise<string> | undefined;
const buildClient = (): Promise<string> =>
  (clientBundle ??= (async () => {
    const result = await Bun.build({
      entrypoints: [here('./client.ts')],
      target: 'browser',
      minify: true,
    });
    if (!result.success) throw new AggregateError(result.logs, 'client build failed');
    return result.outputs[0].text();
  })());

const secret = process.env.SESSION_SECRET ?? crypto.randomUUID() + crypto.randomUUID();
const { app } = createApp({
  secret,
  secureCookies: process.env.NODE_ENV === 'production',
  clientScript: buildClient,
  stylesheet: await readFile(here('./styles.css'), 'utf8'),
});

const port = Number(process.env.PORT ?? 3000);
const handle = await app.listen({ hostname: '127.0.0.1', port });
console.log(`bQuery Notes on ${handle.url}/ — sign in with ada@example.com / lovelace`);

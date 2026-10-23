/**
 * Entry point: `bun server.ts` (or `bun run dev`).
 *
 * Listens on http://localhost:3000/ (override with PORT). Set CSRF_SECRET to
 * keep tokens valid across restarts.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApp } from './server/app';

// fileURLToPath, not URL#pathname: the pathname stays percent-encoded (a space
// in the project path becomes %20) and has a leading slash on Windows.
const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/** Bundles client.ts for the browser once, on first request. */
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

const { app } = createApp({
  secret: process.env.CSRF_SECRET ?? crypto.randomUUID() + crypto.randomUUID(),
  secureCookies: process.env.NODE_ENV === 'production',
  clientScript: buildClient,
  stylesheet: await readFile(here('./styles.css'), 'utf8'),
});

const server = await app.listen({ hostname: '127.0.0.1', port: Number(process.env.PORT ?? 3000) });
console.log(`bQuery Notes on ${server.url}/`);

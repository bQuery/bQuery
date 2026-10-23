/**
 * Bun entry: `bun src/server.ts`. `Bun.serve()` speaks the Fetch API that
 * `handle()` uses, so no adapter is needed.
 */
import { handle } from './app.ts';

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  fetch: (request) => handle(request, 'Bun'),
});

console.log(`bQuery SSR (Bun) ready on http://localhost:${server.port}/`);

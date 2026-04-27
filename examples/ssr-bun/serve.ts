/**
 * Bun SSR example.
 *
 *   bun serve.ts
 *
 * Listens on http://localhost:3000/.
 */
import { handle } from '../shared/app.ts';

// `Bun.serve` is part of the global Bun API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Bun = (globalThis as any).Bun;
if (!Bun?.serve) {
  console.error('This example must be run with Bun.');
  process.exit(1);
}

const server = Bun.serve({
  port: 3000,
  fetch: (request: Request) => handle(request, 'Bun'),
});

console.log(`bQuery SSR (Bun) ready on http://${server.hostname}:${server.port}/`);

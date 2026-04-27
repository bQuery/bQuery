/**
 * Deno SSR example.
 *
 *   deno run --allow-net serve.ts
 *
 * Listens on http://localhost:3000/.
 */
import { handle } from '../shared/app.ts';

// `Deno.serve` is part of the global Deno API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Deno = (globalThis as any).Deno;
if (!Deno?.serve) {
  console.error('This example must be run with Deno.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).process?.exit?.(1);
  throw new Error('Not running in Deno.');
}

Deno.serve({ port: 3000 }, (request: Request) => handle(request, 'Deno'));

console.log('bQuery SSR (Deno) ready on http://localhost:3000/');

/**
 * Deno SSR example.
 *
 *   deno run --allow-net examples/ssr-deno/serve.ts
 *
 * Listens on http://localhost:3000/.
 */
import { handle } from '../shared/app.ts';

interface RuntimeGlobals {
  Deno?: {
    serve?: (
      options: { port: number },
      handler: (request: Request) => Response | Promise<Response>
    ) => unknown;
  };
  process?: {
    exit?: (code?: number) => never | void;
  };
}

// `Deno.serve` is part of the global Deno API.
const runtimeGlobals = globalThis as unknown as RuntimeGlobals;
const Deno = runtimeGlobals.Deno;
if (!Deno?.serve) {
  console.error('This example must be run with Deno.');
  runtimeGlobals.process?.exit?.(1);
  throw new Error('Not running in Deno.');
}

Deno.serve({ port: 3000 }, (request: Request) => handle(request, 'Deno'));

console.log('bQuery SSR (Deno) ready on http://localhost:3000/');

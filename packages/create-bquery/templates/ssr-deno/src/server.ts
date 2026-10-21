/**
 * Deno entry: `deno task dev`. `Deno.serve()` speaks the Fetch API that
 * `handle()` uses, so no adapter is needed.
 */
import { handle } from './app.ts';

Deno.serve(
  {
    port: Number(Deno.env.get('PORT') ?? 3000),
    onListen: ({ port }) => console.log(`bQuery SSR (Deno) ready on http://localhost:${port}/`),
  },
  (request) => handle(request, 'Deno')
);

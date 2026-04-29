/**
 * Bun SSR example.
 *
 *   bun examples/ssr-bun/serve.ts
 *
 * Listens on http://localhost:3000/.
 */
import { handle } from '../shared/app.ts';

interface BunServer {
  hostname: string;
  port: number;
}

interface BunRuntime {
  serve(options: {
    port: number;
    fetch(request: Request): Response | Promise<Response>;
  }): BunServer;
}

interface RuntimeGlobals {
  Bun?: BunRuntime;
}

// `Bun.serve` is part of the global Bun API.
const Bun = (globalThis as RuntimeGlobals).Bun;
if (!Bun?.serve) {
  console.error('This example must be run with Bun.');
  process.exit(1);
}

const server = Bun.serve({
  port: 3000,
  fetch: (request: Request) => handle(request, 'Bun'),
});

console.log(`bQuery SSR (Bun) ready on http://${server.hostname}:${server.port}/`);

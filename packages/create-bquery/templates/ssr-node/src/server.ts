/**
 * Node entry: `node src/server.ts` (Node >= 24 runs TypeScript directly).
 * `createNodeHandler()` bridges `node:http` to the Fetch API `handle()` uses.
 */
import http from 'node:http';
import { createNodeHandler } from '@bquery/bquery/ssr';
import { handle } from './app.ts';

const handler = createNodeHandler((request: Request) => handle(request, 'Node'));
const server = http.createServer((req, res) => {
  void handler(req, res);
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : process.env.PORT;
  console.log(`bQuery SSR (Node) ready on http://localhost:${port}/`);
});

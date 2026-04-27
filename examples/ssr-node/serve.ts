/**
 * Node SSR example.
 *
 *   node --experimental-strip-types serve.ts
 *
 * Listens on http://localhost:3000/. Uses `createNodeHandler` to bridge
 * `node:http` to the Web `Request` / `Response` API.
 */
import http from 'node:http';
import { createNodeHandler } from '../../src/ssr/index.ts';
import { handle } from '../shared/app.ts';

const handler = createNodeHandler((request: Request) => handle(request, 'Node'));

const server = http.createServer((req, res) => {
  // The adapter copies the `Request` body lazily; `node:http` requests are
  // small here so the default 1 MiB max-body limit is fine.
  void handler(req, res);
});

server.listen(3000, () => {
  console.log('bQuery SSR (Node) ready on http://localhost:3000/');
});

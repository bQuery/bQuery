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
  // The current adapter reads the `node:http` request body eagerly into
  // memory before creating the Web `Request`; this example does not rely on
  // or configure a built-in body-size limit.
  void handler(req, res);
});

server.listen(3000, () => {
  console.log('bQuery SSR (Node) ready on http://localhost:3000/');
});

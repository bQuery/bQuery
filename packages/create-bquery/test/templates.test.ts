/**
 * Proves the template code itself works: every variant is scaffolded into a
 * temp directory whose `node_modules` points at this checkout (see
 * `linkRepoPackages()`), and then its own test suite, its type-check, its
 * production build and its server run there. A template whose tests fail out
 * of the box is a bug.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { scaffold, type Runtime, type Template } from '../src/index.js';
import { REPO_ROOT, linkRepoPackages, makeTempDir, removeTempDirs } from './helpers';

const TIMEOUT = 120_000;
const TSC = join(REPO_ROOT, 'node_modules/typescript/bin/tsc');
const VITE = join(REPO_ROOT, 'node_modules/vite/bin/vite.js');

interface Variant {
  key: string;
  template: Template;
  runtime?: Runtime;
  /** Type-check config; `undefined` for plain-JavaScript templates. */
  tsconfig?: string;
  /** Server entry to start, relative to the project. */
  server?: string;
}

const VARIANTS: Variant[] = [
  { key: 'cdn', template: 'cdn' },
  { key: 'spa', template: 'spa', tsconfig: 'tsconfig.json' },
  {
    key: 'ssr-node',
    template: 'ssr',
    runtime: 'node',
    tsconfig: 'tsconfig.verify.json',
    // Bun implements node:http, so it can start the Node entry against the
    // TypeScript sources (Node itself cannot import them from node_modules).
    server: 'src/server.ts',
  },
  {
    key: 'ssr-bun',
    template: 'ssr',
    runtime: 'bun',
    tsconfig: 'tsconfig.json',
    server: 'src/server.ts',
  },
  { key: 'ssr-deno', template: 'ssr', runtime: 'deno', tsconfig: 'tsconfig.verify.json' },
  { key: 'fullstack', template: 'fullstack', tsconfig: 'tsconfig.json', server: 'server.ts' },
];

/**
 * Extra files for the type-check that a real project gets from its runtime.
 *
 * - Node: the project uses `moduleResolution: NodeNext`, which (correctly)
 *   rejects the extensionless imports inside bQuery's `src/` — the published
 *   package ships `.d.ts` files instead. Resolve with `Bundler` here.
 * - Deno: `deno check` provides the `Deno` namespace and reads `deno.json`;
 *   tsc gets an equivalent config and a declaration of the APIs `server.ts` uses.
 */
const writeVerifyConfig = (dir: string, key: string): void => {
  if (key === 'ssr-node') {
    writeFileSync(
      join(dir, 'tsconfig.verify.json'),
      JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' },
      })
    );
  }
  if (key === 'ssr-deno') {
    writeFileSync(
      join(dir, 'deno-globals.d.ts'),
      `declare namespace Deno {
  const env: { get(name: string): string | undefined };
  function serve(
    options: { port?: number; onListen?: (address: { hostname: string; port: number }) => void },
    handler: (request: Request) => Response | Promise<Response>
  ): unknown;
}
`
    );
    writeFileSync(
      join(dir, 'tsconfig.verify.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          types: ['node'],
          strict: true,
          noEmit: true,
          allowImportingTsExtensions: true,
          skipLibCheck: true,
        },
        include: ['src', 'test', 'deno-globals.d.ts'],
      })
    );
  }
};

/** Runs a command without blocking the event loop, so variants run in parallel. */
const exec = async (cmd: string[], cwd: string): Promise<{ exitCode: number; output: string }> => {
  const proc = Bun.spawn({
    cmd,
    cwd,
    env: { ...process.env, NO_COLOR: '1', PORT: undefined },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, output: `${stdout}${stderr}` };
};

/**
 * tsc diagnostics in the project's own files. The linked bQuery sources are
 * compiled under the project's settings too (a published install reads its
 * `.d.ts` files instead), so diagnostics located there are not the template's.
 */
const projectDiagnostics = (output: string): string[] =>
  output
    .split('\n')
    .filter((line) => /error TS\d+/.test(line))
    .filter((line) => {
      const file = /^(.+?)\(\d+,\d+\): error/.exec(line)?.[1];
      return file === undefined || !(file.startsWith('..') || isAbsolute(file));
    });

/** Starts a server on a free port, fetches `/`, and stops it. */
const smokeServer = async (dir: string, entry: string) => {
  const proc = Bun.spawn({
    cmd: [process.execPath, entry],
    cwd: dir,
    env: { ...process.env, PORT: '0', NO_COLOR: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  try {
    const reader = proc.stdout.getReader();
    let output = '';
    const deadline = Date.now() + 20_000;
    let url: string | undefined;
    while (!url && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      output += new TextDecoder().decode(value);
      url = /(http:\/\/[^\s]+?)\/?(\s|$)/.exec(output)?.[1];
    }
    if (!url) throw new Error(`server did not report a URL:\n${output}`);
    const response = await fetch(`${url}/`);
    return { status: response.status, html: await response.text() };
  } finally {
    proc.kill();
    await proc.exited;
  }
};

const projects = new Map<string, Promise<string>>();
const results = new Map<string, Record<string, Promise<{ exitCode: number; output: string }>>>();

beforeAll(() => {
  for (const variant of VARIANTS) {
    const dir = join(makeTempDir('create-bquery-verify-'), variant.key);
    const ready = scaffold({
      targetDir: dir,
      template: variant.template,
      runtime: variant.runtime,
      projectName: `verify-${variant.key}`,
    }).then(() => {
      linkRepoPackages(dir);
      writeVerifyConfig(dir, variant.key);
      return dir;
    });
    projects.set(variant.key, ready);
    // Start the slow checks right away; the tests below await them.
    const checks: Record<string, Promise<{ exitCode: number; output: string }>> = {
      test: ready.then(() => exec([process.execPath, 'test'], dir)),
    };
    if (variant.tsconfig) {
      checks.typecheck = ready.then(() =>
        exec([process.execPath, TSC, '-p', variant.tsconfig!, '--pretty', 'false'], dir)
      );
    }
    if (variant.key === 'spa') {
      checks.build = ready.then(() =>
        exec([process.execPath, VITE, 'build', '--logLevel', 'warn'], dir)
      );
    }
    results.set(variant.key, checks);
  }
});

afterAll(removeTempDirs);

describe('scaffolded projects', () => {
  for (const variant of VARIANTS) {
    describe(variant.key, () => {
      it(
        'pass their own test suite',
        async () => {
          const { exitCode, output } = await results.get(variant.key)!.test;
          if (exitCode !== 0) console.error(output);
          expect(exitCode).toBe(0);
          expect(output).toMatch(/\b[1-9]\d* pass\b/);
          expect(output).toMatch(/\b0 fail\b/);
        },
        TIMEOUT
      );

      if (variant.tsconfig) {
        it(
          'type-check',
          async () => {
            const { output } = await results.get(variant.key)!.typecheck;
            expect(projectDiagnostics(output)).toEqual([]);
          },
          TIMEOUT
        );
      }

      if (variant.key === 'spa') {
        it(
          'build for production',
          async () => {
            const { exitCode, output } = await results.get('spa')!.build;
            if (exitCode !== 0) console.error(output);
            expect(exitCode).toBe(0);
          },
          TIMEOUT
        );
      }

      if (variant.server) {
        it(
          'serve the home page',
          async () => {
            const dir = await projects.get(variant.key)!;
            const { status, html } = await smokeServer(dir, variant.server!);
            expect(status).toBe(200);
            expect(html).toStartWith('<!doctype html>');
          },
          TIMEOUT
        );
      }
    });
  }
});

import { afterAll, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { run } from '../src/cli.js';
import { BQUERY_VERSION } from '../src/versions.js';
import { CLI, makeTempDir, removeTempDirs, runCommand } from './helpers';

afterAll(removeTempDirs);

/** Runs the real executable with Node, as `npm create` would. */
const cli = (args: string[], cwd: string, env: Record<string, string | undefined> = {}) =>
  runCommand(['node', CLI, ...args], cwd, { npm_config_user_agent: undefined, ...env });

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

describe('create-bquery CLI', () => {
  it('scaffolds the default template with --yes', () => {
    const cwd = makeTempDir();
    const { exitCode, output } = cli(['my-app', '--yes'], cwd);
    expect(exitCode).toBe(0);
    expect(output).toContain('from the spa template in my-app');
    expect(output).toContain('cd my-app\n  npm install\n  npm run dev');
    expect(readJson(join(cwd, 'my-app/package.json')).name).toBe('my-app');
    expect(existsSync(join(cwd, 'my-app/.gitignore'))).toBe(true);
  });

  it('uses defaults without prompting when stdin is not a TTY', () => {
    const cwd = makeTempDir();
    const { exitCode, output } = cli([], cwd);
    expect(exitCode).toBe(0);
    expect(output).toContain('Created bquery-app from the spa template');
    expect(existsSync(join(cwd, 'bquery-app/src/app.ts'))).toBe(true);
  });

  it('picks the template, runtime and package manager from flags', () => {
    const cwd = makeTempDir();
    const { exitCode, output } = cli(
      ['api', '--template', 'ssr', '--runtime', 'deno', '--pm', 'pnpm', '-y'],
      cwd
    );
    expect(exitCode).toBe(0);
    expect(output).toContain('from the ssr (deno) template');
    expect(output).toContain('deno task dev');
    expect(existsSync(join(cwd, 'api/deno.json'))).toBe(true);
    expect(existsSync(join(cwd, 'api/package.json'))).toBe(false);
  });

  it('writes commands for the package manager that launched it', () => {
    const cwd = makeTempDir();
    const { output } = cli(['site', '-t', 'cdn', '-y'], cwd, {
      npm_config_user_agent: 'bun/1.4.2 npm/? node/v24.3.0 linux x64',
    });
    expect(output).toContain('bun install\n  bun run start');
    expect(output).toContain('bun run test');
  });

  it('notes that --runtime is ignored outside the ssr template', () => {
    const cwd = makeTempDir();
    const { exitCode, output } = cli(['web', '--runtime', 'bun', '--yes'], cwd);
    expect(exitCode).toBe(0);
    expect(output).toContain('--runtime only applies to the ssr template');
  });

  it('refuses a non-empty directory unless --force is given', () => {
    const cwd = makeTempDir();
    cli(['app', '-y'], cwd);
    writeFileSync(join(cwd, 'app/notes.txt'), 'mine');

    const refused = cli(['app', '-y', '-t', 'cdn'], cwd);
    expect(refused.exitCode).toBe(1);
    expect(refused.output).toContain('is not empty');
    expect(existsSync(join(cwd, 'app/index.html'))).toBe(true); // still the spa one
    expect(existsSync(join(cwd, 'app/serve.js'))).toBe(false);

    const forced = cli(['app', '-y', '-t', 'cdn', '--force'], cwd);
    expect(forced.exitCode).toBe(0);
    expect(existsSync(join(cwd, 'app/serve.js'))).toBe(true);
    expect(readFileSync(join(cwd, 'app/notes.txt'), 'utf8')).toBe('mine');
  });

  it('rejects invalid project names, with a suggestion', () => {
    const cwd = makeTempDir();
    const { exitCode, output } = cli(['My App', '-y'], cwd);
    expect(exitCode).toBe(1);
    expect(output).toContain('Invalid project name "My App"');
    expect(output).toContain('--name my-app');
    expect(existsSync(join(cwd, 'My App'))).toBe(false);

    const named = cli(['My App', '-y', '--name', 'my-app'], cwd);
    expect(named.exitCode).toBe(0);
    expect(readJson(join(cwd, 'My App/package.json')).name).toBe('my-app');
  });

  it('rejects unknown templates, runtimes, package managers and options', () => {
    const cwd = makeTempDir();
    expect(cli(['x', '-t', 'vue', '-y'], cwd).output).toContain(
      'Unknown template "vue". Choose one of: cdn, spa, ssr, fullstack.'
    );
    expect(cli(['x', '-r', 'workerd', '-y'], cwd).output).toContain('Unknown runtime "workerd"');
    expect(cli(['x', '--pm', 'npx', '-y'], cwd).output).toContain('Unknown package manager "npx"');
    const unknown = cli(['x', '--typescript'], cwd);
    expect(unknown.exitCode).toBe(1);
    expect(unknown.output).toContain("Unknown option '--typescript'");
    expect(cli(['a', 'b', '-y'], cwd).output).toContain('Expected at most one directory');
    expect(existsSync(join(cwd, 'x'))).toBe(false);
  });

  it('prints help and version', () => {
    const cwd = makeTempDir();
    const help = cli(['--help'], cwd);
    expect(help.exitCode).toBe(0);
    expect(help.output).toContain('Usage: npm create bquery@latest [dir] [options]');
    const version = cli(['--version'], cwd);
    expect(version.output.trim()).toBe(
      `${readJson(join(import.meta.dir, '../package.json')).version} (templates for @bquery/bquery ${BQUERY_VERSION})`
    );
  });
});

describe('interactive prompts', () => {
  /**
   * Fakes a terminal: stdin claims to be a TTY and each prompt written to
   * stdout is answered with the next entry of `answers`.
   */
  const interactive = async (
    args: string[],
    answers: string[],
    prepare?: (cwd: string) => void
  ) => {
    const cwd = makeTempDir();
    prepare?.(cwd);
    const stdin = Object.assign(new PassThrough(), { isTTY: true });
    let output = '';
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        if (/(\]|\?): $/.test(output) && answers.length > 0) {
          const answer = answers.shift();
          setTimeout(() => stdin.write(`${answer}\n`), 0);
        }
        callback();
      },
    });
    const stderr = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const exitCode = await run(args, { stdin, stdout, stderr, cwd, env: { NO_COLOR: '1' } });
    return { exitCode, output, cwd };
  };

  it('asks for the directory, template and runtime', async () => {
    const { exitCode, output, cwd } = await interactive([], ['server-app', '3', 'bun']);
    expect(exitCode).toBe(0);
    expect(output).toContain('Project directory [bquery-app]: ');
    expect(output).toContain('Which template?');
    expect(output).toContain('Which server runtime?');
    expect(output).toContain('from the ssr (bun) template in server-app');
    expect(readFileSync(join(cwd, 'server-app/src/server.ts'), 'utf8')).toContain('Bun.serve');
  });

  it('re-asks invalid answers and offers a valid package name', async () => {
    const { exitCode, output, cwd } = await interactive(['Fancy Site'], ['9', 'cdn', '']);
    expect(exitCode).toBe(0);
    expect(output).toContain('"9" is not one of: cdn, spa, ssr, fullstack');
    expect(output).toContain('Package name [fancy-site]: ');
    expect(readJson(join(cwd, 'Fancy Site/package.json')).name).toBe('fancy-site');
  });

  it('asks before writing into a non-empty directory', async () => {
    const prepare = (cwd: string) => writeFileSync(join(cwd, 'keep.txt'), 'mine');
    const args = ['.', '--template', 'cdn', '--name', 'app'];

    const declined = await interactive(args, ['n'], prepare);
    expect(declined.exitCode).toBe(1);
    expect(declined.output).toContain('Directory "." is not empty.');
    expect(declined.output).toContain('Cancelled.');
    expect(existsSync(join(declined.cwd, 'index.html'))).toBe(false);

    const accepted = await interactive(args, ['y'], prepare);
    expect(accepted.exitCode).toBe(0);
    expect(existsSync(join(accepted.cwd, 'index.html'))).toBe(true);
    expect(readFileSync(join(accepted.cwd, 'keep.txt'), 'utf8')).toBe('mine');
  });
});

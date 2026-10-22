/**
 * Command-line front end of `create-bquery`: argument parsing, optional
 * prompts and the printed next steps. Scaffolding itself is `scaffold()`.
 *
 * @module create-bquery/cli
 */

import { readFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { BQUERY_VERSION } from './versions.js';
import {
  DEFAULT_RUNTIME,
  DEFAULT_TEMPLATE,
  PACKAGE_MANAGERS,
  RUNTIMES,
  RUNTIME_DESCRIPTIONS,
  TEMPLATES,
  TEMPLATE_DESCRIPTIONS,
  ScaffoldError,
  detectPackageManager,
  isEmptyDir,
  projectCommands,
  scaffold,
  toValidProjectName,
  validateProjectName,
} from './index.js';

const DEFAULT_DIR = 'bquery-app';

const USAGE = `Usage: npm create bquery@latest [dir] [options]

Scaffold a new bQuery.js project in [dir] (default: ${DEFAULT_DIR}).

Options:
  -t, --template <name>  ${TEMPLATES.join(' | ')} (default: ${DEFAULT_TEMPLATE})
  -r, --runtime <name>   ${RUNTIMES.join(' | ')} — server runtime of the ssr template (default: ${DEFAULT_RUNTIME})
      --pm <name>        ${PACKAGE_MANAGERS.join(' | ')} — package manager for the printed commands
                         (default: the one running this command)
      --name <name>      package name (default: the directory name)
  -y, --yes              do not prompt; use defaults for everything not given
  -f, --force            write into a non-empty directory, overwriting files with the same name
  -h, --help             show this help
  -v, --version          print the create-bquery version and the bQuery release it targets

Templates:
${TEMPLATES.map((name) => `  ${name.padEnd(10)} ${TEMPLATE_DESCRIPTIONS[name]}`).join('\n')}

With npm, pass options after "--": npm create bquery@latest my-app -- --template ssr`;

/** Reads this package's version. */
const packageVersion = () =>
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** Quotes a path for the printed shell commands when needed. */
const shellQuote = (value) => (/^[\w@%+=:,./-]+$/.test(value) ? value : JSON.stringify(value));

/** Minimal ANSI styling, off for non-TTY output and when NO_COLOR is set. */
const createStyle = (stream, env) => {
  const enabled = Boolean(stream.isTTY) && !('NO_COLOR' in env);
  const wrap = (open, close) => (text) => (enabled ? `\x1b[${open}m${text}\x1b[${close}m` : text);
  return { bold: wrap(1, 22), cyan: wrap(36, 39), dim: wrap(2, 22), red: wrap(31, 39) };
};

/** Asks until the answer names (or numbers) one of `choices`; empty picks `fallback`. */
const choose = async (rl, write, question, choices, descriptions, fallback) => {
  write(`${question}\n`);
  choices.forEach((choice, index) => {
    write(`  ${index + 1}) ${choice.padEnd(10)} ${descriptions[choice]}\n`);
  });
  for (;;) {
    const answer = (await rl.question(`Choose 1-${choices.length} [${fallback}]: `)).trim();
    if (answer === '') return fallback;
    const byNumber = choices[Number(answer) - 1];
    if (/^\d+$/.test(answer) && byNumber) return byNumber;
    if (choices.includes(answer)) return answer;
    write(`  "${answer}" is not one of: ${choices.join(', ')}\n`);
  }
};

/**
 * Runs the CLI.
 *
 * @param {string[]} [argv] - Arguments without the executable, e.g. `['my-app', '--yes']`.
 * @param {object} [io] - Streams and environment, injectable for tests.
 * @param {NodeJS.ReadableStream & { isTTY?: boolean }} [io.stdin]
 * @param {NodeJS.WritableStream & { isTTY?: boolean }} [io.stdout]
 * @param {NodeJS.WritableStream} [io.stderr]
 * @param {Record<string, string | undefined>} [io.env]
 * @param {string} [io.cwd]
 * @returns {Promise<number>} The process exit code.
 */
export async function run(argv = process.argv.slice(2), io = {}) {
  const {
    stdin = process.stdin,
    stdout = process.stdout,
    stderr = process.stderr,
    env = process.env,
    cwd = process.cwd(),
  } = io;
  const write = (text) => stdout.write(text);
  const style = createStyle(stdout, env);
  const fail = (message) => {
    stderr.write(`${style.red('error')} ${message}\n`);
    return 1;
  };

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        template: { type: 'string', short: 't' },
        runtime: { type: 'string', short: 'r' },
        pm: { type: 'string' },
        name: { type: 'string' },
        yes: { type: 'boolean', short: 'y' },
        force: { type: 'boolean', short: 'f' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    return fail(`${error.message}\n\n${USAGE}`);
  }
  const { values, positionals } = parsed;

  if (values.help) {
    write(`${USAGE}\n`);
    return 0;
  }
  if (values.version) {
    write(`${packageVersion()} (templates for @bquery/bquery ${BQUERY_VERSION})\n`);
    return 0;
  }
  if (positionals.length > 1) {
    return fail(`Expected at most one directory, got: ${positionals.join(' ')}`);
  }
  if (values.template !== undefined && !TEMPLATES.includes(values.template)) {
    return fail(`Unknown template "${values.template}". Choose one of: ${TEMPLATES.join(', ')}.`);
  }
  if (values.runtime !== undefined && !RUNTIMES.includes(values.runtime)) {
    return fail(`Unknown runtime "${values.runtime}". Choose one of: ${RUNTIMES.join(', ')}.`);
  }
  if (values.pm !== undefined && !PACKAGE_MANAGERS.includes(values.pm)) {
    return fail(
      `Unknown package manager "${values.pm}". Choose one of: ${PACKAGE_MANAGERS.join(', ')}.`
    );
  }

  const interactive = !values.yes && Boolean(stdin.isTTY);
  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : undefined;

  try {
    let dir = positionals[0];
    if (dir === undefined) {
      dir = rl
        ? (await rl.question(`Project directory [${DEFAULT_DIR}]: `)).trim() || DEFAULT_DIR
        : DEFAULT_DIR;
    }
    const targetDir = resolve(cwd, dir);

    const template =
      values.template ??
      (rl
        ? await choose(
            rl,
            write,
            'Which template?',
            TEMPLATES,
            TEMPLATE_DESCRIPTIONS,
            DEFAULT_TEMPLATE
          )
        : DEFAULT_TEMPLATE);

    let runtime = values.runtime ?? DEFAULT_RUNTIME;
    if (template === 'ssr' && values.runtime === undefined && rl) {
      runtime = await choose(
        rl,
        write,
        'Which server runtime?',
        RUNTIMES,
        RUNTIME_DESCRIPTIONS,
        DEFAULT_RUNTIME
      );
    }
    if (template !== 'ssr' && values.runtime !== undefined) {
      write(
        style.dim(
          `Note: --runtime only applies to the ssr template; ignoring "${values.runtime}".\n`
        )
      );
    }

    let projectName = values.name ?? basename(targetDir);
    let check = validateProjectName(projectName);
    while (!check.valid && rl && values.name === undefined) {
      write(`"${projectName}" is not a valid package name: ${check.problems.join('; ')}.\n`);
      const suggestion = toValidProjectName(projectName);
      projectName = (await rl.question(`Package name [${suggestion}]: `)).trim() || suggestion;
      check = validateProjectName(projectName);
    }
    if (!check.valid) {
      return fail(
        `Invalid project name "${projectName}": ${check.problems.join('; ')}.\n` +
          `Pass a valid one with --name, e.g. --name ${toValidProjectName(projectName)}`
      );
    }

    let force = Boolean(values.force);
    if (!force && !isEmptyDir(targetDir)) {
      if (!rl) {
        return fail(
          `Target directory "${dir}" is not empty. Choose another directory or pass --force to write into it.`
        );
      }
      const answer = await rl.question(
        `Directory "${dir}" is not empty. Write into it and overwrite files with the same name? [y/N]: `
      );
      if (!/^y(es)?$/i.test(answer.trim())) {
        write('Cancelled.\n');
        return 1;
      }
      force = true;
    }

    const result = await scaffold({ targetDir, template, runtime, projectName, force });

    const packageManager = values.pm ?? detectPackageManager(env.npm_config_user_agent);
    const commands = projectCommands({ template, runtime, packageManager });
    const shownDir = relative(cwd, targetDir) || '.';
    const label = template === 'ssr' ? `${template} (${runtime})` : template;

    write(
      `\n${style.bold('Created')} ${style.cyan(result.projectName)} from the ${style.bold(label)} template in ${shownDir}.\n\nNext steps:\n`
    );
    if (shownDir !== '.') write(`  cd ${shellQuote(shownDir)}\n`);
    write(`  ${commands.install}\n  ${commands.dev}\n\nRun the tests:\n  ${commands.test}\n`);
    return 0;
  } catch (error) {
    if (error instanceof ScaffoldError) return fail(error.message);
    throw error;
  } finally {
    rl?.close();
  }
}

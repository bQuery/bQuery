/**
 * Programmatic API of `create-bquery`.
 *
 * The CLI (`bin/create-bquery.js`) is a thin wrapper around `scaffold()`; the
 * tests drive the same function. Only `node:` built-ins are used so that
 * `npm create bquery@latest` installs nothing besides this package.
 *
 * @module create-bquery
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BQUERY_RANGE, BQUERY_VERSION, DEV_DEPENDENCY_RANGES } from './versions.js';

export { BQUERY_RANGE, BQUERY_VERSION, DEV_DEPENDENCY_RANGES } from './versions.js';

/** Project templates, in the order the CLI offers them. */
export const TEMPLATES = Object.freeze(['cdn', 'spa', 'ssr', 'fullstack']);

/** Server runtimes the `ssr` template can target. */
export const RUNTIMES = Object.freeze(['node', 'bun', 'deno']);

/** Package managers the printed next steps can be written for. */
export const PACKAGE_MANAGERS = Object.freeze(['npm', 'bun', 'pnpm', 'yarn']);

/** Template used when none is given and no prompt is shown. */
export const DEFAULT_TEMPLATE = 'spa';

/** Runtime used for the `ssr` template when none is given and no prompt is shown. */
export const DEFAULT_RUNTIME = 'node';

/** One-line descriptions shown by the CLI prompt and `--help`. */
export const TEMPLATE_DESCRIPTIONS = Object.freeze({
  cdn: 'Zero-build page: one HTML file, bQuery from a CDN, no toolchain',
  spa: 'Single-page app with router, store and view (Vite + TypeScript)',
  ssr: 'Server-rendered app on Node, Bun or Deno',
  fullstack: 'Server + forms + SSR with hydration (Bun)',
});

/** One-line descriptions of the `ssr` runtimes. */
export const RUNTIME_DESCRIPTIONS = Object.freeze({
  node: 'Node.js >= 24 (runs TypeScript natively, node:http)',
  bun: 'Bun >= 1.4 (Bun.serve)',
  deno: 'Deno >= 2 (Deno.serve, deno.json tasks)',
});

const TEMPLATES_DIR = fileURLToPath(new URL('../templates/', import.meta.url));

/** Files whose published name differs from their name in the project. */
const RENAMES = Object.freeze({
  // npm drops `.gitignore` from published packages (and would apply it as an
  // ignore file to the template folder), so it is stored without the dot.
  _gitignore: '.gitignore',
  // A real `package.json` inside the published package would make tools treat
  // each template folder as a package of its own.
  '_package.json': 'package.json',
});

/**
 * Error thrown by `scaffold()` for invalid input. `code` identifies the
 * problem so callers can react without parsing the message.
 */
export class ScaffoldError extends Error {
  /**
   * @param {string} message - Human-readable explanation.
   * @param {'INVALID_TEMPLATE' | 'INVALID_RUNTIME' | 'INVALID_NAME' | 'DIR_NOT_EMPTY' | 'NOT_A_DIRECTORY' | 'MISSING_TARGET'} code - Machine-readable reason.
   */
  constructor(message, code) {
    super(message);
    this.name = 'ScaffoldError';
    this.code = code;
  }
}

/**
 * Checks a project name against npm's package-name rules.
 *
 * @param {string} name - The candidate package name.
 * @returns {{ valid: boolean, problems: string[] }} `valid` plus every rule the name breaks.
 */
export function validateProjectName(name) {
  const problems = [];
  if (typeof name !== 'string' || name.length === 0) {
    return { valid: false, problems: ['name must be a non-empty string'] };
  }
  if (name.length > 214) problems.push('name can be at most 214 characters long');
  if (name.trim() !== name) problems.push('name cannot contain leading or trailing spaces');
  if (name.startsWith('.')) problems.push('name cannot start with a period');
  if (name.startsWith('_')) problems.push('name cannot start with an underscore');
  if (name.toLowerCase() !== name) problems.push('name can only contain lowercase letters');
  if (['node_modules', 'favicon.ico'].includes(name.toLowerCase())) {
    problems.push(`"${name}" is not a valid package name`);
  }
  if (builtinModules.includes(name)) problems.push(`"${name}" is a Node.js core module name`);

  const scoped = /^@([^/]+)\/([^/]+)$/.exec(name);
  const parts = scoped ? [scoped[1], scoped[2]] : [name];
  const last = parts[parts.length - 1];
  if (/[~'!()*]/.test(last)) {
    problems.push('name cannot contain special characters ("~\'!()*")');
  }
  if (parts.some((part) => encodeURIComponent(part) !== part)) {
    problems.push(
      'name can only contain URL-friendly characters (a-z, 0-9, "-", ".", "_" and one "@scope/")'
    );
  }
  return { valid: problems.length === 0, problems };
}

/**
 * Turns an arbitrary string (usually a directory name) into a valid package name.
 *
 * @param {string} name - The input, e.g. `"My App"`.
 * @returns {string} A name that passes `validateProjectName()`, e.g. `"my-app"`.
 */
export function toValidProjectName(name) {
  const candidate = String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]+/, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-._]+|-+$/g, '');
  if (!candidate || !validateProjectName(candidate).valid) return 'bquery-app';
  return candidate;
}

/**
 * Detects the package manager that launched the process from the
 * `npm_config_user_agent` variable npm, pnpm, Yarn and Bun set.
 *
 * @param {string | undefined} [userAgent] - Defaults to `process.env.npm_config_user_agent`.
 * @returns {'npm' | 'bun' | 'pnpm' | 'yarn'} The detected manager, `npm` when unknown.
 */
export function detectPackageManager(userAgent = process.env.npm_config_user_agent) {
  const name = (userAgent ?? '').split(' ')[0].split('/')[0];
  return PACKAGE_MANAGERS.includes(name) ? name : 'npm';
}

/**
 * Whether a directory is missing or holds nothing but a `.git` folder.
 *
 * @param {string} dir - The directory to inspect.
 * @returns {boolean} `true` when scaffolding into it cannot overwrite anything.
 */
export function isEmptyDir(dir) {
  if (!existsSync(dir)) return true;
  if (!statSync(dir).isDirectory()) return false;
  return readdirSync(dir).every((entry) => entry === '.git');
}

/**
 * Commands that install, start and test a scaffolded project.
 *
 * @param {{ template: string, runtime?: string, packageManager?: string }} options - The
 *   scaffolded template, its runtime (for `ssr`) and the package manager to write commands for.
 * @returns {{ install: string, dev: string, test: string }} Shell commands, relative to the project.
 */
export function projectCommands({ template, runtime = DEFAULT_RUNTIME, packageManager = 'npm' }) {
  if (template === 'ssr' && runtime === 'deno') {
    return { install: 'deno install', dev: 'deno task dev', test: 'deno task test' };
  }
  const pm = PACKAGE_MANAGERS.includes(packageManager) ? packageManager : 'npm';
  const script = (name) => {
    if (pm === 'npm')
      return name === 'test' || name === 'start' ? `npm ${name}` : `npm run ${name}`;
    if (pm === 'bun') return `bun run ${name}`;
    return `${pm} ${name}`;
  };
  return {
    install: `${pm} install`,
    dev: script(template === 'cdn' ? 'start' : 'dev'),
    test: script('test'),
  };
}

/** The template folders that make up a project, later ones overriding earlier ones. */
const templateLayers = (template, runtime) =>
  template === 'ssr' ? ['ssr', `ssr-${runtime}`] : [template];

/** Maps a file name in `templates/` to its name in the project. */
const projectFileName = (name) => RENAMES[name] ?? name.replace(/\.tpl(\.[^.]+)$/, '$1');

/** Lists every file below `dir` as paths relative to it. */
const listFiles = async (dir, prefix = '') => {
  const files = [];
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const path = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(dir, path)));
    else files.push(path);
  }
  return files;
};

/** Replaces `{{token}}` placeholders; an unknown token is a template bug. */
const render = (content, tokens, file) =>
  content.replace(/\{\{(\w+)\}\}/g, (match, token) => {
    if (!Object.hasOwn(tokens, token)) {
      throw new Error(`create-bquery: unknown placeholder ${match} in template file ${file}`);
    }
    return tokens[token];
  });

/**
 * Writes a new bQuery project.
 *
 * @param {object} options - What to scaffold and where.
 * @param {string} options.targetDir - Directory to create the project in (created when missing).
 * @param {'cdn' | 'spa' | 'ssr' | 'fullstack'} [options.template='spa'] - Project template.
 * @param {'node' | 'bun' | 'deno'} [options.runtime='node'] - Server runtime; only used by `ssr`.
 * @param {string} [options.projectName] - Package name; defaults to the directory's name.
 * @param {boolean} [options.force=false] - Write into a non-empty directory, overwriting files
 *   with the same name (other files are kept).
 * @returns {Promise<{ targetDir: string, projectName: string, template: string, runtime: string | undefined, files: string[] }>}
 *   The absolute project directory and the files written (POSIX paths, sorted).
 * @throws {ScaffoldError} On an invalid template, runtime or name, or a non-empty directory.
 */
export async function scaffold(options) {
  const {
    targetDir,
    template = DEFAULT_TEMPLATE,
    runtime = DEFAULT_RUNTIME,
    force = false,
  } = options ?? {};
  if (typeof targetDir !== 'string' || targetDir.length === 0) {
    throw new ScaffoldError('scaffold(): `targetDir` is required.', 'MISSING_TARGET');
  }
  if (!TEMPLATES.includes(template)) {
    throw new ScaffoldError(
      `Unknown template "${template}". Choose one of: ${TEMPLATES.join(', ')}.`,
      'INVALID_TEMPLATE'
    );
  }
  if (!RUNTIMES.includes(runtime)) {
    throw new ScaffoldError(
      `Unknown runtime "${runtime}". Choose one of: ${RUNTIMES.join(', ')}.`,
      'INVALID_RUNTIME'
    );
  }

  const root = resolve(targetDir);
  const projectName = options.projectName ?? basename(root);
  const { valid, problems } = validateProjectName(projectName);
  if (!valid) {
    throw new ScaffoldError(
      `Invalid project name "${projectName}": ${problems.join('; ')}.`,
      'INVALID_NAME'
    );
  }
  if (existsSync(root) && !statSync(root).isDirectory()) {
    throw new ScaffoldError(`"${root}" exists and is not a directory.`, 'NOT_A_DIRECTORY');
  }
  if (!force && !isEmptyDir(root)) {
    throw new ScaffoldError(
      `Target directory "${root}" is not empty. Choose another directory or pass --force to write into it.`,
      'DIR_NOT_EMPTY'
    );
  }

  const tokens = {
    projectName,
    bqueryVersion: BQUERY_VERSION,
    bqueryRange: BQUERY_RANGE,
    happyDomRange: DEV_DEPENDENCY_RANGES['happy-dom'],
    typesNodeRange: DEV_DEPENDENCY_RANGES['@types/node'],
    typescriptRange: DEV_DEPENDENCY_RANGES.typescript,
    viteRange: DEV_DEPENDENCY_RANGES.vite,
  };

  /** @type {Map<string, string>} project path → template source path */
  const sources = new Map();
  for (const layer of templateLayers(template, runtime)) {
    const layerDir = join(TEMPLATES_DIR, layer);
    for (const file of await listFiles(layerDir)) {
      const segments = file.split(sep);
      segments[segments.length - 1] = projectFileName(segments[segments.length - 1]);
      sources.set(segments.join('/'), join(layerDir, file));
    }
  }

  for (const [file, source] of sources) {
    const destination = join(root, ...file.split('/'));
    await mkdir(dirname(destination), { recursive: true });
    const content = render(await readFile(source, 'utf8'), tokens, relative(TEMPLATES_DIR, source));
    await writeFile(destination, content);
  }

  return {
    targetDir: root,
    projectName,
    template,
    runtime: template === 'ssr' ? runtime : undefined,
    files: [...sources.keys()].sort(),
  };
}

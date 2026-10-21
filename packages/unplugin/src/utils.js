/**
 * Small, dependency-free helpers shared by the plugin features.
 *
 * @module @bquery/unplugin/utils
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/** Directories never walked when scanning a project. */
const ALWAYS_SKIPPED_DIRS = new Set(['node_modules', '.git']);

/**
 * Converts a path to forward slashes (Windows-safe ids and manifest keys).
 *
 * @param {string} value - A filesystem path.
 * @returns {string} The same path using `/` separators.
 */
export const toPosix = (value) => value.split(path.sep).join('/').replace(/\\/g, '/');

/**
 * Strips a `?query` / `#hash` suffix from a module id.
 *
 * @param {string} id - A module id.
 * @returns {string} The id without query or hash.
 */
export const cleanId = (id) => id.replace(/[?#].*$/s, '');

/**
 * Returns the query part (without `?`) of a module id, or `''`.
 *
 * @param {string} id - A module id.
 * @returns {string} The raw query string.
 */
export const queryOf = (id) => {
  const index = id.indexOf('?');
  return index === -1 ? '' : id.slice(index + 1).replace(/#.*$/s, '');
};

/**
 * Whether a module id carries the given query flag (`?flag` or `&flag`).
 *
 * @param {string} id - A module id.
 * @param {string} flag - The flag name.
 * @returns {boolean} Whether the flag is present.
 */
export const hasQueryFlag = (id, flag) =>
  queryOf(id)
    .split('&')
    .some((part) => part === flag || part.startsWith(`${flag}=`));

/**
 * Expands `{a,b}` alternations in a glob into separate globs.
 *
 * @param {string} glob - A glob pattern.
 * @returns {string[]} The expanded globs.
 */
const expandBraces = (glob) => {
  const match = /\{([^{}]*)\}/.exec(glob);
  if (!match) return [glob];
  const head = glob.slice(0, match.index);
  const tail = glob.slice(match.index + match[0].length);
  return match[1].split(',').flatMap((option) => expandBraces(`${head}${option}${tail}`));
};

/**
 * Converts a `**` / `*` / `?` / `{a,b}` glob to a `RegExp` matched against a
 * root-relative, `/`-separated path. `**` matches across directories; `*` and
 * `?` do not.
 *
 * @param {string} glob - A glob pattern.
 * @returns {RegExp} An anchored regular expression.
 */
export const globToRegExp = (glob) => {
  const sources = expandBraces(glob.replace(/^\.\//, '')).map((single) => {
    let re = '';
    for (let i = 0; i < single.length; i += 1) {
      const ch = single[i];
      if (ch === '*') {
        if (single[i + 1] === '*') {
          i += 1;
          if (single[i + 1] === '/') {
            i += 1;
            re += '(?:.*/)?';
          } else {
            re += '.*';
          }
        } else {
          re += '[^/]*';
        }
      } else if (ch === '?') {
        re += '[^/]';
      } else {
        re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      }
    }
    return re;
  });
  return new RegExp(`^(?:${sources.join('|')})$`);
};

/**
 * Builds a predicate from include/exclude patterns. Patterns may be globs
 * (matched against the root-relative path), `RegExp`s (matched against the
 * absolute, `/`-separated path) or functions receiving the absolute path.
 *
 * @param {string} root - Project root used to relativise paths for globs.
 * @param {unknown} include - Pattern(s) a file must match.
 * @param {unknown} [exclude] - Pattern(s) that reject a file.
 * @returns {(file: string) => boolean} The filter.
 */
export const createFilter = (root, include, exclude) => {
  const compile = (patterns) =>
    (Array.isArray(patterns) ? patterns : patterns == null ? [] : [patterns]).map((pattern) => {
      if (typeof pattern === 'function') return (abs) => Boolean(pattern(abs));
      if (pattern instanceof RegExp) {
        return (abs) => {
          pattern.lastIndex = 0;
          return pattern.test(abs);
        };
      }
      const re = globToRegExp(String(pattern));
      return (abs, rel) => re.test(rel);
    });
  const includes = compile(include);
  const excludes = compile(exclude);
  return (file) => {
    const abs = toPosix(path.resolve(root, cleanId(file)));
    const rel = toPosix(path.relative(root, abs));
    if (excludes.some((test) => test(abs, rel))) return false;
    return includes.some((test) => test(abs, rel));
  };
};

/**
 * Recursively lists files under `dir` (absolute paths), skipping
 * `node_modules` / `.git` and anything `skipDir` rejects.
 *
 * @param {string} dir - Directory to walk.
 * @param {(dir: string) => boolean} [skipDir] - Extra directory filter.
 * @returns {Promise<string[]>} Sorted absolute file paths.
 */
export const walkFiles = async (dir, skipDir = () => false) => {
  const out = [];
  const visit = async (current) => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (ALWAYS_SKIPPED_DIRS.has(entry.name) || skipDir(full)) continue;
        await visit(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  };
  await visit(dir);
  return out.sort();
};

/**
 * Reads a UTF-8 file, returning `undefined` when it does not exist.
 *
 * @param {string} file - Absolute path.
 * @returns {Promise<string | undefined>} The contents.
 */
export const readTextIfExists = async (file) => {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
};

/**
 * Writes `content` to `file` only when it differs from what is on disk, so
 * file watchers (and the bundler itself) are not woken by no-op writes.
 *
 * @param {string} file - Absolute path.
 * @param {string} content - New contents.
 * @returns {Promise<boolean>} Whether the file was written.
 */
export const writeIfChanged = async (file, content) => {
  const current = await readTextIfExists(file);
  if (current === content) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, 'utf8');
  return true;
};

/**
 * Normalises a feature option: `false`/`undefined` disables it (unless
 * `defaultOn`), `true` enables it with defaults, objects are passed through.
 *
 * @template T
 * @param {false | true | T | undefined} value - The raw option.
 * @param {boolean} defaultOn - Whether the feature is enabled when omitted.
 * @returns {T | {} | null} The options object, or `null` when disabled.
 */
export const featureOptions = (value, defaultOn) => {
  if (value === false) return null;
  if (value === undefined || value === null) return defaultOn ? {} : null;
  if (value === true) return {};
  return value;
};

/**
 * Emits a warning through the bundler context when it supports `warn()`
 * (Rollup, Vite, webpack), otherwise through `console.warn` (esbuild's
 * `buildStart` context has no `warn`).
 *
 * @param {{ warn?: (msg: string) => void } | undefined} context - Hook context.
 * @param {string} message - Warning text.
 */
export const warnVia = (context, message) => {
  if (typeof context?.warn === 'function') context.warn(message);
  else console.warn(message);
};

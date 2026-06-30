/**
 * Build-tool-agnostic CLI for message extraction.
 *
 * Thin glue around {@link extractFromSource} and {@link mergeCatalog}: it reads
 * source files, extracts translatable messages, merges them into an existing
 * catalog (preserving translations), and writes JSON. It is dependency-free and
 * meant to be wired into an existing build or run ad-hoc — not to become a build
 * tool of its own.
 *
 * Node's `fs`/`path` are imported lazily so the extract barrel stays
 * environment-neutral; only the CLI functions touch the filesystem.
 *
 * @module bquery/i18n
 */

import { extractFromSource, type ExtractedCatalog, type ExtractedMessage } from './extract';
import { mergeCatalog, type MergeResult } from './merge';

/** Minimal console-shaped sink so the CLI is testable without globals. */
export type CliIO = { log: (msg: string) => void; error: (msg: string) => void };

/**
 * Converts a `*` / `**` / `?` glob into a `RegExp`. `**` matches across
 * directory separators; `*` and `?` do not.
 */
const globToRegExp = (glob: string): RegExp => {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 1;
        if (glob[i + 1] === '/') i += 1;
      } else {
        re += '[^/]*';
      }
    } else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
};

/** The non-glob prefix of a pattern, used as the directory walk root. */
const globBase = (glob: string): string => {
  const firstMagic = glob.search(/[*?]/);
  const head = firstMagic === -1 ? glob : glob.slice(0, firstMagic);
  const slash = head.lastIndexOf('/');
  return slash === -1 ? '.' : head.slice(0, slash) || '.';
};

/**
 * Expands glob patterns to a sorted, de-duplicated list of files. Plain paths
 * (already expanded by the shell, or with no magic characters) pass through.
 */
export const expandGlobs = async (patterns: string[]): Promise<string[]> => {
  const { readdir, stat, realpath } = await import('node:fs/promises');
  const path = await import('node:path');
  const found = new Set<string>();
  // Canonical directory paths already walked, so a symlink cycle (e.g. a link
  // pointing at an ancestor) cannot drive `walk` into infinite recursion.
  const visited = new Set<string>();

  const walk = async (dir: string, matcher: RegExp): Promise<void> => {
    let canonical: string;
    try {
      canonical = await realpath(dir);
    } catch {
      return;
    }
    if (visited.has(canonical)) return;
    visited.add(canonical);

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry).split(path.sep).join('/');
      let isDir = false;
      try {
        isDir = (await stat(full)).isDirectory();
      } catch {
        continue;
      }
      if (isDir) await walk(full, matcher);
      else if (matcher.test(full)) found.add(full);
    }
  };

  for (const pattern of patterns) {
    const normalized = pattern.split(path.sep).join('/');
    if (!/[*?]/.test(normalized)) {
      found.add(normalized);
      continue;
    }
    const base = globBase(normalized);
    const matcher = globToRegExp(normalized.replace(/^\.\//, ''));
    await walk(base, matcher);
  }

  return [...found].sort();
};

/** Options controlling an extraction run. */
export type ExtractRunOptions = {
  /** Output catalog path. When omitted, the catalog is returned, not written. */
  out?: string;
  /** Drop keys no longer present in source (default: keep them). */
  prune?: boolean;
};

/** Result of {@link extractFiles}. */
export type ExtractFilesResult = MergeResult & {
  /** Number of source files scanned. */
  files: number;
  /** Number of distinct keys extracted from the scanned sources (added + kept). */
  total: number;
};

const readJsonCatalog = async (file: string): Promise<ExtractedCatalog> => {
  const { readFile } = await import('node:fs/promises');
  try {
    const text = await readFile(file, 'utf8');
    return JSON.parse(text) as ExtractedCatalog;
  } catch {
    return {};
  }
};

/**
 * Extracts messages from `files`, merges into the catalog at `options.out`
 * (when given), and writes the result.
 *
 * @example
 * ```ts
 * import { extractFiles } from '@bquery/bquery/i18n/extract';
 *
 * await extractFiles(['src/cart.ts'], { out: 'locales/en.json' });
 * ```
 */
export const extractFiles = async (
  files: string[],
  options: ExtractRunOptions = {}
): Promise<ExtractFilesResult> => {
  const { readFile, writeFile, mkdir } = await import('node:fs/promises');
  const path = await import('node:path');

  const messages = new Map<string, string>();
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const { key, value } of extractFromSource(source)) {
      const prior = messages.get(key);
      if (prior === undefined || (prior === '' && value !== '')) messages.set(key, value);
    }
  }

  const extracted: ExtractedMessage[] = [...messages.entries()].map(([key, value]) => ({
    key,
    value,
  }));

  const existing = options.out ? await readJsonCatalog(options.out) : {};
  const merged = mergeCatalog(existing, extracted, { prune: options.prune });

  if (options.out) {
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, `${JSON.stringify(merged.catalog, null, 2)}\n`, 'utf8');
  }

  return { ...merged, files: files.length, total: extracted.length };
};

const USAGE = `Usage: bquery-i18n extract [options] <glob...>
  --out <file>   merge into and write this catalog (JSON)
  --prune        drop keys no longer present in source
  -h, --help     show this help`;

/**
 * Parses argv and runs an extraction. Returns a process exit code
 * (`0` success, `1` usage error / failure).
 *
 * Usage: `bquery-i18n extract [options] <glob...>`
 */
export const runExtractCli = async (
  argv: string[],
  io: CliIO = { log: (m) => console.log(m), error: (m) => console.error(m) }
): Promise<number> => {
  const args = argv[0] === 'extract' ? argv.slice(1) : argv;
  const patterns: string[] = [];
  const options: ExtractRunOptions = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--out':
        options.out = args[++i];
        break;
      case '--prune':
        options.prune = true;
        break;
      case '-h':
      case '--help':
        io.log(USAGE);
        return 0;
      default:
        if (arg.startsWith('-')) {
          io.error(`Unknown option: ${arg}`);
          return 1;
        }
        patterns.push(arg);
    }
  }

  if (patterns.length === 0) {
    io.error(`No input patterns.\n${USAGE}`);
    return 1;
  }

  try {
    const files = await expandGlobs(patterns);
    if (files.length === 0) {
      io.error('No files matched the given patterns.');
      return 1;
    }
    const result = await extractFiles(files, options);
    const target = options.out ?? '(stdout — pass --out to write)';
    io.log(
      `Scanned ${result.files} file(s) → ${result.total} key(s): ` +
        `${result.added.length} new, ${result.kept} kept` +
        (options.prune ? `, ${result.removed.length} pruned` : '')
    );
    if (!options.out) io.log(JSON.stringify(result.catalog, null, 2));
    else io.log(`Wrote ${target}`);
    return 0;
  } catch (error) {
    io.error(`i18n extract failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};

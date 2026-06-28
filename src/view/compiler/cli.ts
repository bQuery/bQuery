/**
 * Build-tool-agnostic CLI for the optional view compiler.
 *
 * This is thin glue around {@link compileToModule}: it reads template files,
 * emits the precompiled-expression module beside them (or into `--out-dir`),
 * and prints a coverage summary. It is dependency-free — pass explicit file
 * paths (let your shell expand globs) — and is meant to be wired into an
 * existing build, not to become a build tool of its own.
 *
 * Node's `fs`/`path` are imported lazily so the compiler barrel stays
 * environment-neutral; only the CLI functions touch the filesystem.
 *
 * @module bquery/view/compiler
 */

import { compileToModule, type EmitOptions } from './emit';
import type { CompileStats } from './types';

/** Options controlling where compiled modules are written. */
export type CompileFilesOptions = EmitOptions & {
  /** Directory to write outputs into. Defaults to alongside each input file. */
  outDir?: string;
  /** Suffix appended before the output extension. Default: `'.bq-compiled'`. */
  suffix?: string;
  /** Output file extension. Default: `'.js'`. */
  ext?: string;
};

/** Per-file compilation result. */
export type CompiledFileResult = {
  input: string;
  output: string;
  stats: CompileStats;
};

/**
 * Compiles a list of template files to precompiled-expression modules.
 *
 * @example
 * ```ts
 * import { compileFiles } from '@bquery/bquery/view/compiler';
 *
 * await compileFiles(['src/views/home.html'], { outDir: 'src/views/.compiled' });
 * ```
 */
export const compileFiles = async (
  files: string[],
  options: CompileFilesOptions = {}
): Promise<CompiledFileResult[]> => {
  const { readFile, writeFile, mkdir } = await import('node:fs/promises');
  const path = await import('node:path');

  const suffix = options.suffix ?? '.bq-compiled';
  const ext = options.ext ?? '.js';
  const results: CompiledFileResult[] = [];

  for (const input of files) {
    const source = await readFile(input, 'utf8');
    const { code, stats } = compileToModule(source, options);

    const base = path.basename(input, path.extname(input));
    const dir = options.outDir ?? path.dirname(input);
    const output = path.join(dir, `${base}${suffix}${ext}`);

    await mkdir(dir, { recursive: true });
    await writeFile(output, code, 'utf8');

    results.push({ input, output, stats });
  }

  return results;
};

/** Minimal console-shaped sink so the CLI is testable without globals. */
export type CliIO = { log: (msg: string) => void; error: (msg: string) => void };

/**
 * Parses argv and runs {@link compileFiles}. Returns a process exit code
 * (`0` success, `1` usage error / failure).
 *
 * Usage: `bquery-view-compile [options] <file...>`
 *   --prefix <p>     directive prefix (default: bq)
 *   --out-dir <dir>  output directory (default: beside each input)
 *   --suffix <s>     output filename suffix (default: .bq-compiled)
 *   --ext <e>        output extension (default: .js)
 *   --import <spec>  import specifier (default: @bquery/bquery/view)
 */
export const runCompileCli = async (
  argv: string[],
  io: CliIO = { log: (m) => console.log(m), error: (m) => console.error(m) }
): Promise<number> => {
  const files: string[] = [];
  const options: CompileFilesOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--prefix':
        options.prefix = argv[++i];
        break;
      case '--out-dir':
        options.outDir = argv[++i];
        break;
      case '--suffix':
        options.suffix = argv[++i];
        break;
      case '--ext':
        options.ext = argv[++i];
        break;
      case '--import':
        options.importSpecifier = argv[++i];
        break;
      case '-h':
      case '--help':
        io.log('Usage: bquery-view-compile [options] <file...>');
        return 0;
      default:
        if (arg.startsWith('-')) {
          io.error(`Unknown option: ${arg}`);
          return 1;
        }
        files.push(arg);
    }
  }

  if (files.length === 0) {
    io.error('No input files. Usage: bquery-view-compile [options] <file...>');
    return 1;
  }

  try {
    const results = await compileFiles(files, options);
    for (const { input, output, stats } of results) {
      io.log(
        `${input} → ${output}  (${stats.compiled}/${stats.total} compiled, ` +
          `${stats.skipped.length} runtime fallback)`
      );
    }
    return 0;
  } catch (error) {
    io.error(`view compile failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};

/**
 * Command-line front end of `create-bquery`.
 *
 * @module create-bquery/cli
 */

/** Streams and environment `run()` uses; each defaults to the process's own. */
export interface CliIo {
  stdin?: NodeJS.ReadableStream & { isTTY?: boolean };
  stdout?: NodeJS.WritableStream & { isTTY?: boolean };
  stderr?: NodeJS.WritableStream;
  env?: Record<string, string | undefined>;
  cwd?: string;
}

/**
 * Runs the CLI with `argv` (arguments without the executable) and resolves
 * to the process exit code.
 */
export declare function run(argv?: string[], io?: CliIo): Promise<number>;

/**
 * Programmatic API of `create-bquery`. See `index.js` for the implementation.
 *
 * @module create-bquery
 */

export { BQUERY_RANGE, BQUERY_VERSION, DEV_DEPENDENCY_RANGES } from './versions.js';

/** A project template. */
export type Template = 'cdn' | 'spa' | 'ssr' | 'fullstack';

/** A server runtime for the `ssr` template. */
export type Runtime = 'node' | 'bun' | 'deno';

/** A package manager the printed commands can be written for. */
export type PackageManager = 'npm' | 'bun' | 'pnpm' | 'yarn';

/** Project templates, in the order the CLI offers them. */
export declare const TEMPLATES: readonly Template[];

/** Server runtimes the `ssr` template can target. */
export declare const RUNTIMES: readonly Runtime[];

/** Package managers the printed next steps can be written for. */
export declare const PACKAGE_MANAGERS: readonly PackageManager[];

/** Template used when none is given and no prompt is shown (`'spa'`). */
export declare const DEFAULT_TEMPLATE: Template;

/** Runtime used for the `ssr` template when none is given (`'node'`). */
export declare const DEFAULT_RUNTIME: Runtime;

/** One-line description of each template. */
export declare const TEMPLATE_DESCRIPTIONS: Readonly<Record<Template, string>>;

/** One-line description of each `ssr` runtime. */
export declare const RUNTIME_DESCRIPTIONS: Readonly<Record<Runtime, string>>;

/** Why `scaffold()` refused its input. */
export type ScaffoldErrorCode =
  | 'INVALID_TEMPLATE'
  | 'INVALID_RUNTIME'
  | 'INVALID_NAME'
  | 'DIR_NOT_EMPTY'
  | 'NOT_A_DIRECTORY'
  | 'MISSING_TARGET';

/** Error thrown by `scaffold()` for invalid input. */
export declare class ScaffoldError extends Error {
  constructor(message: string, code: ScaffoldErrorCode);
  readonly name: 'ScaffoldError';
  /** Machine-readable reason. */
  readonly code: ScaffoldErrorCode;
}

/** Options for `scaffold()`. */
export interface ScaffoldOptions {
  /** Directory to create the project in (created when missing). */
  targetDir: string;
  /** Project template. Default: `'spa'`. */
  template?: Template;
  /** Server runtime; only used by the `ssr` template. Default: `'node'`. */
  runtime?: Runtime;
  /** Package name. Default: the target directory's name. */
  projectName?: string;
  /**
   * Write into a non-empty directory, overwriting files with the same name.
   * Other files are kept. Default: `false`.
   */
  force?: boolean;
}

/** What `scaffold()` wrote. */
export interface ScaffoldResult {
  /** Absolute project directory. */
  targetDir: string;
  /** The package name written into the project. */
  projectName: string;
  template: Template;
  /** The server runtime for `ssr`, otherwise `undefined`. */
  runtime: Runtime | undefined;
  /** Files written, as POSIX paths relative to `targetDir`, sorted. */
  files: string[];
}

/**
 * Writes a new bQuery project.
 *
 * @throws {ScaffoldError} On an invalid template, runtime or name, or a non-empty directory.
 */
export declare function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult>;

/** Checks a project name against npm's package-name rules. */
export declare function validateProjectName(name: string): {
  valid: boolean;
  /** Every rule the name breaks. */
  problems: string[];
};

/** Turns an arbitrary string (usually a directory name) into a valid package name. */
export declare function toValidProjectName(name: string): string;

/**
 * Detects the package manager from `npm_config_user_agent`
 * (default: `process.env.npm_config_user_agent`); `'npm'` when unknown.
 */
export declare function detectPackageManager(userAgent?: string): PackageManager;

/** Whether a directory is missing or holds nothing but a `.git` folder. */
export declare function isEmptyDir(dir: string): boolean;

/** Commands that install, start and test a scaffolded project. */
export declare function projectCommands(options: {
  template: Template;
  runtime?: Runtime;
  packageManager?: PackageManager;
}): { install: string; dev: string; test: string };

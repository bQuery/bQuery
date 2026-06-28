/**
 * Optional, build-tool-agnostic compiler for the `view` module.
 *
 * `view` evaluates `bq-*` directive expressions at runtime — exactly right for
 * the zero-build CDN story. This **opt-in** compiler pre-parses those
 * expressions at build time and emits optimized, `with`-free update functions,
 * so build-using apps can skip the runtime evaluator (and its `'unsafe-eval'`
 * requirement) on the hot path. The runtime evaluator remains the default; the
 * compiled and runtime paths are behaviourally identical, and any expression
 * the compiler cannot statically handle transparently falls back to runtime.
 *
 * It is deliberately **not** a build tool of its own: `compileViews()` /
 * `compileToModule()` are small transforms usable from any bundler, and
 * `runCompileCli()` / `compileFiles()` provide a dependency-free CLI.
 *
 * @example
 * ```ts
 * import { compileToModule } from '@bquery/bquery/view/compiler';
 *
 * const { code } = compileToModule(templateHtml);
 * // write `code` to disk and import it once before mounting; the runtime then
 * // uses the precompiled functions automatically.
 * ```
 *
 * @module bquery/view/compiler
 */

export { compileExpression, DEFAULT_GLOBALS, DEFAULT_PARAM } from './expression';
export { compileViews } from './compile';
export { compileToModule, emitModule, DEFAULT_IMPORT_SPECIFIER, type EmitOptions } from './emit';
export {
  compileFiles,
  runCompileCli,
  type CliIO,
  type CompiledFileResult,
  type CompileFilesOptions,
} from './cli';
export type {
  CompiledExpression,
  CompiledView,
  CompileOptions,
  CompileStats,
  DirectiveExpression,
} from './types';

/**
 * Re-exported runtime hook so callers can register a precompiled map directly
 * (the emitted module imports the same function from `@bquery/bquery/view`).
 */
export { registerCompiledExpressions, clearCompiledExpressions } from '../evaluate';

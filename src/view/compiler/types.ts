/**
 * Public types for the optional view compiler.
 *
 * @module bquery/view/compiler
 */

/** Options shared by the expression and template compilers. */
export type CompileOptions = {
  /**
   * Directive prefix to compile (default `'bq'`), matching the `prefix` option
   * passed to `mount()`.
   */
  prefix?: string;
  /**
   * Additional global identifiers that should be left un-prefixed (i.e. resolved
   * from the JS global scope rather than the binding context). Extends the
   * built-in allow-list (`Math`, `JSON`, `Object`, …).
   */
  globals?: Iterable<string>;
};

/** Result of compiling a single directive expression. */
export type CompiledExpression =
  | {
      ok: true;
      /** The original expression source. */
      expression: string;
      /** Emitted function source, e.g. `($c) => ($c.count + 1)`. */
      code: string;
    }
  | {
      ok: false;
      /** The original expression source. */
      expression: string;
      /** Why the expression fell back to the runtime evaluator. */
      reason: string;
    };

/** A directive expression discovered while walking a template. */
export type DirectiveExpression = {
  /** The lowercased tag the directive was found on (for diagnostics). */
  tag: string;
  /** The directive head, e.g. `text`, `for`, `class`, `on`. */
  directive: string;
  /** The raw expression that reaches the runtime evaluator. */
  expression: string;
};

/** Aggregate statistics about a compiled template. */
export type CompileStats = {
  /** Total distinct expressions discovered. */
  total: number;
  /** How many compiled to ahead-of-time functions. */
  compiled: number;
  /** How many fell back to the runtime evaluator, with reasons. */
  skipped: Array<{ expression: string; reason: string }>;
};

/** Result of compiling a whole template. */
export type CompiledView = {
  /** Map of expression → emitted function source for the compiled subset. */
  expressions: Record<string, string>;
  /** Coverage statistics, including the runtime-fallback list. */
  stats: CompileStats;
};

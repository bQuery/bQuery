/**
 * Standard Schema interop.
 *
 * [Standard Schema](https://standardschema.dev) is the common interface that
 * Zod, Valibot, ArkType and others implement. Accepting it lets one schema drive
 * client validation (`createForm({ schema })`), server validation
 * (`validate(schema)` in `@bquery/bquery/server`) and the TypeScript types,
 * without bQuery depending on any validation library.
 *
 * The interface is copied from the spec, as the spec recommends, so there is
 * no runtime or type dependency.
 *
 * @module bquery/forms
 */

/** The Standard Schema v1 interface (https://standardschema.dev). */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

// The spec defines the helper types in a namespace merged with the interface,
// so `StandardSchemaV1.InferInput<S>` reads the same as in every validator.
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Validates unknown input values. */
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }

  /** The result interface of the validate function. */
  export type Result<Output> = SuccessResult<Output> | FailureResult;

  /** The result interface if validation succeeds. */
  export interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output;
    /** The non-existent issues. */
    readonly issues?: undefined;
  }

  /** The result interface if validation fails. */
  export interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>;
  }

  /** The issue interface of the failure output. */
  export interface Issue {
    /** The error message of the issue. */
    readonly message: string;
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  /** The path segment interface of the issue. */
  export interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey;
  }

  /** The Standard Schema types interface. */
  export interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }

  /** Infers the input type of a Standard Schema. */
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['input'];

  /** Infers the output type of a Standard Schema. */
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['output'];
}

/** A validation issue with its path flattened to plain keys. */
export interface SchemaIssue {
  /** Human-readable error message from the schema library. */
  message: string;
  /** Path to the offending value; empty for an issue about the whole input. */
  path: Array<string | number>;
}

/** Whether `value` implements Standard Schema v1. */
export const isStandardSchema = (value: unknown): value is StandardSchemaV1 => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false;
  const props = (value as { '~standard'?: unknown })['~standard'];
  return (
    typeof props === 'object' &&
    props !== null &&
    (props as { version?: unknown }).version === 1 &&
    typeof (props as { validate?: unknown }).validate === 'function'
  );
};

const toPathKey = (segment: PropertyKey | StandardSchemaV1.PathSegment): string | number => {
  const key = typeof segment === 'object' && segment !== null ? segment.key : segment;
  if (typeof key === 'number') return key;
  return typeof key === 'symbol' ? (key.description ?? key.toString()) : String(key);
};

/** Flatten Standard Schema issues into `{ message, path }` records with plain keys. */
export const normalizeSchemaIssues = (
  issues: ReadonlyArray<StandardSchemaV1.Issue>
): SchemaIssue[] =>
  issues.map((issue) => ({
    message: issue.message,
    path: (issue.path ?? []).map(toPathKey),
  }));

/** Result of {@link validateWithSchema}. */
export type SchemaValidationResult<Output> =
  | { success: true; value: Output; issues?: undefined }
  | { success: false; value?: undefined; issues: SchemaIssue[] };

/**
 * Validate `value` against any Standard Schema, awaiting async schemas.
 *
 * @example
 * ```ts
 * const result = await validateWithSchema(UserSchema, input);
 * if (!result.success) console.log(result.issues);
 * ```
 */
export const validateWithSchema = async <S extends StandardSchemaV1>(
  schema: S,
  value: unknown
): Promise<SchemaValidationResult<StandardSchemaV1.InferOutput<S>>> => {
  const result = await schema['~standard'].validate(value);
  if (result.issues) {
    return { success: false, issues: normalizeSchemaIssues(result.issues) };
  }
  return { success: true, value: result.value as StandardSchemaV1.InferOutput<S> };
};

/**
 * Map issues to field errors keyed by the first path segment, keeping the first
 * message per field. Issues without a path are returned under `''`.
 */
export const schemaIssuesToFieldErrors = (
  issues: ReadonlyArray<SchemaIssue>
): Record<string, string> => {
  // Null prototype: a `__proto__` path segment must not reach Object.prototype.
  const errors = Object.create(null) as Record<string, string>;
  for (const issue of issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : '';
    if (!(field in errors)) errors[field] = issue.message;
  }
  return errors;
};

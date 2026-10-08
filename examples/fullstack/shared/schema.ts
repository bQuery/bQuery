/**
 * Validation schemas shared by the browser and the server.
 *
 * They implement the Standard Schema interface (https://standardschema.dev),
 * so `createForm({ schema })` and the server's `validate()` both accept them.
 * A real app would write them with Zod, Valibot or ArkType — the call sites
 * stay the same. This tiny builder only exists to keep the example free of
 * dependencies.
 */

import type { StandardSchemaV1 } from '../../../src/forms/index';

type Issue = StandardSchemaV1.Issue;
type FieldCheck = (value: unknown) => string | undefined;

/** A string field: trimmed, with length limits and a message key per rule. */
export const text =
  (rules: { min?: number; max?: number; minMessage: string; maxMessage?: string }): FieldCheck =>
  (value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed.length < (rules.min ?? 0)) return rules.minMessage;
    if (rules.max !== undefined && trimmed.length > rules.max) {
      return rules.maxMessage ?? rules.minMessage;
    }
    return undefined;
  };

/** An object schema: every field check runs, each failure becomes an issue. */
export const object = <T extends Record<string, unknown>>(fields: {
  [K in keyof T]: FieldCheck;
}): StandardSchemaV1<T, T> => ({
  '~standard': {
    version: 1,
    vendor: 'bquery-example',
    validate(value) {
      if (typeof value !== 'object' || value === null) {
        return { issues: [{ message: 'validation.object' }] };
      }
      const input = value as Record<string, unknown>;
      const issues: Issue[] = [];
      const output: Record<string, unknown> = {};
      for (const [key, check] of Object.entries(fields) as Array<[string, FieldCheck]>) {
        const message = check(input[key]);
        if (message) issues.push({ message, path: [key] });
        output[key] = typeof input[key] === 'string' ? (input[key] as string).trim() : input[key];
      }
      return issues.length > 0 ? { issues } : { value: output as T };
    },
  },
});

/** Messages are i18n keys; each side translates them with its own catalog. */
export const NoteSchema = object<{ title: string; body: string }>({
  title: text({
    min: 1,
    max: 80,
    minMessage: 'validation.titleRequired',
    maxMessage: 'validation.titleTooLong',
  }),
  body: text({ min: 0, max: 2000, minMessage: 'validation.bodyTooLong' }),
});

export const LoginSchema = object<{ email: string; password: string }>({
  email: text({ min: 3, minMessage: 'validation.emailRequired' }),
  password: text({ min: 1, minMessage: 'validation.passwordRequired' }),
});

export type NoteInput = StandardSchemaV1.InferOutput<typeof NoteSchema>;

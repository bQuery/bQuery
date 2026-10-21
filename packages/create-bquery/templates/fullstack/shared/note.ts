/**
 * The note model and its validation rules. The browser form uses the rules as
 * `createForm()` validators and the API runs them through `validateNote()`, so
 * both sides report the same messages.
 */

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

// A type alias (not an interface) so it fits `createForm<T extends Record<…>>`.
export type NoteInput = { title: string; body: string };

export type NoteErrors = Partial<Record<keyof NoteInput, string>>;

/** A rule returns `true` when the value passes, or the error message. */
type Rule = (value: string) => string | true;

export const noteRules: Record<keyof NoteInput, Rule[]> = {
  title: [
    (value) => value.trim().length > 0 || 'Give the note a title.',
    (value) => value.trim().length <= 80 || 'Keep the title under 80 characters.',
  ],
  body: [(value) => value.trim().length <= 2000 || 'Keep the text under 2,000 characters.'],
};

/** Validates untrusted input, such as a request body, and trims the text. */
export const validateNote = (input: unknown): { value: NoteInput } | { errors: NoteErrors } => {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const value: NoteInput = { title: '', body: '' };
  const errors: NoteErrors = {};
  for (const field of ['title', 'body'] as const) {
    const raw = source[field] ?? '';
    if (typeof raw !== 'string') {
      errors[field] = 'Enter text.';
      continue;
    }
    value[field] = raw.trim();
    for (const rule of noteRules[field]) {
      const result = rule(value[field]);
      if (result !== true) {
        errors[field] = result;
        break;
      }
    }
  }
  return Object.keys(errors).length > 0 ? { errors } : { value };
};

/** "No notes yet", "1 note", "2 notes", … — rendered on the server and in the browser. */
export const countLabel = (count: number): string =>
  count === 0 ? 'No notes yet' : count === 1 ? '1 note' : `${count} notes`;

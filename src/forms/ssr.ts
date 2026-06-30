/**
 * SSR / hydration helpers for forms.
 *
 * @module bquery/forms
 */

import type { Form, FormSnapshot } from './types';
import { escapeForScript } from '../ssr/escape';

const FORM_STATE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const validateFormStateId = (id: string): string => {
  const value = String(id);
  if (!FORM_STATE_ID_PATTERN.test(value)) {
    throw new Error(
      'bQuery forms: form state id must contain only letters, numbers, underscores, or hyphens.'
    );
  }
  return value;
};

/**
 * `JSON.stringify` replacer that enforces the **guaranteed serialization
 * boundary** for SSR form state. Values that cannot survive a JSON round-trip
 * in a meaningful, hydration-safe form are deterministically dropped (the key
 * is omitted) rather than serialized as `null`, `{}`, or `"[object File]"`:
 *
 * - **functions** — not transferable; intentionally dropped.
 * - **`File` / `Blob` / `FileList`** — binary handles cannot cross the
 *   server→HTML→client boundary; dropped. Re-attach large blobs on the client
 *   after hydration.
 * - **`bigint`** — would throw in `JSON.stringify`; dropped for safety.
 * - **`symbol` / `undefined`** — already omitted by `JSON.stringify`; listed
 *   here for completeness.
 *
 * This makes the boundary an explicit, tested contract instead of an incidental
 * side effect of `JSON.stringify`.
 *
 * @internal
 */
const isNonSerializable = (value: unknown): boolean => {
  if (typeof value === 'function' || typeof value === 'bigint' || typeof value === 'symbol') {
    return true;
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof FileList !== 'undefined' && value instanceof FileList) return true;
  return false;
};

const stripNonSerializable = (_key: string, value: unknown): unknown => {
  if (isNonSerializable(value)) return undefined;
  // An array can't carry a hole, so a dropped element would serialize as
  // `null` and break the "dropped, never null" contract. Remove the offending
  // elements from the array instead; nested arrays are handled recursively as
  // the replacer revisits them.
  if (Array.isArray(value) && value.some(isNonSerializable)) {
    return value.filter((element) => !isNonSerializable(element));
  }
  return value;
};

/**
 * Serialize a form snapshot to an inline `<script>` tag suitable for embedding
 * in SSR-rendered HTML. The snapshot is embedded in a
 * `<script type="application/json" data-bq-form="<id>">` tag and can be read
 * on the client by {@link readSerializedFormState} and applied via
 * {@link Form.restore}.
 *
 * **Serialization boundary (guaranteed):** values that cannot cross the
 * server→HTML→client boundary as JSON are deterministically dropped — functions,
 * `File` / `Blob` / `FileList` handles, `bigint`, and `symbol`. This is a stable
 * contract, not an incidental `JSON.stringify` side effect: re-attach file
 * inputs and other non-serializable state on the client after hydration.
 *
 * @param id - Stable identifier for this form. Must contain only letters,
 * numbers, underscores, or hyphens.
 * @param snapshot - Snapshot returned by {@link Form.snapshot}
 * @returns A complete `<script>` tag string
 *
 * @example
 * ```ts
 * import { serializeFormState } from '@bquery/bquery/forms';
 *
 * const html = `
 *   <form id="register">...</form>
 *   ${serializeFormState('register', form.snapshot())}
 * `;
 * ```
 */
export const serializeFormState = <T extends Record<string, unknown>>(
  id: string,
  snapshot: FormSnapshot<T>
): string => {
  const safeId = validateFormStateId(id);
  const json = JSON.stringify(snapshot, stripNonSerializable);
  const payload = escapeForScript(json ?? '{}');
  return `<script type="application/json" data-bq-form="${safeId}">${payload}</script>`;
};

/**
 * Read a previously-serialized form snapshot from the DOM. Returns `undefined`
 * if no matching `<script data-bq-form="...">` is found.
 *
 * @param id - The id used when calling {@link serializeFormState}. Must contain
 * only letters, numbers, underscores, or hyphens.
 * @returns The decoded snapshot or `undefined`
 */
export const readSerializedFormState = <T extends Record<string, unknown>>(
  id: string
): FormSnapshot<T> | undefined => {
  if (typeof document === 'undefined') return undefined;
  const safeId = validateFormStateId(id);
  const node = document.querySelector<HTMLScriptElement>(`script[data-bq-form="${safeId}"]`);
  if (!node) return undefined;
  try {
    return JSON.parse(node.textContent ?? '') as FormSnapshot<T>;
  } catch {
    return undefined;
  }
};

/**
 * Convenience: hydrate a {@link Form} from a previously-serialized snapshot.
 * Returns `true` when state was applied.
 */
export const hydrateForm = <T extends Record<string, unknown>>(form: Form<T>, id: string): boolean => {
  const snapshot = readSerializedFormState<T>(id);
  if (!snapshot) return false;
  form.restore(snapshot);
  return true;
};

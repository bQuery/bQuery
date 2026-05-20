/**
 * SSR / hydration helpers for forms.
 *
 * @module bquery/forms
 */

import type { Form, FormSnapshot } from './types';
import { escapeForScript } from '../ssr/escape';

/**
 * Serialize a form snapshot to an inline `<script>` tag suitable for embedding
 * in SSR-rendered HTML. The script writes the payload to
 * `window.__BQUERY_FORMS__[id]` where it can be read on the client by
 * {@link readSerializedFormState} and applied via {@link Form.restore}.
 *
 * @param id - Stable identifier for this form
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
  const safeId = String(id).replace(/[^\w-]/g, '');
  const json = JSON.stringify(snapshot);
  const payload = escapeForScript(json);
  return `<script type="application/json" data-bq-form="${safeId}">${payload}</script>`;
};

/**
 * Read a previously-serialized form snapshot from the DOM. Returns `undefined`
 * if no matching `<script data-bq-form="...">` is found.
 *
 * @param id - The id used when calling {@link serializeFormState}
 * @returns The decoded snapshot or `undefined`
 */
export const readSerializedFormState = <T extends Record<string, unknown>>(
  id: string
): FormSnapshot<T> | undefined => {
  if (typeof document === 'undefined') return undefined;
  const safeId = String(id).replace(/[^\w-]/g, '');
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

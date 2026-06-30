/**
 * Progressive-enhancement form actions.
 *
 * Binds a `<form>` to a server action (an endpoint URL or a function). The form
 * posts natively when JavaScript is unavailable, and is progressively enhanced
 * to a `fetch`-based submit with reactive pending/error/result state — and
 * optional optimistic updates — when JS is present. Composes with the existing
 * validation pipeline and with the `server` module's `csrf()` middleware.
 *
 * @module bquery/forms
 */

import { readonly, signal } from '../reactive/index';
import type { ReadonlySignalHandle, Signal } from '../reactive/index';
import type { OptimisticHandle } from './optimistic';

/** Context passed to a function-style action target and available to hooks. */
export interface FormActionContext {
  /** The `<form>` element that triggered the submit, when invoked via `enhance()`. */
  form?: HTMLFormElement;
}

/**
 * A form-action target: an endpoint URL (native-fallback capable) or a function
 * that receives the submitted `FormData` and returns the result.
 */
export type FormActionTarget<R> =
  | string
  | ((formData: FormData, context: FormActionContext) => Promise<R> | R);

/**
 * Error thrown by {@link formAction} when a string target responds with a
 * non-OK HTTP status. Carries the `status` and the raw {@link Response} so
 * `onError` handlers can branch on them.
 */
export class FormActionError extends Error {
  readonly status: number;
  readonly response: Response;

  constructor(response: Response) {
    super(`bQuery forms: form action request failed with status ${response.status}`);
    this.name = 'FormActionError';
    this.status = response.status;
    this.response = response;
  }
}

/** Options for {@link formAction}. */
export interface FormActionOptions<R = unknown> {
  /**
   * HTTP method for the enhanced fetch submit. Default `'POST'`. Native form
   * fallback only supports `GET`/`POST`, so non-GET methods degrade to a native
   * `POST` (use a server-side method-override convention if you need the verb).
   */
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'GET';
  /** Custom `fetch` implementation (defaults to the global `fetch`). */
  fetch?: typeof fetch;
  /** Extra headers merged into the enhanced fetch submit. */
  headers?: Record<string, string>;
  /**
   * CSRF token to send with the enhanced submit (as a header) and to inject as a
   * hidden field on `enhance()` so the native no-JS POST carries it too. Pairs
   * with the `server` module's `csrf()` middleware.
   */
  csrf?: string | (() => string | null | undefined);
  /** Header carrying the CSRF token. Default `'x-csrf-token'`. */
  csrfHeader?: string;
  /** Hidden-field name carrying the CSRF token for native fallback. Default `'_csrf'`. */
  csrfField?: string;
  /**
   * Parse a `Response` into the action result. Defaults to JSON when the
   * response's content-type is JSON, otherwise text.
   */
  parseResponse?: (response: Response) => Promise<R> | R;
  /**
   * Apply an optimistic overlay for the duration of the submit. Return the
   * handle from an {@link OptimisticController.add} call (or nothing); it is
   * removed automatically when the submit settles.
   *
   * @example
   * ```ts
   * const list = optimistic(todos, (cur, draft: string) => [...cur, draft]);
   * formAction('/todos', {
   *   optimistic: (fd) => list.add(String(fd.get('title') ?? '')),
   * });
   * ```
   */
  optimistic?: (formData: FormData) => OptimisticHandle | void;
  /** Called after a successful submit. */
  onSuccess?: (result: R, formData: FormData) => void | Promise<void>;
  /** Called when the submit throws, rejects, or returns a non-OK response. */
  onError?: (error: unknown, formData: FormData) => void | Promise<void>;
  /** Reset the source `<form>` after a successful enhanced submit. Default `false`. */
  resetOnSuccess?: boolean;
}

/** Options for {@link FormAction.enhance}. */
export interface EnhanceOptions {
  /** Override `resetOnSuccess` for this binding. */
  resetOnSuccess?: boolean;
}

/** A reactive form-action handle returned by {@link formAction}. */
export interface FormAction<R = unknown> {
  /** `true` while a submit is in flight. */
  pending: Signal<boolean>;
  /** The error from the most recent failed submit, or `null`. */
  error: Signal<unknown>;
  /** The result of the most recent successful submit, or `undefined`. */
  result: Signal<R | undefined>;
  /** Number of submits started. */
  submitCount: Signal<number>;
  /** Timestamp (ms since epoch) of the most recent successful submit, or `null`. */
  submittedAt: Signal<number | null>;
  /**
   * Progressively enhance a `<form>`: ensure the native `action`/`method` (and
   * optional hidden CSRF field) are present so the form POSTs without JS, then
   * intercept `submit` to run a fetch-based, optimistic-aware submit when JS is
   * available. Returns a cleanup function that detaches the listener and removes
   * any injected hidden field.
   */
  enhance: (form: HTMLFormElement, options?: EnhanceOptions) => () => void;
  /** Programmatically run the action with explicit `FormData`. */
  submit: (formData?: FormData, context?: FormActionContext) => Promise<R | undefined>;
  /** Clear `error` / `result` and reset `pending`. */
  reset: () => void;
}

const resolveToken = (csrf: FormActionOptions['csrf']): string | undefined => {
  const value = typeof csrf === 'function' ? csrf() : csrf;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const defaultParseResponse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return response.json();
  }
  return response.text();
};

const buildFormData = (form: HTMLFormElement): FormData => {
  try {
    return new FormData(form);
  } catch {
    return new FormData();
  }
};

/**
 * Bind a form to a server action with progressive enhancement and reactive
 * submission state.
 *
 * @example
 * ```ts
 * import { formAction, useFormStatus } from '@bquery/bquery/forms';
 *
 * // Binds to a server action; falls back to a native POST without JS.
 * const submit = formAction('/todos', { method: 'POST' });
 * const { pending } = useFormStatus(submit);
 *
 * const cleanup = submit.enhance(document.querySelector('form')!);
 * ```
 */
export const formAction = <R = unknown>(
  target: FormActionTarget<R>,
  options: FormActionOptions<R> = {}
): FormAction<R> => {
  const pending = signal(false);
  const error = signal<unknown>(null);
  const result = signal<R | undefined>(undefined);
  const submitCount = signal(0);
  const submittedAt = signal<number | null>(null);

  const method = (options.method ?? 'POST').toUpperCase();
  const csrfHeader = options.csrfHeader ?? 'x-csrf-token';

  const runTarget = async (formData: FormData, context: FormActionContext): Promise<R> => {
    if (typeof target === 'function') {
      return (await target(formData, context)) as R;
    }
    const fetchImpl = options.fetch ?? (globalThis.fetch as typeof fetch | undefined);
    if (typeof fetchImpl !== 'function') {
      throw new Error(
        'bQuery forms: formAction requires a fetch implementation (none found on globalThis). Pass options.fetch.'
      );
    }
    const headers: Record<string, string> = { ...options.headers };
    const token = resolveToken(options.csrf);
    if (token) headers[csrfHeader] = token;
    const response = await fetchImpl(target, { method, body: formData, headers });
    if (!response.ok) {
      throw new FormActionError(response);
    }
    const parse = (options.parseResponse ?? defaultParseResponse) as (
      response: Response
    ) => Promise<R> | R;
    return (await parse(response)) as R;
  };

  const submit = async (
    formData: FormData = new FormData(),
    context: FormActionContext = {}
  ): Promise<R | undefined> => {
    pending.value = true;
    error.value = null;
    submitCount.value = submitCount.peek() + 1;
    const overlay = options.optimistic ? (options.optimistic(formData) ?? undefined) : undefined;

    try {
      const value = await runTarget(formData, context);
      result.value = value;
      submittedAt.value = Date.now();
      if (options.onSuccess) await options.onSuccess(value, formData);
      return value;
    } catch (caught) {
      error.value = caught;
      if (options.onError) await options.onError(caught, formData);
      return undefined;
    } finally {
      overlay?.remove();
      pending.value = false;
    }
  };

  const enhance = (form: HTMLFormElement, enhanceOptions: EnhanceOptions = {}): (() => void) => {
    if (typeof target === 'string') {
      if (!form.getAttribute('action')) form.setAttribute('action', target);
      if (!form.getAttribute('method')) {
        form.setAttribute('method', method === 'GET' ? 'get' : 'post');
      }
    }

    // Keep the native-fallback CSRF field in sync with the (possibly rotating)
    // token: resolved on enhance and refreshed before every submit so the form
    // body carries the same fresh token as the enhanced fetch header.
    const csrfFieldName = options.csrfField ?? '_csrf';
    let csrfInput: HTMLInputElement | undefined;
    let csrfInjected = false;

    const syncCsrfField = (): void => {
      const token = resolveToken(options.csrf);
      if (!token) return;
      if (!csrfInput) {
        csrfInput = Array.from(form.querySelectorAll('input')).find(
          (input) => input.getAttribute('name') === csrfFieldName
        );
        if (!csrfInput) {
          const input = form.ownerDocument.createElement('input');
          input.type = 'hidden';
          input.name = csrfFieldName;
          form.appendChild(input);
          csrfInput = input;
          csrfInjected = true;
        }
      }
      csrfInput.value = token;
      csrfInput.setAttribute('value', token);
    };

    syncCsrfField();

    const onSubmit = (event: Event): void => {
      event.preventDefault();
      syncCsrfField();
      const reset = enhanceOptions.resetOnSuccess ?? options.resetOnSuccess ?? false;
      void submit(buildFormData(form), { form }).then(() => {
        if (reset && error.peek() === null) form.reset();
      });
    };

    form.addEventListener('submit', onSubmit);
    return () => {
      form.removeEventListener('submit', onSubmit);
      if (csrfInjected && csrfInput?.parentNode) csrfInput.parentNode.removeChild(csrfInput);
    };
  };

  const reset = (): void => {
    pending.value = false;
    error.value = null;
    result.value = undefined;
  };

  return { pending, error, result, submitCount, submittedAt, enhance, submit, reset };
};

/** Read-only reactive view of a {@link FormAction}'s submission state. */
export interface FormStatus<R = unknown> {
  /** `true` while a submit is in flight. */
  pending: ReadonlySignalHandle<boolean>;
  /** The error from the most recent failed submit, or `null`. */
  error: ReadonlySignalHandle<unknown>;
  /** The result of the most recent successful submit, or `undefined`. */
  result: ReadonlySignalHandle<R | undefined>;
  /** Number of submits started. */
  submitCount: ReadonlySignalHandle<number>;
  /** Timestamp (ms since epoch) of the most recent successful submit, or `null`. */
  submittedAt: ReadonlySignalHandle<number | null>;
}

/**
 * Read-only reactive status for a {@link formAction}, mirroring React 19's
 * `useFormStatus`. Returns `readonly()` wrappers so consumers can observe but
 * not mutate the action's signals.
 *
 * @example
 * ```ts
 * const submit = formAction('/todos');
 * const { pending, error } = useFormStatus(submit);
 * effect(() => { saveButton.disabled = pending.value; });
 * ```
 */
export const useFormStatus = <R = unknown>(action: FormAction<R>): FormStatus<R> => ({
  pending: readonly(action.pending),
  error: readonly(action.error),
  result: readonly(action.result),
  submitCount: readonly(action.submitCount),
  submittedAt: readonly(action.submittedAt),
});

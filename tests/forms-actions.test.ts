/**
 * Tests for progressive-enhancement form actions + optimistic updates (#140):
 * - `optimistic()` overlay primitive
 * - `formAction()` function + string targets, CSRF, error handling
 * - `formAction().enhance()` progressive enhancement of a `<form>`
 * - `useFormStatus()` read-only status view
 */
import { describe, expect, it } from 'bun:test';
import { signal } from '../src/reactive/index';
import {
  FormActionError,
  formAction,
  optimistic,
  useFormStatus,
} from '../src/forms/index';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// ---------------------------------------------------------------------------
// optimistic()
// ---------------------------------------------------------------------------

describe('forms/optimistic', () => {
  it('folds drafts through the reducer over the base value', () => {
    const base = signal<string[]>(['a']);
    const list = optimistic(base, (current, draft: string) => [...current, draft]);

    expect(list.value.value).toEqual(['a']);
    expect(list.pending.value).toBe(false);

    const tx = list.add('b');
    expect(list.value.value).toEqual(['a', 'b']);
    expect(list.pending.value).toBe(true);
    expect(list.drafts.value).toEqual(['b']);
    expect(tx.active).toBe(true);

    tx.remove();
    expect(list.value.value).toEqual(['a']);
    expect(list.pending.value).toBe(false);
    expect(tx.active).toBe(false);
  });

  it('reflects base changes while an overlay is active (reconcile pattern)', () => {
    const base = signal<string[]>([]);
    const list = optimistic(base, (current, draft: string) => [...current, draft]);

    const tx = list.add('milk');
    expect(list.value.value).toEqual(['milk']);

    // server confirms: write the truth to the base, then drop the overlay
    base.value = ['milk'];
    expect(list.value.value).toEqual(['milk', 'milk']); // base + overlay momentarily
    tx.remove();
    expect(list.value.value).toEqual(['milk']);
  });

  it('run() applies the overlay for the duration of the task and removes it after', async () => {
    const base = signal<number[]>([]);
    const list = optimistic(base, (current, draft: number) => [...current, draft]);

    let pendingDuringTask: number[] = [];
    const result = await list.run(7, async () => {
      pendingDuringTask = [...list.value.value];
      return 'done';
    });

    expect(result).toBe('done');
    expect(pendingDuringTask).toEqual([7]);
    expect(list.pending.value).toBe(false);
    expect(list.value.value).toEqual([]);
  });

  it('run() removes the overlay even when the task rejects, and re-throws', async () => {
    const base = signal<number[]>([]);
    const list = optimistic(base, (current, draft: number) => [...current, draft]);

    await expect(
      list.run(1, async () => {
        throw new Error('failed');
      })
    ).rejects.toThrow('failed');
    expect(list.pending.value).toBe(false);
    expect(list.value.value).toEqual([]);
  });

  it('clear() drops every overlay', () => {
    const base = signal<string[]>([]);
    const list = optimistic(base, (current, draft: string) => [...current, draft]);
    list.add('a');
    list.add('b');
    expect(list.value.value).toEqual(['a', 'b']);
    list.clear();
    expect(list.value.value).toEqual([]);
    expect(list.pending.value).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formAction() — function target
// ---------------------------------------------------------------------------

describe('forms/formAction — function target', () => {
  it('runs the action and tracks result/pending/submitCount', async () => {
    const action = formAction<{ ok: boolean }>(async (formData) => ({
      ok: formData.get('x') === '1',
    }));

    const fd = new FormData();
    fd.set('x', '1');

    expect(action.pending.value).toBe(false);
    const result = await action.submit(fd);

    expect(result).toEqual({ ok: true });
    expect(action.result.value).toEqual({ ok: true });
    expect(action.error.value).toBeNull();
    expect(action.submitCount.value).toBe(1);
    expect(action.pending.value).toBe(false);
    expect(action.submittedAt.value).toBeGreaterThan(0);
  });

  it('captures thrown errors and invokes onError without rejecting', async () => {
    const seen: unknown[] = [];
    const action = formAction(
      async () => {
        throw new Error('boom');
      },
      { onError: (error) => void seen.push(error) }
    );

    const result = await action.submit();
    expect(result).toBeUndefined();
    expect(action.error.value).toBeInstanceOf(Error);
    expect((action.error.value as Error).message).toBe('boom');
    expect(seen).toHaveLength(1);
  });

  it('reset() clears error/result and pending', async () => {
    const action = formAction(async () => 'value');
    await action.submit();
    expect(action.result.value).toBe('value');
    action.reset();
    expect(action.result.value).toBeUndefined();
    expect(action.error.value).toBeNull();
    expect(action.pending.value).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formAction() — string target (fetch)
// ---------------------------------------------------------------------------

describe('forms/formAction — string target', () => {
  it('POSTs the FormData and sends the CSRF header', async () => {
    const calls: Array<{ url: unknown; init: RequestInit | undefined }> = [];
    const fetchStub = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url, init });
      return jsonResponse({ id: 1 });
    }) as unknown as typeof fetch;

    const action = formAction<{ id: number }>('/todos', {
      fetch: fetchStub,
      csrf: 'tok-123',
    });
    const fd = new FormData();
    fd.set('title', 'Hi');

    const result = await action.submit(fd);
    expect(result).toEqual({ id: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/todos');
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.body).toBe(fd);
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBe('tok-123');
  });

  it('throws FormActionError on a non-OK response', async () => {
    const fetchStub = (async () => new Response('nope', { status: 422 })) as unknown as typeof fetch;
    const action = formAction('/x', { fetch: fetchStub });

    await action.submit();
    expect(action.error.value).toBeInstanceOf(FormActionError);
    expect((action.error.value as FormActionError).status).toBe(422);
  });

  it('reports pending while the request is in flight', async () => {
    let release: (() => void) | undefined;
    const fetchStub = (() =>
      new Promise<Response>((resolve) => {
        release = () => resolve(jsonResponse({}));
      })) as unknown as typeof fetch;

    const action = formAction('/x', { fetch: fetchStub });
    const promise = action.submit(new FormData());
    expect(action.pending.value).toBe(true);
    release?.();
    await promise;
    expect(action.pending.value).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formAction().enhance() — progressive enhancement
// ---------------------------------------------------------------------------

describe('forms/formAction — enhance()', () => {
  it('sets native action/method and injects a hidden CSRF field', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);

    const action = formAction('/todos', { method: 'POST', csrf: 'tok' });
    const cleanup = action.enhance(form);

    expect(form.getAttribute('action')).toBe('/todos');
    expect(form.getAttribute('method')).toBe('post');
    const hidden = form.querySelector('input[name="_csrf"]') as HTMLInputElement | null;
    expect(hidden).not.toBeNull();
    expect(hidden?.value).toBe('tok');

    cleanup();
    expect(form.querySelector('input[name="_csrf"]')).toBeNull();
    form.remove();
  });

  it('does not overwrite a pre-existing action attribute', () => {
    const form = document.createElement('form');
    form.setAttribute('action', '/custom');
    const action = formAction('/todos');
    action.enhance(form);
    expect(form.getAttribute('action')).toBe('/custom');
  });

  it('intercepts submit, prevents default, and runs the fetch submit', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);

    const calls: number[] = [];
    const fetchStub = (async () => {
      calls.push(1);
      return jsonResponse({ ok: true });
    }) as unknown as typeof fetch;

    const action = formAction('/todos', { fetch: fetchStub });
    const cleanup = action.enhance(form);

    const event = new Event('submit', { cancelable: true });
    const notCancelled = form.dispatchEvent(event);
    expect(notCancelled).toBe(false); // preventDefault() was called

    await flush();
    expect(calls).toHaveLength(1);
    expect(action.result.value).toEqual({ ok: true });

    cleanup();
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    expect(calls).toHaveLength(1); // listener detached
    form.remove();
  });

  it('composes with an optimistic overlay during the in-flight submit', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);

    const base = signal<string[]>([]);
    const list = optimistic(base, (current, draft: string) => [...current, draft]);

    let release: (() => void) | undefined;
    const fetchStub = (() =>
      new Promise<Response>((resolve) => {
        release = () => resolve(jsonResponse({}));
      })) as unknown as typeof fetch;

    const action = formAction('/todos', {
      fetch: fetchStub,
      optimistic: () => list.add('Milk'),
    });
    action.enhance(form);

    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    expect(list.value.value).toEqual(['Milk']); // overlay visible while pending
    expect(list.pending.value).toBe(true);

    release?.();
    await flush();
    await flush();
    expect(list.pending.value).toBe(false); // overlay removed on settle
    expect(list.value.value).toEqual([]);
    form.remove();
  });
});

// ---------------------------------------------------------------------------
// useFormStatus()
// ---------------------------------------------------------------------------

describe('forms/useFormStatus', () => {
  it('exposes a read-only view of the action state', async () => {
    const action = formAction(async () => 'ok');
    const status = useFormStatus(action);

    expect(status.pending.value).toBe(false);
    expect(status.submitCount.value).toBe(0);

    await action.submit();
    expect(status.result.value).toBe('ok');
    expect(status.submitCount.value).toBe(1);
    expect(status.pending.value).toBe(false);
  });
});

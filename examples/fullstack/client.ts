/**
 * Browser entry: hydrates the server-rendered page and adds the interactive
 * parts — schema-validated note form, persisted draft, optimistic list.
 *
 * Served as `/client.js`; `server.ts` bundles it with `Bun.build()` at start.
 */

import { createForm } from '../../src/forms/index';
import { createI18n } from '../../src/i18n/index';
import { computed, createHttp, HttpError, signal } from '../../src/reactive/index';
import { hydrate } from '../../src/ssr/index';
import { createPersistedStore } from '../../src/store/index';
import { messages } from './shared/messages';
import { noteItemTemplate } from './shared/pages';
import { NoteSchema, type NoteInput } from './shared/schema';

interface Note {
  id: string;
  title: string;
  body: string;
}

interface PageState {
  page: string;
  locale: 'en' | 'de';
  csrf: string;
  notes?: Note[];
  labels: Record<string, string>;
}

const state = JSON.parse(document.getElementById('bq-state')?.textContent ?? '{}') as PageState;
const root = document.getElementById('app');

const hydrateNotesPage = (): void => {
  if (!root) return;
  const i18n = createI18n({
    locale: state.locale,
    fallbackLocale: 'en',
    messages: messages as never,
  });
  const api = createHttp({ headers: { 'x-csrf-token': state.csrf, accept: 'application/json' } });

  const notes = signal<Note[]>(state.notes ?? []);
  const countLabel = computed(() => i18n.t('notes.count', { count: notes.value.length }));

  // The unsent draft survives a reload: it lives in localStorage.
  const draft = createPersistedStore({
    id: 'bquery-notes-draft',
    state: () => ({ title: '', body: '' }),
  });
  const draftSaved = signal(false);

  const form = createForm({
    schema: NoteSchema,
    initialValues: { title: draft.title, body: draft.body },
    validationStrategy: 'onBlur',
    async onSubmit(values: NoteInput) {
      try {
        const { data } = await api.post<Note>('/api/notes', values);
        notes.value = [data, ...notes.value];
        form.reset();
        form.setValues({ title: '', body: '' });
      } catch (error) {
        // The server validates with the same schema; show its issues on the fields.
        const issues = (error as HttpError).response?.data as
          { issues?: Array<{ message: string; path: string[] }> } | undefined;
        for (const issue of issues?.issues ?? []) {
          if (issue.path.length > 0) {
            form.setErrors({ [String(issue.path[0])]: issue.message } as Record<string, string>);
          }
        }
        if (!issues?.issues) throw error;
      }
    },
  });
  form.subscribe((values) => {
    draft.title = values.title;
    draft.body = values.body;
    draftSaved.value = Boolean(values.title || values.body);
  });

  const remove = async (id: string): Promise<void> => {
    const previous = notes.value;
    notes.value = previous.filter((note) => note.id !== id); // optimistic
    try {
      await api.delete(`/api/notes/${encodeURIComponent(id)}`);
    } catch {
      notes.value = previous;
    }
  };

  // Error messages are i18n keys from the shared schema.
  const fieldError = (name: 'title' | 'body'): string => {
    const key = form.fields[name].error.value;
    return key ? i18n.t(key) : '';
  };

  // Put the loop template back; the server output only has the rendered items.
  const list = root.querySelector('ul.notes');
  if (list) list.innerHTML = noteItemTemplate;

  hydrate(
    root,
    {
      ...state,
      notes,
      countLabel,
      form,
      fieldError,
      remove,
      draftSaved,
      submit: () => form.handleSubmit(),
    },
    { onMismatch: 'repair' }
  );

  document.documentElement.dataset.hydrated = 'true';
};

if (state.page === '/') hydrateNotesPage();
else document.documentElement.dataset.hydrated = 'true';

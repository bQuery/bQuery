/**
 * Makes the server-rendered notes page interactive: a validated form that
 * posts to the API and a list that deletes optimistically.
 */

import { createForm } from '@bquery/bquery/forms';
import { computed, createHttp, signal } from '@bquery/bquery/reactive';
import { hydrate } from '@bquery/bquery/ssr';
import { countLabel, noteRules, type Note, type NoteErrors, type NoteInput } from '../shared/note';
import { noteItemTemplate } from '../shared/pages';

/** The state the server embeds in `<script id="bq-state">`. */
export interface PageState {
  page: string;
  csrf: string;
  notes?: Note[];
}

/** Hydrates the notes page rendered into `root`; returns the reactive state. */
export const hydrateNotes = (root: HTMLElement, state: PageState) => {
  // Every request carries the CSRF token the server rendered into the page.
  const api = createHttp({ headers: { 'x-csrf-token': state.csrf, accept: 'application/json' } });

  const notes = signal<Note[]>(state.notes ?? []);
  const form = createForm<NoteInput>({
    fields: {
      title: { initialValue: '', validators: noteRules.title },
      body: { initialValue: '', validators: noteRules.body },
    },
    async onSubmit(values) {
      const response = await api.post<Note | { errors: NoteErrors }>('/api/notes', values, {
        // A 400 answer carries field errors: read it instead of throwing.
        validateStatus: (status) => (status >= 200 && status < 300) || status === 400,
      });
      if ('errors' in response.data) {
        // The server checks the same rules; show its messages on the fields.
        form.setErrors(response.data.errors);
        return;
      }
      notes.value = [response.data, ...notes.value];
      form.reset();
    },
  });

  const remove = async (id: string): Promise<void> => {
    const previous = notes.value;
    notes.value = previous.filter((note) => note.id !== id); // optimistic
    try {
      await api.delete(`/api/notes/${encodeURIComponent(id)}`);
    } catch {
      notes.value = previous; // roll back
    }
  };

  // Put the loop template back; the server output only has the rendered items.
  const list = root.querySelector('ul.notes');
  if (list) list.innerHTML = noteItemTemplate;

  hydrate(
    root,
    {
      ...state,
      notes,
      countLabel: computed(() => countLabel(notes.value.length)),
      form,
      remove,
      submit: () => form.handleSubmit(),
    },
    { onMismatch: 'repair' }
  );

  return { notes, form };
};

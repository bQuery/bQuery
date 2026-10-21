/** In-memory note storage. Swap for a database in a real app. */

import type { Note, NoteInput } from '../shared/note';

export interface NotesRepo {
  list(): Note[];
  get(id: string): Note | undefined;
  add(input: NoteInput): Note;
  remove(id: string): boolean;
}

export const createNotesRepo = (seed: Note[] = []): NotesRepo => {
  const notes = [...seed];
  let nextId = notes.length + 1;
  return {
    list: () => [...notes],
    get: (id) => notes.find((note) => note.id === id),
    add(input) {
      const note = { id: `n${nextId++}`, ...input, createdAt: Date.now() };
      notes.unshift(note);
      return note;
    },
    remove(id) {
      const index = notes.findIndex((note) => note.id === id);
      if (index === -1) return false;
      notes.splice(index, 1);
      return true;
    },
  };
};

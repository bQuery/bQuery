/** In-memory note storage, one list per user. Swap for a database in a real app. */

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

export interface NotesRepo {
  list(userId: string): Note[];
  get(userId: string, id: string): Note | undefined;
  add(userId: string, input: { title: string; body: string }): Note;
  remove(userId: string, id: string): boolean;
}

export const createNotesRepo = (seed: Record<string, Note[]> = {}): NotesRepo => {
  const byUser = new Map<string, Note[]>(
    Object.entries(seed).map(([user, notes]) => [user, [...notes]])
  );
  let nextId = 1;
  const notesOf = (userId: string): Note[] => {
    let notes = byUser.get(userId);
    if (!notes) {
      notes = [];
      byUser.set(userId, notes);
    }
    return notes;
  };
  return {
    list: (userId) => [...notesOf(userId)],
    get: (userId, id) => notesOf(userId).find((note) => note.id === id),
    add(userId, input) {
      const note = { id: `n${nextId++}`, ...input, createdAt: Date.now() };
      notesOf(userId).unshift(note);
      return note;
    },
    remove(userId, id) {
      const notes = notesOf(userId);
      const index = notes.findIndex((note) => note.id === id);
      if (index === -1) return false;
      notes.splice(index, 1);
      return true;
    },
  };
};

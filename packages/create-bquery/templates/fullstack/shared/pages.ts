/**
 * Page templates. The server renders them with `renderToString()`; the
 * browser hydrates the same markup, so the `bq-*` bindings are the single
 * description of each page.
 */

/** Escapes text for HTML element content and attribute values. */
const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Wraps a page body in the document. `state` is embedded for hydration. */
export const documentShell = (options: {
  title: string;
  body: string;
  csrf: string;
  state: unknown;
}): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="csrf-token" content="${escapeHtml(options.csrf)}" />
    <title>${escapeHtml(options.title)}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="app">${options.body}</div>
    <script id="bq-state" type="application/json">${JSON.stringify(options.state)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')}</script>
    <script type="module" src="/client.js"></script>
  </body>
</html>`;

/**
 * One list item. The server output of `bq-for` keeps the rendered items but
 * not the loop template, so the client puts this template back into the list
 * before hydrating (see client/notes.ts).
 *
 * `bq-on` handlers see raw signals and `bq-for` loop variables are signals —
 * hence `note.value.id` in the handler, while `bq-text` / `bq-bind` unwrap
 * them and read `note.id`.
 */
export const noteItemTemplate = `
    <li bq-for="note in notes" :key="note.id">
      <a bq-bind:href="'/notes/' + note.id" bq-text="note.title"></a>
      <button class="link" type="button" bq-bind:aria-label="'Delete ' + note.title" bq-on:click="remove(note.value.id)">Delete</button>
    </li>`;

export const notesTemplate = `
<main class="card">
  <h1>Notes</h1>
  <p class="count" bq-text="countLabel"></p>
  <ul class="notes">${noteItemTemplate}</ul>
  <form id="note-form" novalidate bq-on:submit.prevent="submit()">
    <label for="note-title">Title</label>
    <input id="note-title" name="title" bq-model="form.fields.title.value" />
    <small class="error" bq-error="form.fields.title"></small>
    <label for="note-body">Text</label>
    <textarea id="note-body" name="body" rows="3" bq-model="form.fields.body.value"></textarea>
    <small class="error" bq-error="form.fields.body"></small>
    <button type="submit">Add note</button>
  </form>
</main>`;

export const noteTemplate = `
<main class="card">
  <a href="/">All notes</a>
  <article bq-if="note">
    <h1 bq-text="note.title"></h1>
    <p bq-text="note.body"></p>
  </article>
  <p bq-if="!note">This note does not exist.</p>
</main>`;

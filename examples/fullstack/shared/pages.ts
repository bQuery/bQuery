/**
 * Page templates. The server renders them with `renderToString()`; the
 * browser hydrates the same markup, so the `bq-*` bindings are the single
 * description of each page.
 */

/** Wraps a page body in the document shell. `state` is embedded for hydration. */
export const documentShell = (options: {
  locale: string;
  title: string;
  body: string;
  csrf: string;
  state: unknown;
}): string => `<!doctype html>
<html lang="${options.locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="csrf-token" content="${options.csrf}" />
    <title>${options.title}</title>
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

export const loginTemplate = `
<main class="card">
  <h1 bq-text="labels.heading"></h1>
  <p class="hint" bq-text="labels.hint"></p>
  <p class="error" role="alert" bq-show="error" bq-text="error"></p>
  <form method="post" action="/login">
    <input type="hidden" name="_csrf" bq-bind:value="csrf" />
    <label>
      <span bq-text="labels.email"></span>
      <input name="email" type="email" autocomplete="username" bq-bind:value="email" />
    </label>
    <label>
      <span bq-text="labels.password"></span>
      <input name="password" type="password" autocomplete="current-password" />
    </label>
    <button type="submit" bq-text="labels.submit"></button>
  </form>
  <nav class="locales">
    <a bq-for="option in locales" bq-bind:href="option.href" bq-bind:aria-current="option.current" bq-text="option.label"></a>
  </nav>
</main>`;

/**
 * One list item. The server output of `bq-for` keeps the rendered items but
 * not the loop template, so the client puts this template back into the list
 * before hydrating (see client.ts).
 *
 * `bq-on` handlers see raw signals (so `count.value++` works), and `bq-for`
 * loop variables are signals — hence `note.value.id` in the handler, while
 * `bq-text` / `bq-bind` unwrap them and read `note.id`.
 */
export const noteItemTemplate = `
    <li bq-for="note in notes" :key="note.id">
      <a bq-bind:href="'/notes/' + note.id" bq-text="note.title"></a>
      <button class="link" type="button" bq-on:click="remove(note.value.id)" bq-text="labels.remove"></button>
    </li>`;

export const notesTemplate = `
<main class="card">
  <header>
    <h1 bq-text="labels.heading"></h1>
    <form method="post" action="/logout">
      <input type="hidden" name="_csrf" bq-bind:value="csrf" />
      <button class="link" type="submit" bq-text="labels.signOut"></button>
    </form>
  </header>
  <p class="count" bq-text="countLabel"></p>
  <ul class="notes">${noteItemTemplate}</ul>
  <form id="note-form" method="post" action="/api/notes" novalidate bq-on:submit.prevent="submit()">
    <label>
      <span bq-text="labels.title"></span>
      <input name="title" bq-model="form.fields.title.value" />
    </label>
    <small class="error" bq-text="fieldError('title')"></small>
    <label>
      <span bq-text="labels.body"></span>
      <textarea name="body" rows="3" bq-model="form.fields.body.value"></textarea>
    </label>
    <small class="error" bq-text="fieldError('body')"></small>
    <button type="submit" bq-text="labels.add"></button>
    <small class="hint" bq-show="draftSaved" bq-text="labels.draftSaved"></small>
  </form>
</main>`;

export const noteTemplate = `
<main class="card">
  <a href="/" bq-text="labels.back"></a>
  <article bq-if="note">
    <h1 bq-text="note.title"></h1>
    <p bq-text="note.body"></p>
  </article>
  <p bq-if="!note" bq-text="labels.notFound"></p>
</main>`;

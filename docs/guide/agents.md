# Agents

Diese Seite beschreibt, wie du bQuery für Agenten-Frontends nutzt — z. B. Chat‑UIs, Tools‑Panels, Vorschau‑Ansichten oder Kontroll‑Dashboards. bQuery ist dabei die UI‑Schicht; die Agentenlogik läuft typischerweise im Backend oder in einem Worker.

## Ziele

- **Schnelle UI‑Iteration** ohne Build‑Pflicht
- **Sichere DOM‑Writes** durch Standard‑Sanitization
- **Reaktive Zustände** für Streaming‑Antworten
- **Modulare Architektur** (nur importieren, was du brauchst)

## Architektur‑Empfehlung

**Frontend (bQuery):** Darstellung, Interaktion, State‑Binding, Animationen.
**Backend/Worker:** Agentenlogik, Tool‑Aufrufe, Modellzugriff, Secrets.

> **Wichtig:** API‑Keys gehören niemals ins Browser‑Frontend. Stelle Agentenendpunkte über ein Backend bereit.

## Installation

### Zero‑Build (CDN)

```html
<script type="module">
  import { $, signal, effect } from 'https://unpkg.com/@bquery/bquery@1/dist/full.es.mjs';
  // UI‑Code
</script>
```

### Package Manager

```ts
import { $, signal, effect } from '@bquery/bquery';
```

## Beispiel: Agenten‑Chat UI (Minimal)

```ts
import { $, $$ } from '@bquery/bquery/core';
import { signal, effect, batch } from '@bquery/bquery/reactive';
import { sanitize } from '@bquery/bquery/security';

const messages = signal<string[]>([]);
const input = $('#prompt');
const list = $('#messages');

function appendMessage(text: string) {
  messages.value = [...messages.value, text];
}

effect(() => {
  list.html(messages.value.map((m) => `<li class="msg">${sanitize(m)}</li>`).join(''));
});

$('#send').on('click', async () => {
  const prompt = (input.val() as string | undefined)?.trim();
  if (!prompt) return;

  batch(() => {
    appendMessage(`You: ${prompt}`);
    appendMessage('Agent: …');
  });

  // Backend‑Call (Agentenlogik serverseitig)
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const { reply } = await res.json();

  // letztes "Agent: …" ersetzen
  messages.value = messages.value.slice(0, -1).concat(`Agent: ${reply}`);
});
```

### Streaming‑Antworten (Token‑Updates)

```ts
import { signal, effect } from 'bquery/reactive';

const reply = signal('');

// UI‑Binding
effect(() => {
  $('#reply').text(reply.value);
});

// Streaming (SSE/WebSocket/Fetch‑Streams)
function onToken(token: string) {
  reply.value += token;
}
```

## Patterns für Agent‑UIs

### 1) Status & Tool‑Aktivität

- Zeige `idle / thinking / working / done`.
- Logge Tool‑Aufrufe im UI, nicht im DOM‑Console‑Spam.

### 2) Reaktiver Zustand pro Panel

- **Chat**: `messages: signal<Message[]>`
- **Tools**: `toolRuns: signal<ToolRun[]>`
- **Kontext**: `context: signal<Record<string, unknown>>`

### 3) Komponenten für wiederverwendbare UI‑Teile

```ts
import { component, html } from 'bquery/component';

component('tool-pill', {
  props: { name: { type: String, required: true } },
  render({ props }) {
    return html`<span class="pill">${props.name}</span>`;
  },
});
```

## Sicherheit

- **Sanitization** ist Standard — nutze `sanitize()` bei dynamischen HTML‑Strings.
- **Trusted Types** aktivieren, wenn CSP vorhanden ist.
- **Keine Secrets im Client**: Agentenendpunkte proxy‑en.

## Performance‑Hinweise

- Nutze `batch()` für mehrere State‑Updates.
- Vermeide riesige `innerHTML`‑Updates bei langen Chats (ggf. Virtualisierung).
- Arbeite mit kleinen, gezielten DOM‑Updates für Streaming.

## Fehlerbehandlung

- Netzwerkfehler sichtbar machen (Toast/Inline‑Status).
- Zeitüberschreitungen sinnvoll behandeln (Retry/Cancel).
- Tool‑Fehler klar markieren, aber keine sensiblen Details ausgeben.

## FAQ

**Kann bQuery im Backend laufen?**
Nein. bQuery ist eine DOM‑Bibliothek für den Browser. Für Agentenlogik nutze einen Server oder Worker.

**Kann ich bQuery mit Frameworks kombinieren?**
Ja, z. B. als Light‑DOM‑Layer in bestehenden Apps. Achte auf klare Verantwortlichkeiten.

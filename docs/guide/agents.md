# Agents

This page describes how to use bQuery for agent frontends — for example chat UIs, tools panels, preview views, or control dashboards. bQuery is the UI layer; the agent logic typically runs in a backend or in a worker.

## Goals

- **Fast UI iteration** without a required build step
- **Safe DOM writes** via default sanitization
- **Reactive state** for streaming responses
- **Modular architecture** (only import what you need)

## Architecture recommendation

**Frontend (bQuery):** rendering, interaction, state binding, animations.
**Backend/Worker:** agent logic, tool calls, model access, secrets.

> **Important:** API keys never belong in the browser frontend. Expose agent endpoints via a backend.

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

## Example: agent chat UI (minimal)

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

  // Backend call (agent logic server-side)
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const { reply } = await res.json();

  // replace the last "Agent: …"
  messages.value = messages.value.slice(0, -1).concat(`Agent: ${reply}`);
});
```

### Streaming responses (token updates)

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

## Patterns for agent UIs

### 1) Status & tool activity

- Show `idle / thinking / working / done`.
- Log tool calls in the UI, not as noisy console output.

### 2) Reactive state per panel

- **Chat**: `messages: signal<Message[]>`
- **Tools**: `toolRuns: signal<ToolRun[]>`
- **Context**: `context: signal<Record<string, unknown>>`

### 3) Components for reusable UI parts

```ts
import { component, html } from 'bquery/component';

component('tool-pill', {
  props: { name: { type: String, required: true } },
  render({ props }) {
    return html`<span class="pill">${props.name}</span>`;
  },
});
```

## Security

- **Sanitization** is the default — use `sanitize()` for dynamic HTML strings.
- Enable **Trusted Types** when CSP is present.
- **No secrets in the client**: proxy agent endpoints through a backend.

## Performance notes

- Use `batch()` for multiple state updates.
- Avoid huge `innerHTML` updates for long chats (consider virtualization).
- Prefer small, targeted DOM updates for streaming.

## Error handling

- Make network errors visible (toast/inline status).
- Handle timeouts sensibly (retry/cancel).
- Mark tool errors clearly, but do not expose sensitive details.

## FAQ

**Can bQuery run in the backend?**
No. bQuery is a DOM library for the browser. Use a server or worker for agent logic.

**Can I combine bQuery with frameworks?**
Yes — for example as a light DOM layer inside existing apps. Keep responsibilities clearly separated.

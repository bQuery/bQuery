# Agents

This page describes how to use bQuery for agent frontends — for example chat UIs, tools panels, preview views, or control dashboards. bQuery is the UI layer; the agent logic typically runs in a backend or in a worker.

## Goals

- **Fast UI iteration** without a required build step
- **Safe DOM writes** via default sanitization
- **Reactive state and transport composables** for streaming responses
- **Modular architecture** (only import what you need)

## Architecture recommendation

**Frontend (bQuery):** rendering, interaction, state binding, animations.
**Backend/Worker:** agent logic, tool calls, model access, secrets.

The same bQuery package can serve **both** sides of this split. On the browser side you use `core`, `reactive`, `view`, and `component` to render. On the server side you use `@bquery/bquery/server` to expose endpoints, `@bquery/bquery/ssr` to pre-render initial HTML, and `@bquery/bquery/reactive` (signals, stores) without a DOM. The same TypeScript types and validation helpers can be shared between the two — see [Server](./server.md) and [SSR](./ssr.md).

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
  const raw = input.val();
  const prompt = typeof raw === 'string' ? raw.trim() : undefined;
  if (!prompt) return;

  batch(() => {
    appendMessage(`You: ${prompt}`);
    appendMessage('Agent: …');
  });

  // Backend call (agent logic server-side)
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      // Try to read error details, but fall back to status text
      let errorMessage = `Request failed with status ${res.status} ${res.statusText || ''}`.trim();
      try {
        const errorBody = await res.text();
        if (errorBody) {
          errorMessage += `: ${errorBody}`;
        }
      } catch {
        // ignore secondary errors from reading the body
      }
      throw new Error(errorMessage);
    }

    const data = await res.json();
    let reply = '';
    if (data && typeof data === 'object' && typeof (data as any).reply === 'string') {
      reply = (data as any).reply;
    }

    // replace the last "Agent: …"
    messages.value = messages.value.slice(0, -1).concat(`Agent: ${reply}`);
  } catch (err) {
    console.error('Agent request failed:', err);
    // replace the last "Agent: …" with an error message
    messages.value = messages.value
      .slice(0, -1)
      .concat('Agent: (error getting response, please try again)');
  }
});
```

### Streaming responses (token updates)

```ts
import { signal, effect } from '@bquery/bquery/reactive';

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

### Streaming responses with built-in transport composables

Instead of manually wiring `fetch()` plus ad-hoc listeners, you can drive the
request and stream lifecycle with bQuery's reactive networking helpers.

```ts
import { effect, signal, useEventSource, useSubmit } from '@bquery/bquery/reactive';

const reply = signal('');
const activeJobId = signal<string | null>(null);

const submitPrompt = useSubmit<{ jobId: string }>('/api/agent/jobs');
const stream = useEventSource<{ token?: string; done?: boolean }>(
  () => `/api/agent/jobs/${activeJobId.value ?? 'pending'}/events`,
  { immediate: false }
);

effect(() => {
  const event = stream.data.value;
  if (event?.token) {
    reply.value += event.token;
  }
});

async function sendPrompt(prompt: string) {
  const result = await submitPrompt.submit({ prompt });
  if (!result?.jobId) return;

  reply.value = '';
  activeJobId.value = result.jobId;
  stream.open();
}
```

This keeps submission state, streaming state, retries, and cleanup in the
reactive layer instead of scattering them across DOM handlers.

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
import { component, html } from '@bquery/bquery/component';

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

**Can bQuery run on the backend?**
Yes — bQuery is runtime-agnostic. The browser-only modules (`core`, `view`, `component`, `motion`, etc.) require a DOM, but `@bquery/bquery/reactive`, `@bquery/bquery/store`, `@bquery/bquery/ssr`, and `@bquery/bquery/server` run on Node ≥ 24, Bun ≥ 1.3.13, and Deno. For agent backends, host your model calls behind a `createServer()` instance and stream tokens to the browser over SSE or WebSockets — see [Server](./server.md) and [SSR](./ssr.md).

**Can I combine bQuery with frameworks?**
Yes — for example as a light DOM layer inside existing apps. Keep responsibilities clearly separated.

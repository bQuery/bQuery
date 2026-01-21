/**
 * Platform Module Demos
 * Demonstrates storage, notifications, and theme picker
 */

import { component, effect, escapeHtml, html, notifications, storage } from 'bquery';
import { currentTheme } from '../state';

// Storage Demo Component
component('demo-storage', {
  styles: `
    :host { display: block; }
    .form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .row { display: flex; gap: 0.5rem; }
    input {
      flex: 1;
      padding: 0.625rem 0.875rem;
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 0.875rem;
      color: #fafafa;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      outline: none;
    }
    input:focus { border-color: #6366f1; }
    .output {
      padding: 0.75rem;
      background: #0a0a0b;
      border: 1px solid #1f1f23;
      border-radius: 0.5rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: #a1a1aa;
      min-height: 60px;
    }
    .output-key { color: #a78bfa; }
    .output-val { color: #86efac; }
  `,
  render() {
    return html`
      <div class="form">
        <div class="row">
          <input type="text" id="storage-key" placeholder="Key" value="myKey" />
          <input type="text" id="storage-val" placeholder="Value" />
        </div>
        <div class="row">
          <bq-button size="sm" id="btn-set">Set</bq-button>
          <bq-button size="sm" id="btn-get">Get</bq-button>
          <bq-button variant="danger" size="sm" id="btn-remove">Remove</bq-button>
        </div>
        <div class="output" id="storage-output">Stored value will appear here...</div>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const keyInput = shadow.getElementById('storage-key') as HTMLInputElement;
      const valInput = shadow.getElementById('storage-val') as HTMLInputElement;
      const output = shadow.getElementById('storage-output')!;

      const store = storage.local();

      shadow.getElementById('btn-set')?.addEventListener('click', async () => {
        const key = keyInput.value || 'myKey';
        const val = valInput.value;
        await store.set(key, val);
        output.innerHTML = `Set: <span class="output-key">"${escapeHtml(key)}"</span> = <span class="output-val">"${escapeHtml(val)}"</span>`;
      });

      shadow.getElementById('btn-get')?.addEventListener('click', async () => {
        const key = keyInput.value || 'myKey';
        const val = await store.get<string>(key);
        output.innerHTML =
          val !== null
            ? `<span class="output-key">"${escapeHtml(key)}"</span> = <span class="output-val">"${escapeHtml(String(val))}"</span>`
            : `<span class="output-key">"${escapeHtml(key)}"</span> = <span style="color:#ef4444;">null</span>`;
      });

      shadow.getElementById('btn-remove')?.addEventListener('click', async () => {
        const key = keyInput.value || 'myKey';
        await store.remove(key);
        output.innerHTML = `Removed: <span class="output-key">"${escapeHtml(key)}"</span>`;
      });
    });
  },
});

// Notifications Demo Component
component('demo-notifications', {
  styles: `
    :host { display: block; }
    .status {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .status-dot.granted { background: #22c55e; }
    .status-dot.denied { background: #ef4444; }
    .status-dot.default { background: #f59e0b; }
    .status-text { font-size: 0.875rem; color: #a1a1aa; }
    .status-perm {
      font-weight: 500;
      text-transform: capitalize;
    }
    .status-perm.granted { color: #22c55e; }
    .status-perm.denied { color: #ef4444; }
    .status-perm.default { color: #f59e0b; }
    .controls { display: flex; gap: 0.5rem; }
  `,
  render() {
    return html`
      <div class="status">
        <span class="status-dot" id="perm-dot"></span>
        <span class="status-text">
          Permission:
          <span class="status-perm" id="perm-text">checking...</span>
        </span>
      </div>
      <div class="controls">
        <bq-button size="sm" id="btn-request">Request Permission</bq-button>
        <bq-button variant="primary" size="sm" id="btn-send">Send Notification</bq-button>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const permDot = shadow.getElementById('perm-dot')!;
      const permText = shadow.getElementById('perm-text')!;

      const updateStatus = () => {
        if (!notifications.isSupported()) {
          permDot.className = 'status-dot denied';
          permText.className = 'status-perm denied';
          permText.textContent = 'unsupported';
          return;
        }
        const perm = Notification.permission;
        permDot.className = `status-dot ${perm}`;
        permText.className = `status-perm ${perm}`;
        permText.textContent = perm;
      };

      updateStatus();

      shadow.getElementById('btn-request')?.addEventListener('click', async () => {
        const result = await notifications.requestPermission();
        updateStatus();
        if (result === 'granted') {
          notifications.send('bQuery', {
            body: 'Permission granted! 🎉',
            icon: 'https://api.iconify.design/heroicons:bell-alert.svg?color=%236366f1',
          });
        }
      });

      shadow.getElementById('btn-send')?.addEventListener('click', () => {
        if (Notification.permission === 'granted') {
          notifications.send('bQuery Notification', {
            body: 'This is a test notification from the playground!',
            icon: 'https://api.iconify.design/heroicons:sparkles.svg?color=%236366f1',
          });
        } else {
          alert('Please grant notification permission first.');
        }
      });
    });
  },
});

// Theme Picker Component
component('demo-theme-picker', {
  styles: `
    :host { display: block; }
    .picker {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .info {
      font-size: 0.875rem;
      color: #a1a1aa;
    }
    .info strong { color: #fafafa; }
    .options { display: flex; gap: 0.5rem; }
  `,
  render() {
    return html`
      <div class="picker">
        <div class="info">
          Current theme:
          <strong id="theme-display">${currentTheme.value}</strong>
        </div>
        <div class="options">
          <bq-button
            size="sm"
            id="btn-dark"
            variant="${currentTheme.value === 'dark' ? 'primary' : 'ghost'}"
            >🌙 Dark</bq-button
          >
          <bq-button
            size="sm"
            id="btn-light"
            variant="${currentTheme.value === 'light' ? 'primary' : 'ghost'}"
            >☀️ Light</bq-button
          >
        </div>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const themeDisplay = shadow.getElementById('theme-display')!;
      const btnDark = shadow.getElementById('btn-dark')!;
      const btnLight = shadow.getElementById('btn-light')!;

      // Apply theme to document
      const applyTheme = (theme: string) => {
        document.documentElement.setAttribute('data-theme', theme);
        themeDisplay.textContent = theme;
        btnDark.setAttribute('variant', theme === 'dark' ? 'primary' : 'ghost');
        btnLight.setAttribute('variant', theme === 'light' ? 'primary' : 'ghost');
      };

      // Apply initial theme
      applyTheme(currentTheme.value);

      // Watch for theme changes
      effect(() => {
        applyTheme(currentTheme.value);
      });

      btnDark.addEventListener('click', () => {
        currentTheme.value = 'dark';
      });

      btnLight.addEventListener('click', () => {
        currentTheme.value = 'light';
      });
    });
  },
});

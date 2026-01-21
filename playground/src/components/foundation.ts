/**
 * Foundation Components
 * Base UI components used throughout the playground
 */

import { component, html } from 'bquery';

// Button Component
component('bq-button', {
  props: {
    variant: { type: String, default: 'default' },
    size: { type: String, default: 'md' },
    disabled: { type: Boolean, default: false },
  },
  styles: `
    :host { display: inline-block; }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-family: 'Outfit', system-ui, sans-serif;
      font-weight: 500;
      border-radius: 0.5rem;
      border: 1px solid rgba(255,255,255,0.1);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    /* Sizes */
    button.sm { padding: 0.375rem 0.75rem; font-size: 0.75rem; }
    button.md { padding: 0.5rem 1rem; font-size: 0.875rem; }
    button.lg { padding: 0.75rem 1.5rem; font-size: 1rem; min-width: 48px; }
    /* Variants */
    button.default {
      background: #18181b;
      color: #fafafa;
      border-color: #27272a;
    }
    button.default:hover:not(:disabled) {
      background: #27272a;
      border-color: #3f3f46;
    }
    button.primary {
      background: #6366f1;
      color: white;
      border-color: #6366f1;
    }
    button.primary:hover:not(:disabled) {
      background: #4f46e5;
      border-color: #4f46e5;
    }
    button.danger {
      background: transparent;
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.3);
    }
    button.danger:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.1);
      border-color: #ef4444;
    }
    button.ghost {
      background: transparent;
      color: #a1a1aa;
      border-color: transparent;
    }
    button.ghost:hover:not(:disabled) {
      background: rgba(255,255,255,0.05);
      color: #fafafa;
    }
  `,
  render({ props }) {
    const p = props as { variant: string; size: string; disabled: boolean };
    return html`<button class="${p.variant} ${p.size}" ${p.disabled ? 'disabled' : ''}>
      <slot></slot>
    </button>`;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const button = shadow.querySelector('button');
      const host = this as unknown as HTMLElement;

      // Forward click events from inner button to host element
      button?.addEventListener('click', () => {
        if (!button.disabled) {
          host.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      });
    });
  },
});

// Input Component
component('bq-input', {
  props: {
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  styles: `
    :host { display: block; }
    input {
      width: 100%;
      padding: 0.625rem 0.875rem;
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 0.875rem;
      color: #fafafa;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      transition: all 0.15s ease;
      outline: none;
    }
    input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    }
    input::placeholder { color: #52525b; }
  `,
  render({ props }) {
    const p = props as { type: string; placeholder: string; value: string };
    return html`<input type="${p.type}" placeholder="${p.placeholder}" value="${p.value}" />`;
  },
});

// Code Block Component
component('bq-code', {
  props: {
    code: { type: String, default: '' },
  },
  styles: `
    :host { display: block; }
    .code-block {
      background: #0a0a0b;
      border-top: 1px solid #1f1f23;
      padding: 1rem 1.5rem;
      overflow-x: auto;
    }
    pre {
      margin: 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8125rem;
      line-height: 1.6;
      color: #a1a1aa;
    }
  `,
  render({ props }) {
    const p = props as { code: string };
    const escaped = p.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    return html`<div class="code-block"><pre>${escaped}</pre></div>`;
  },
});

// Demo Card Component (Container for demos)
component('bq-demo-card', {
  props: {
    title: { type: String, required: true },
    icon: { type: String, default: '◈' },
    wide: { type: Boolean, default: false },
  },
  styles: `
    :host { display: block; }
    .card {
      background: #111113;
      border: 1px solid #27272a;
      border-radius: 1rem;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    .card:hover {
      border-color: rgba(99, 102, 241, 0.3);
      box-shadow: 0 0 40px rgba(99, 102, 241, 0.1);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #1f1f23;
    }
    .icon {
      font-size: 1.25rem;
      color: #6366f1;
    }
    h3 {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
      color: #fafafa;
    }
    .content {
      padding: 1.5rem;
    }
  `,
  render({ props }) {
    const p = props as { title: string; icon: string };
    return html`
      <div class="card">
        <div class="header">
          <span class="icon">${p.icon}</span>
          <h3>${p.title}</h3>
        </div>
        <div class="content">
          <slot></slot>
        </div>
        <slot name="code"></slot>
      </div>
    `;
  },
});

// Section Header Component
component('bq-section-header', {
  props: {
    number: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
  },
  styles: `
    :host { display: block; text-align: center; margin-bottom: 3rem; }
    .tag {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: white;
      margin-bottom: 1rem;
      letter-spacing: 0.05em;
    }
    h2 {
      font-size: 1.875rem;
      font-weight: 700;
      margin: 0 0 0.75rem;
      color: #fafafa;
      letter-spacing: -0.01em;
    }
    p {
      font-size: 1.125rem;
      color: #a1a1aa;
      margin: 0;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
  `,
  render({ props }) {
    const p = props as { number: string; title: string; description: string };
    return html`
      <span class="tag">${p.number}</span>
      <h2>${p.title}</h2>
      <p>${p.description}</p>
    `;
  },
});

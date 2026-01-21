/**
 * Hero Component
 * Landing section with title and stats
 */

import { component, html } from 'bquery';

component('bq-hero', {
  styles: `
    :host { display: block; }
    .hero {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      padding: 5rem 2rem;
      padding-top: calc(5rem + 60px);
      overflow: hidden;
    }
    .bg {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent),
        radial-gradient(ellipse 60% 40% at 80% 60%, rgba(168, 85, 247, 0.1), transparent),
        radial-gradient(ellipse 50% 30% at 20% 80%, rgba(59, 130, 246, 0.08), transparent);
      pointer-events: none;
    }
    .content {
      position: relative;
      text-align: center;
      max-width: 900px;
    }
    .badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #6366f1;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 700;
      line-height: 1.1;
      margin: 0 0 1.5rem;
      letter-spacing: -0.02em;
      color: #fafafa;
    }
    .gradient {
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .subtitle {
      font-size: 1.125rem;
      color: #a1a1aa;
      margin: 0 0 2.5rem;
    }
    .stats {
      display: inline-flex;
      align-items: center;
      gap: 1.5rem;
      padding: 1rem 2rem;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 1rem;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
      color: #fafafa;
    }
    .stat-label {
      font-size: 0.875rem;
      color: #71717a;
    }
    .divider {
      width: 1px;
      height: 40px;
      background: #27272a;
    }
  `,
  render() {
    return html`
      <header class="hero">
        <div class="bg"></div>
        <div class="content">
          <div class="badge">🧩 Component-Based Playground</div>
          <h1>The <span class="gradient">jQuery</span> for the<br />Modern Web Platform</h1>
          <p class="subtitle">
            Zero-build capable • TypeScript-first • Security-focused • Tree-shakeable
          </p>
          <div class="stats">
            <div class="stat">
              <span class="stat-value">~12KB</span>
              <span class="stat-label">gzipped</span>
            </div>
            <div class="divider"></div>
            <div class="stat">
              <span class="stat-value">6</span>
              <span class="stat-label">modules</span>
            </div>
            <div class="divider"></div>
            <div class="stat">
              <span class="stat-value">0</span>
              <span class="stat-label">dependencies</span>
            </div>
          </div>
        </div>
      </header>
    `;
  },
});

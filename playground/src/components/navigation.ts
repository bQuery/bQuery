/**
 * Navigation Component
 * Fixed header with navigation links
 */

import { component, html } from 'bquery';
import { activeSection } from '../state';

component('bq-nav', {
  styles: `
    :host { display: block; }
    nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      background: rgba(10, 10, 11, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid #1f1f23;
    }
    .inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1400px;
      margin: 0 auto;
      padding: 1rem 2rem;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: #fafafa;
    }
    .logo-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      border-radius: 0.5rem;
      font-weight: 700;
      font-size: 0.875rem;
      color: white;
    }
    .logo-text {
      font-weight: 600;
      font-size: 1.125rem;
    }
    .logo-suffix {
      color: #71717a;
      font-weight: 400;
    }
    .links {
      display: flex;
      gap: 0.25rem;
    }
    .nav-link {
      padding: 0.5rem 1rem;
      color: #a1a1aa;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.5rem;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .nav-link:hover {
      color: #fafafa;
      background: #27272a;
    }
    .nav-link.active {
      color: #fafafa;
      background: rgba(99, 102, 241, 0.15);
    }
    .github {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      color: #a1a1aa;
      border-radius: 0.5rem;
      transition: all 0.15s ease;
    }
    .github:hover {
      color: #fafafa;
      background: #27272a;
    }
    @media (max-width: 1024px) {
      .links { display: none; }
    }
  `,
  render() {
    return html`
      <nav>
        <div class="inner">
          <a href="#" class="logo">
            <span class="logo-icon">bQ</span>
            <span class="logo-text">bQuery<span class="logo-suffix">.js</span></span>
          </a>
          <div class="links" id="nav-links">
            <a class="nav-link active" data-section="core">Core</a>
            <a class="nav-link" data-section="reactive">Reactive</a>
            <a class="nav-link" data-section="components">Components</a>
            <a class="nav-link" data-section="motion">Motion</a>
            <a class="nav-link" data-section="security">Security</a>
            <a class="nav-link" data-section="platform">Platform</a>
          </div>
          <a
            href="https://github.com/josunlp/bquery"
            target="_blank"
            rel="noopener noreferrer"
            class="github"
            aria-label="GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
              />
            </svg>
          </a>
        </div>
      </nav>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const links = shadow.querySelectorAll('.nav-link');

      links.forEach((link) => {
        link.addEventListener('click', () => {
          const section = link.getAttribute('data-section');
          if (section) {
            activeSection.value = section;
            links.forEach((l) => l.classList.remove('active'));
            link.classList.add('active');

            // Find section in the playground-app's shadow DOM
            const playgroundApp = document.querySelector('playground-app');
            const targetSection = playgroundApp?.shadowRoot?.getElementById(section);
            targetSection?.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });

      // Update on scroll
      window.addEventListener('scroll', () => {
        const playgroundApp = document.querySelector('playground-app');
        const sections = playgroundApp?.shadowRoot?.querySelectorAll('section[id]');
        if (!sections) return;

        const scrollY = window.scrollY + 150;

        sections.forEach((section) => {
          const el = section as HTMLElement;
          const top = el.offsetTop;
          const height = el.offsetHeight;
          const id = el.getAttribute('id');

          if (scrollY >= top && scrollY < top + height && id) {
            links.forEach((l) => {
              l.classList.toggle('active', l.getAttribute('data-section') === id);
            });
          }
        });
      });
    });
  },
});

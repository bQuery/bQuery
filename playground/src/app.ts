/**
 * Main Application Component
 * The root component that orchestrates the entire playground
 */

import { component, html } from 'bquery';

// Import all component modules
import './components';
import './demos';

// Main App Component
component('playground-app', {
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: #0a0a0b;
      color: #fafafa;
    }
    .main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem 5rem;
    }
    section {
      padding: 5rem 0;
      scroll-margin-top: 100px;
    }
    .demo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 1.5rem;
    }
    .demo-card-wide {
      grid-column: span 2;
    }
    @media (max-width: 768px) {
      .demo-card-wide { grid-column: span 1; }
    }
  `,
  render() {
    return html`
      <bq-nav></bq-nav>
      <bq-hero></bq-hero>

      <main class="main">
        <!-- Core Module -->
        <section id="core">
          <bq-section-header
            number="01"
            title="Core Module"
            description="jQuery-style selectors with modern DOM manipulation, events, and chainable API."
          >
          </bq-section-header>

          <div class="demo-grid">
            <bq-demo-card title="DOM Manipulation" icon="◈">
              <demo-dom></demo-dom>
              <bq-code
                slot="code"
                code="$('#box')
  .toggleClass('active')
  .text('Updated!')
  .data('state', 'ready');"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="CSS Styling" icon="◇">
              <demo-css></demo-css>
              <bq-code
                slot="code"
                code="// Single property
$('#box').css('background', gradient);
$('#box').css('box-shadow', '0 20px 40px rgba(99, 102, 241, 0.3)');

// Multiple properties (object syntax)
$('#box').css({
  'background': '#6366f1',
  'border-radius': '50%',
  'transform': 'scale(1.1) rotate(45deg)',
});"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Event Handling" icon="⚡">
              <demo-events></demo-events>
              <bq-code
                slot="code"
                code="$('#box')
  .on('click', handleClick)
  .on('mouseenter', handleHover);"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Collections" icon="❖">
              <demo-collection></demo-collection>
              <bq-code
                slot="code"
                code="$$('.items')
  .addClass('highlight')
  .css({ opacity: '0.9' });"
              ></bq-code>
            </bq-demo-card>
          </div>
        </section>

        <!-- Reactive Module -->
        <section id="reactive">
          <bq-section-header
            number="02"
            title="Reactive Module"
            description="Fine-grained reactivity with signals, computed values, effects, and batching."
          >
          </bq-section-header>

          <div class="demo-grid">
            <bq-demo-card class="demo-card-wide" title="Signals & Computed" icon="◎">
              <demo-signals></demo-signals>
              <bq-code
                slot="code"
                code="const count = signal(0);
const doubled = computed(() => count.value * 2);
effect(() => $('#counter').text(count.value));"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Effects & Cleanup" icon="↻">
              <demo-effect></demo-effect>
              <bq-code
                slot="code"
                code="effect(() => {
  const hue = hueSignal.value;
  box.style.background = \`hsl(\${hue}, 70%, 50%)\`;

  // Optional cleanup function
  return () => console.log('Cleanup!');
});"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Batch Updates" icon="⊞">
              <demo-batch></demo-batch>
              <bq-code
                slot="code"
                code="// Without batch: 3 renders
x.value = 10; y.value = 20; z.value = 30;

// With batch: 1 render!
batch(() => {
  x.value = 10;
  y.value = 20;
  z.value = 30;
});"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Persisted Signals" icon="💾">
              <demo-persisted></demo-persisted>
              <bq-code
                slot="code"
                code="// Value persists across page reloads
const theme = persistedSignal('theme', 'dark');

// Works like a regular signal
theme.value = 'light'; // Saved to localStorage"
              ></bq-code>
            </bq-demo-card>
          </div>
        </section>

        <!-- Components Module -->
        <section id="components">
          <bq-section-header
            number="03"
            title="Components Module"
            description="Lightweight Web Components with type-safe props, scoped styles, and lifecycle hooks."
          >
          </bq-section-header>

          <div class="demo-grid">
            <bq-demo-card class="demo-card-wide" title="Web Components" icon="□">
              <demo-components></demo-components>
              <bq-code
                slot="code"
                code="component('bq-counter', {
  props: { initial: { type: Number, default: 0 } },
  render({ props }) {
    return html\`<button>\${props.initial}</button>\`;
  }
});"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Dynamic Props" icon="⚙">
              <demo-avatar-props></demo-avatar-props>
              <bq-code
                slot="code"
                code='<bq-avatar
  name="Alex Dev"
  status="online">
</bq-avatar>'
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Status Badges" icon="▣">
              <demo-badges></demo-badges>
              <bq-code
                slot="code"
                code='<!-- Basic Usage -->
<bq-badge status="success">Deployed</bq-badge>
<bq-badge status="error">Failed</bq-badge>

<!-- With Size -->
<bq-badge status="info" size="lg">Large</bq-badge>

<!-- With Icon & Pulse -->
<bq-badge status="success" icon="✓" pulse="true">
  Live
</bq-badge>'
              ></bq-code>
            </bq-demo-card>
          </div>
        </section>

        <!-- Motion Module -->
        <section id="motion">
          <bq-section-header
            number="04"
            title="Motion Module"
            description="View transitions, FLIP animations, and spring physics for smooth motion."
          >
          </bq-section-header>

          <div class="demo-grid">
            <bq-demo-card class="demo-card-wide" title="FLIP Animations" icon="↔">
              <demo-flip></demo-flip>
              <bq-code
                slot="code"
                code="await flipList(items, () => {
  container.append(container.firstChild);
}, { duration: 300 });"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Spring Physics" icon="〰">
              <demo-spring></demo-spring>
              <bq-code
                slot="code"
                code="const x = spring(0, {
  stiffness: 120,
  damping: 14
});
await x.to(100);"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="View Transitions" icon="◐">
              <demo-transition></demo-transition>
              <bq-code
                slot="code"
                code="// Click a card to expand with smooth transition
await transition(() => {
  detailView.classList.add('active');
  cardsWrapper.classList.add('hidden');
});

// CSS: view-transition-name: icon-light;
// enables morphing elements across states"
              ></bq-code>
            </bq-demo-card>
          </div>
        </section>

        <!-- Security Module -->
        <section id="security">
          <bq-section-header
            number="05"
            title="Security Module"
            description="Built-in HTML sanitization, XSS protection, and Trusted Types support."
          >
          </bq-section-header>

          <div class="demo-grid">
            <bq-demo-card class="demo-card-wide" title="HTML Sanitization" icon="🛡">
              <demo-sanitize></demo-sanitize>
              <bq-code
                slot="code"
                code="const safe = sanitize(userInput);
const escaped = escapeHtml('<script>');"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Trusted Types" icon="✓">
              <demo-trusted></demo-trusted>
              <bq-code
                slot="code"
                code="const policy = getTrustedTypesPolicy();
const html = createTrustedHtml(content);"
              ></bq-code>
            </bq-demo-card>
          </div>
        </section>

        <!-- Platform Module -->
        <section id="platform">
          <bq-section-header
            number="06"
            title="Platform Module"
            description="Unified APIs for storage, caching, notifications, and more."
          >
          </bq-section-header>

          <div class="demo-grid">
            <bq-demo-card title="Unified Storage" icon="💾">
              <demo-storage></demo-storage>
              <bq-code
                slot="code"
                code="const local = storage.local();
await local.set('key', value);
const data = await local.get('key');"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Notifications" icon="🔔">
              <demo-notifications></demo-notifications>
              <bq-code
                slot="code"
                code="await notifications.requestPermission();
notifications.send('Title', {
  body: 'Message body'
});"
              ></bq-code>
            </bq-demo-card>

            <bq-demo-card title="Persisted State" icon="🎨">
              <demo-theme-picker></demo-theme-picker>
              <bq-code
                slot="code"
                code="const theme = persistedSignal('theme', 'dark');
effect(() => applyTheme(theme.value));"
              ></bq-code>
            </bq-demo-card>
          </div>
        </section>
      </main>

      <bq-footer></bq-footer>
    `;
  },
});

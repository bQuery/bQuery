/**
 * Reactive Module Demos
 * Demonstrates signals, computed values, effects, batching, and persisted signals
 */

import { batch, component, computed, effect, html, persistedSignal, signal } from 'bquery';

// Helper for shared styles
const sharedStyles = `
  .label {
    font-size: 0.75rem;
    color: #71717a;
    font-family: 'JetBrains Mono', monospace;
  }
  .value {
    font-size: 1.875rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: #fafafa;
  }
  .controls {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
`;

// Signals Demo Component - Demonstrates signals and computed values
component('demo-signals', {
  styles: `
    :host { display: block; }
    ${sharedStyles}
    .display {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .group {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem 1.5rem;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.75rem;
      min-width: 100px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .group:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .group.computed {
      background: rgba(99, 102, 241, 0.1);
      border-color: rgba(99, 102, 241, 0.3);
    }
    .group .label { margin-bottom: 0.5rem; }
    .arrow {
      font-size: 1.25rem;
      color: #52525b;
    }
    .value.updated {
      animation: pulse 0.3s ease;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.15); color: #6366f1; }
      100% { transform: scale(1); }
    }
  `,
  render() {
    return html`
      <div class="display">
        <div class="group">
          <span class="label">count</span>
          <span class="value" id="val-count">0</span>
        </div>
        <span class="arrow">→</span>
        <div class="group computed">
          <span class="label">doubled</span>
          <span class="value" id="val-doubled">0</span>
        </div>
        <span class="arrow">→</span>
        <div class="group computed">
          <span class="label">squared</span>
          <span class="value" id="val-squared">0</span>
        </div>
      </div>
      <div class="controls">
        <bq-button size="lg" id="btn-dec">−</bq-button>
        <bq-button variant="primary" size="lg" id="btn-inc">+</bq-button>
        <bq-button size="lg" id="btn-reset">Reset</bq-button>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;

      // Create reactive signals
      const count = signal(0);
      const doubled = computed(() => count.value * 2);
      const squared = computed(() => count.value ** 2);

      // Cache DOM elements for performance
      const valCountEl = shadow.getElementById('val-count')!;
      const valDoubledEl = shadow.getElementById('val-doubled')!;
      const valSquaredEl = shadow.getElementById('val-squared')!;

      // Helper to animate value updates
      const animateUpdate = (el: HTMLElement) => {
        el.classList.remove('updated');
        void el.offsetWidth; // Force reflow
        el.classList.add('updated');
      };

      // Effect automatically re-runs when dependencies change
      effect(() => {
        valCountEl.textContent = count.value.toString();
        valDoubledEl.textContent = doubled.value.toString();
        valSquaredEl.textContent = squared.value.toString();

        // Animate on update
        animateUpdate(valCountEl);
        animateUpdate(valDoubledEl);
        animateUpdate(valSquaredEl);
      });

      // Event handlers using signal's value property
      shadow.getElementById('btn-inc')?.addEventListener('click', () => {
        count.value++;
      });

      shadow.getElementById('btn-dec')?.addEventListener('click', () => {
        count.value--;
      });

      shadow.getElementById('btn-reset')?.addEventListener('click', () => {
        count.value = 0;
      });
    });
  },
});

// Effect Demo Component - Demonstrates reactive effects with cleanup
component('demo-effect', {
  styles: `
    :host { display: block; }
    ${sharedStyles}
    .preview {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .color-box {
      min-height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, hsl(135, 70%, 50%), hsl(165, 70%, 40%));
      border-radius: 0.75rem;
      transition: background 0.2s ease, transform 0.2s ease;
    }
    .color-box:hover {
      transform: scale(1.02);
    }
    .color-label {
      font-weight: 600;
      color: white;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      font-family: 'JetBrains Mono', monospace;
    }
    .slider-container {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    input[type="range"] {
      width: 100%;
      height: 8px;
      -webkit-appearance: none;
      appearance: none;
      background: #27272a;
      border-radius: 9999px;
      outline: none;
      cursor: pointer;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      background: #6366f1;
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    input[type="range"]::-webkit-slider-thumb:hover {
      transform: scale(1.2);
      box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
    }
    .stats {
      display: flex;
      justify-content: center;
      gap: 2rem;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #fafafa;
      font-family: 'JetBrains Mono', monospace;
    }
    .stat-label {
      font-size: 0.7rem;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `,
  render() {
    return html`
      <div class="preview">
        <div class="color-box" id="effect-box">
          <span class="color-label">Hue: <span id="hue-value">135</span>°</span>
        </div>
        <div class="slider-container">
          <input type="range" id="hue-slider" min="0" max="360" value="135" />
        </div>
      </div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value" id="effect-runs">0</div>
          <div class="stat-label">Effect Runs</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="cleanup-runs">0</div>
          <div class="stat-label">Cleanups</div>
        </div>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;

      // Cache DOM elements
      const box = shadow.getElementById('effect-box') as HTMLElement;
      const slider = shadow.getElementById('hue-slider') as HTMLInputElement;
      const hueValueEl = shadow.getElementById('hue-value')!;
      const effectRunsEl = shadow.getElementById('effect-runs')!;
      const cleanupRunsEl = shadow.getElementById('cleanup-runs')!;

      // Reactive state
      const hue = signal(135);
      let effectRuns = 0;
      let cleanupRuns = 0;

      // Effect with cleanup demonstration
      effect(() => {
        const hueValue = hue.value;
        effectRuns++;

        // Update UI
        box.style.background = `linear-gradient(135deg, hsl(${hueValue}, 70%, 50%), hsl(${hueValue + 30}, 70%, 40%))`;
        hueValueEl.textContent = hueValue.toString();
        effectRunsEl.textContent = effectRuns.toString();

        // Return cleanup function - runs before next effect or on disposal
        return () => {
          cleanupRuns++;
          cleanupRunsEl.textContent = cleanupRuns.toString();
        };
      });

      // Sync slider with signal
      slider.addEventListener('input', () => {
        hue.value = parseInt(slider.value);
      });
    });
  },
});

// Batch Demo Component - Demonstrates batched updates for performance
component('demo-batch', {
  styles: `
    :host { display: block; }
    ${sharedStyles}
    .values {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.75rem 1.25rem;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      min-width: 70px;
      transition: border-color 0.2s ease, background 0.2s ease;
    }
    .item.flash {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.1);
    }
    .item .label { margin-bottom: 0.25rem; }
    .val {
      font-size: 1.25rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: #fafafa;
    }
    .comparison {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: #18181b;
      border-radius: 0.75rem;
    }
    .comparison-item {
      text-align: center;
    }
    .comparison-value {
      font-size: 2rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    .comparison-value.bad { color: #ef4444; }
    .comparison-value.good { color: #22c55e; }
    .comparison-label {
      font-size: 0.7rem;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 0.25rem;
    }
  `,
  render() {
    return html`
      <div class="values">
        <div class="item" id="item-x">
          <span class="label">x</span><span class="val" id="val-x">0</span>
        </div>
        <div class="item" id="item-y">
          <span class="label">y</span><span class="val" id="val-y">0</span>
        </div>
        <div class="item" id="item-z">
          <span class="label">z</span><span class="val" id="val-z">0</span>
        </div>
      </div>
      <div class="comparison">
        <div class="comparison-item">
          <div class="comparison-value bad" id="unbatched-renders">0</div>
          <div class="comparison-label">Unbatched Renders</div>
        </div>
        <div class="comparison-item">
          <div class="comparison-value good" id="batched-renders">0</div>
          <div class="comparison-label">Batched Renders</div>
        </div>
      </div>
      <div class="controls">
        <bq-button variant="danger" size="sm" id="btn-no-batch">Update (3 renders)</bq-button>
        <bq-button variant="primary" size="sm" id="btn-batch">Update (1 render)</bq-button>
        <bq-button size="sm" id="btn-reset">Reset</bq-button>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;

      // Cache DOM elements
      const valXEl = shadow.getElementById('val-x')!;
      const valYEl = shadow.getElementById('val-y')!;
      const valZEl = shadow.getElementById('val-z')!;
      const itemX = shadow.getElementById('item-x')!;
      const itemY = shadow.getElementById('item-y')!;
      const itemZ = shadow.getElementById('item-z')!;
      const unbatchedRendersEl = shadow.getElementById('unbatched-renders')!;
      const batchedRendersEl = shadow.getElementById('batched-renders')!;

      // Reactive state
      const x = signal(0);
      const y = signal(0);
      const z = signal(0);

      let totalUnbatched = 0;
      let totalBatched = 0;
      let currentRenders = 0;

      // Flash animation helper
      const flash = (el: HTMLElement) => {
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 300);
      };

      // Effect that tracks all values
      effect(() => {
        // Access all values to create dependencies
        const xVal = x.value;
        const yVal = y.value;
        const zVal = z.value;
        currentRenders++;

        // Update display
        valXEl.textContent = xVal.toString();
        valYEl.textContent = yVal.toString();
        valZEl.textContent = zVal.toString();

        // Flash items to visualize updates
        flash(itemX);
        flash(itemY);
        flash(itemZ);
      });

      // Unbatched updates - causes 3 separate effect runs
      shadow.getElementById('btn-no-batch')?.addEventListener('click', () => {
        currentRenders = 0;

        x.value = Math.floor(Math.random() * 100);
        y.value = Math.floor(Math.random() * 100);
        z.value = Math.floor(Math.random() * 100);

        totalUnbatched += currentRenders;
        unbatchedRendersEl.textContent = totalUnbatched.toString();
      });

      // Batched updates - only 1 effect run
      shadow.getElementById('btn-batch')?.addEventListener('click', () => {
        currentRenders = 0;

        batch(() => {
          x.value = Math.floor(Math.random() * 100);
          y.value = Math.floor(Math.random() * 100);
          z.value = Math.floor(Math.random() * 100);
        });

        totalBatched += currentRenders;
        batchedRendersEl.textContent = totalBatched.toString();
      });

      // Reset
      shadow.getElementById('btn-reset')?.addEventListener('click', () => {
        batch(() => {
          x.value = 0;
          y.value = 0;
          z.value = 0;
        });
        totalUnbatched = 0;
        totalBatched = 0;
        unbatchedRendersEl.textContent = '0';
        batchedRendersEl.textContent = '0';
      });
    });
  },
});

// Persisted Signal Demo Component - Demonstrates localStorage persistence
component('demo-persisted', {
  styles: `
    :host { display: block; }
    ${sharedStyles}
    .theme-preview {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .theme-card {
      flex: 1;
      padding: 1.5rem;
      border-radius: 0.75rem;
      text-align: center;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      border: 2px solid transparent;
    }
    .theme-card:hover {
      transform: translateY(-2px);
    }
    .theme-card.selected {
      border-color: #6366f1;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
    }
    .theme-card.light {
      background: #f4f4f5;
      color: #18181b;
    }
    .theme-card.dark {
      background: #18181b;
      color: #fafafa;
      border-color: #27272a;
    }
    .theme-card.auto {
      background: linear-gradient(135deg, #f4f4f5 50%, #18181b 50%);
      color: #71717a;
    }
    .theme-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .theme-name {
      font-weight: 600;
      font-size: 0.875rem;
    }
    .persistence-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 0.5rem;
      font-size: 0.8rem;
      color: #22c55e;
    }
    .persistence-icon {
      font-size: 1rem;
    }
  `,
  render() {
    return html`
      <div class="theme-preview">
        <div class="theme-card light" id="theme-light" data-theme="light">
          <div class="theme-icon">☀️</div>
          <div class="theme-name">Light</div>
        </div>
        <div class="theme-card dark" id="theme-dark" data-theme="dark">
          <div class="theme-icon">🌙</div>
          <div class="theme-name">Dark</div>
        </div>
        <div class="theme-card auto" id="theme-auto" data-theme="auto">
          <div class="theme-icon">🔄</div>
          <div class="theme-name">Auto</div>
        </div>
      </div>
      <div class="persistence-info">
        <span class="persistence-icon">💾</span>
        <span
          >Selected: <strong id="current-theme">dark</strong> — Persists across page reloads!</span
        >
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;

      // Cache DOM elements
      const themeCards = {
        light: shadow.getElementById('theme-light')!,
        dark: shadow.getElementById('theme-dark')!,
        auto: shadow.getElementById('theme-auto')!,
      };
      const currentThemeEl = shadow.getElementById('current-theme')!;

      // Persisted signal - value survives page reloads
      const theme = persistedSignal<'light' | 'dark' | 'auto'>('bquery-demo-theme', 'dark');

      // Update UI based on theme
      const updateUI = (selectedTheme: string) => {
        // Remove selected from all
        Object.values(themeCards).forEach((card) => card.classList.remove('selected'));
        // Add selected to current
        themeCards[selectedTheme as keyof typeof themeCards]?.classList.add('selected');
        currentThemeEl.textContent = selectedTheme;
      };

      // Effect to sync UI with signal
      effect(() => {
        updateUI(theme.value);
      });

      // Click handlers for theme cards
      Object.entries(themeCards).forEach(([themeName, card]) => {
        card.addEventListener('click', () => {
          theme.value = themeName as 'light' | 'dark' | 'auto';
        });
      });
    });
  },
});

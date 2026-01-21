/**
 * Motion Module Demos
 * Demonstrates FLIP animations, spring physics, and view transitions
 */

import { component, flipList, html, spring, transition } from 'bquery';

// FLIP Demo Component
component('demo-flip', {
  styles: `
    :host { display: block; }
    .container {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
      justify-content: center;
    }
    .item {
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      border-radius: 0.5rem;
      font-weight: 700;
      font-size: 1.25rem;
      color: white;
      cursor: pointer;
      transition: box-shadow 0.2s ease;
    }
    .item:hover {
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
    }
    .controls { display: flex; justify-content: center; gap: 0.5rem; }
  `,
  render() {
    return html`
      <div class="container" id="flip-container">
        <div class="item" data-id="1">1</div>
        <div class="item" data-id="2">2</div>
        <div class="item" data-id="3">3</div>
        <div class="item" data-id="4">4</div>
        <div class="item" data-id="5">5</div>
      </div>
      <div class="controls">
        <bq-button size="sm" id="btn-shuffle">Shuffle</bq-button>
        <bq-button size="sm" id="btn-reverse">Reverse</bq-button>
        <bq-button size="sm" id="btn-sort">Sort</bq-button>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const container = shadow.getElementById('flip-container')!;

      shadow.getElementById('btn-shuffle')?.addEventListener('click', async () => {
        const items = Array.from(container.children) as HTMLElement[];
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        await flipList(
          items,
          () => {
            shuffled.forEach((item) => container.appendChild(item));
          },
          { duration: 400 }
        );
      });

      shadow.getElementById('btn-reverse')?.addEventListener('click', async () => {
        const items = Array.from(container.children) as HTMLElement[];
        await flipList(
          items,
          () => {
            items.reverse().forEach((item) => container.appendChild(item));
          },
          { duration: 300 }
        );
      });

      shadow.getElementById('btn-sort')?.addEventListener('click', async () => {
        const items = Array.from(container.children) as HTMLElement[];
        await flipList(
          items,
          () => {
            const sorted = [...items].sort(
              (a, b) => parseInt(a.dataset.id || '0') - parseInt(b.dataset.id || '0')
            );
            sorted.forEach((item) => container.appendChild(item));
          },
          { duration: 300 }
        );
      });
    });
  },
});

// Spring Demo Component
component('demo-spring', {
  styles: `
    :host { display: block; }
    .track {
      height: 60px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.75rem;
      position: relative;
      margin-bottom: 1rem;
      padding: 0.5rem;
      overflow: hidden;
    }
    .ball {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      border-radius: 50%;
      position: absolute;
      top: 50%;
      left: 0.5rem;
      transform: translateY(-50%);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
      will-change: transform;
    }
    .sliders {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .slider-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
      color: #a1a1aa;
    }
    .slider-value {
      font-weight: 600;
      color: #6366f1;
      min-width: 2.5rem;
      text-align: right;
    }
    input[type="range"] {
      width: 100%;
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: #27272a;
      border-radius: 9999px;
      outline: none;
      cursor: pointer;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      background: #6366f1;
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.15s ease;
    }
    input[type="range"]::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }
    .controls {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .presets {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .preset-btn {
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
      background: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 0.375rem;
      color: #a1a1aa;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .preset-btn:hover {
      background: #3f3f46;
      color: #e4e4e7;
    }
    .preset-btn.active {
      background: #6366f1;
      border-color: #6366f1;
      color: white;
    }
  `,
  render() {
    return html`
      <div class="track">
        <div class="ball" id="spring-ball"></div>
      </div>
      <div class="presets">
        <button class="preset-btn" data-preset="gentle">Gentle</button>
        <button class="preset-btn active" data-preset="default">Default</button>
        <button class="preset-btn" data-preset="snappy">Snappy</button>
        <button class="preset-btn" data-preset="bouncy">Bouncy</button>
        <button class="preset-btn" data-preset="stiff">Stiff</button>
      </div>
      <div class="sliders">
        <div class="slider-group">
          <div class="slider-header">
            <span>Stiffness</span>
            <span class="slider-value" id="stiffness-value">120</span>
          </div>
          <input type="range" id="stiffness" min="50" max="400" value="120" />
        </div>
        <div class="slider-group">
          <div class="slider-header">
            <span>Damping</span>
            <span class="slider-value" id="damping-value">14</span>
          </div>
          <input type="range" id="damping" min="1" max="40" value="14" />
        </div>
      </div>
      <div class="controls">
        <bq-button variant="primary" size="sm" id="btn-animate">Animate</bq-button>
        <bq-button variant="secondary" size="sm" id="btn-reset">Reset</bq-button>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const ball = shadow.getElementById('spring-ball') as HTMLElement;
      const stiffnessInput = shadow.getElementById('stiffness') as HTMLInputElement;
      const dampingInput = shadow.getElementById('damping') as HTMLInputElement;
      const stiffnessValue = shadow.getElementById('stiffness-value')!;
      const dampingValue = shadow.getElementById('damping-value')!;

      // Spring presets matching the library's springPresets
      const presets: Record<string, { stiffness: number; damping: number }> = {
        gentle: { stiffness: 80, damping: 15 },
        default: { stiffness: 120, damping: 14 },
        snappy: { stiffness: 200, damping: 20 },
        bouncy: { stiffness: 300, damping: 8 },
        stiff: { stiffness: 400, damping: 30 },
      };

      // Track current position and active spring
      let currentX = 0;
      let activeSpring: ReturnType<typeof spring> | null = null;
      const maxX = 240;

      // Update slider value displays
      const updateSliderDisplays = () => {
        stiffnessValue.textContent = stiffnessInput.value;
        dampingValue.textContent = dampingInput.value;
      };

      // Clear active preset highlight when manually adjusting sliders
      const clearActivePreset = () => {
        shadow.querySelectorAll('.preset-btn').forEach((btn) => {
          btn.classList.remove('active');
        });
      };

      stiffnessInput.addEventListener('input', () => {
        updateSliderDisplays();
        clearActivePreset();
      });

      dampingInput.addEventListener('input', () => {
        updateSliderDisplays();
        clearActivePreset();
      });

      // Handle preset buttons
      shadow.querySelectorAll('.preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const presetName = (btn as HTMLElement).dataset.preset;
          if (!presetName || !presets[presetName]) return;

          const preset = presets[presetName];
          stiffnessInput.value = String(preset.stiffness);
          dampingInput.value = String(preset.damping);
          updateSliderDisplays();

          // Update active state
          shadow.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      // Animate button
      shadow.getElementById('btn-animate')?.addEventListener('click', async () => {
        // Stop any running animation
        activeSpring?.stop();

        const stiffness = parseInt(stiffnessInput.value);
        const damping = parseInt(dampingInput.value);

        // Toggle target position
        const targetX = currentX < maxX / 2 ? maxX : 0;

        // Create spring starting from current position
        activeSpring = spring(currentX, { stiffness, damping });

        activeSpring.onChange((value) => {
          currentX = value;
          ball.style.transform = `translateY(-50%) translateX(${value}px)`;
        });

        await activeSpring.to(targetX);
      });

      // Reset button
      shadow.getElementById('btn-reset')?.addEventListener('click', () => {
        activeSpring?.stop();
        currentX = 0;
        ball.style.transform = 'translateY(-50%) translateX(0px)';
      });
    });
  },
});

// Transition Demo Component
component('demo-transition', {
  styles: `
    :host { display: block; }

    /* View Transition support styles */
    .transition-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .cards-wrapper {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      min-height: 140px;
    }

    .card {
      padding: 1rem;
      border-radius: 0.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }

    .card.light {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      color: #78350f;
    }

    .card.dark {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      color: #e0e7ff;
    }

    .card.accent {
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      color: white;
    }

    .card-icon {
      font-size: 1.75rem;
      view-transition-name: card-icon;
    }

    .card-label {
      font-size: 0.875rem;
      font-weight: 600;
    }

    /* Detail view when a card is selected */
    .detail-view {
      display: none;
      flex-direction: column;
      gap: 1rem;
    }

    .detail-view.active {
      display: flex;
    }

    .cards-wrapper.hidden {
      display: none;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      border-radius: 0.75rem;
      background: #18181b;
      border: 1px solid #27272a;
    }

    .detail-icon {
      font-size: 2.5rem;
      view-transition-name: detail-icon;
    }

    .detail-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .detail-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fafafa;
    }

    .detail-desc {
      font-size: 0.875rem;
      color: #a1a1aa;
    }

    .detail-content {
      padding: 1rem;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      color: #a1a1aa;
      line-height: 1.6;
    }

    .controls {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    /* View Transition names for smooth morphing */
    .card[data-id="light"] .card-icon,
    .detail-view[data-active="light"] .detail-icon {
      view-transition-name: icon-light;
    }

    .card[data-id="dark"] .card-icon,
    .detail-view[data-active="dark"] .detail-icon {
      view-transition-name: icon-dark;
    }

    .card[data-id="accent"] .card-icon,
    .detail-view[data-active="accent"] .detail-icon {
      view-transition-name: icon-accent;
    }

    /* View Transition animations */
    @keyframes fade-in {
      from { opacity: 0; }
    }

    @keyframes fade-out {
      to { opacity: 0; }
    }

    @keyframes slide-from-right {
      from { transform: translateX(30px); opacity: 0; }
    }

    @keyframes slide-to-left {
      to { transform: translateX(-30px); opacity: 0; }
    }

    ::view-transition-old(detail-content) {
      animation: 180ms ease-out both fade-out;
    }

    ::view-transition-new(detail-content) {
      animation: 180ms ease-in 90ms both fade-in;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: #27272a;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      color: #a1a1aa;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
    }

    .status-dot.unsupported {
      background: #f59e0b;
    }
  `,
  render() {
    return html`
      <div class="transition-container">
        <div class="status-indicator">
          <span class="status-dot" id="status-dot"></span>
          <span id="status-text">View Transitions API</span>
        </div>

        <div class="cards-wrapper" id="cards-wrapper">
          <div class="card light" data-id="light">
            <span class="card-icon">☀️</span>
            <span class="card-label">Light</span>
          </div>
          <div class="card dark" data-id="dark">
            <span class="card-icon">🌙</span>
            <span class="card-label">Dark</span>
          </div>
          <div class="card accent" data-id="accent">
            <span class="card-icon">✨</span>
            <span class="card-label">Accent</span>
          </div>
        </div>

        <div class="detail-view" id="detail-view">
          <div class="detail-header">
            <span class="detail-icon" id="detail-icon"></span>
            <div class="detail-info">
              <span class="detail-title" id="detail-title"></span>
              <span class="detail-desc" id="detail-desc"></span>
            </div>
          </div>
          <div class="detail-content" id="detail-content"></div>
        </div>

        <div class="controls">
          <bq-button variant="primary" size="sm" id="btn-back" style="display: none;">
            ← Back
          </bq-button>
          <bq-button variant="secondary" size="sm" id="btn-cycle"> Cycle All </bq-button>
        </div>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const cardsWrapper = shadow.getElementById('cards-wrapper')!;
      const detailView = shadow.getElementById('detail-view')!;
      const detailIcon = shadow.getElementById('detail-icon')!;
      const detailTitle = shadow.getElementById('detail-title')!;
      const detailDesc = shadow.getElementById('detail-desc')!;
      const detailContent = shadow.getElementById('detail-content')!;
      const btnBack = shadow.getElementById('btn-back') as HTMLElement;
      const btnCycle = shadow.getElementById('btn-cycle') as HTMLElement;
      const statusDot = shadow.getElementById('status-dot')!;
      const statusText = shadow.getElementById('status-text')!;

      // Check for View Transitions API support
      const supportsViewTransitions = 'startViewTransition' in document;
      if (!supportsViewTransitions) {
        statusDot.classList.add('unsupported');
        statusText.textContent = 'View Transitions (Fallback Mode)';
      } else {
        statusText.textContent = 'View Transitions API ✓';
      }

      // Card data for detail view
      const cardData: Record<
        string,
        { icon: string; title: string; desc: string; content: string }
      > = {
        light: {
          icon: '☀️',
          title: 'Light Theme',
          desc: 'Bright and clean interface',
          content:
            'The light theme provides optimal readability in well-lit environments. It uses warm amber tones to create a welcoming, approachable feel while maintaining strong contrast for text legibility.',
        },
        dark: {
          icon: '🌙',
          title: 'Dark Theme',
          desc: 'Easy on the eyes',
          content:
            'The dark theme reduces eye strain in low-light conditions and saves battery on OLED displays. Deep indigo gradients create depth while maintaining visual hierarchy and accessibility.',
        },
        accent: {
          icon: '✨',
          title: 'Accent Theme',
          desc: 'Bold and vibrant',
          content:
            'The accent theme uses vibrant purple-to-indigo gradients to create an energetic, modern aesthetic. Perfect for highlighting important content or creating memorable brand experiences.',
        },
      };

      // Show detail view for a card
      const showDetail = async (cardId: string) => {
        const data = cardData[cardId];
        if (!data) return;

        await transition(() => {
          detailView.dataset.active = cardId;
          detailIcon.textContent = data.icon;
          detailTitle.textContent = data.title;
          detailDesc.textContent = data.desc;
          detailContent.textContent = data.content;

          cardsWrapper.classList.add('hidden');
          detailView.classList.add('active');
          btnBack.style.display = 'inline-flex';
          btnCycle.style.display = 'none';
        });
      };

      // Go back to cards view
      const showCards = async () => {
        await transition(() => {
          detailView.dataset.active = '';
          cardsWrapper.classList.remove('hidden');
          detailView.classList.remove('active');
          btnBack.style.display = 'none';
          btnCycle.style.display = 'inline-flex';
        });
      };

      // Handle card clicks
      shadow.querySelectorAll('.card').forEach((card) => {
        card.addEventListener('click', () => {
          const cardId = (card as HTMLElement).dataset.id;
          if (cardId) showDetail(cardId);
        });
      });

      // Back button
      btnBack.addEventListener('click', showCards);

      // Cycle through all cards automatically
      btnCycle.addEventListener('click', async () => {
        const cards = ['light', 'dark', 'accent'];
        for (const cardId of cards) {
          await showDetail(cardId);
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
        await showCards();
      });
    });
  },
});

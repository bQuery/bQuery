/**
 * Core Module Demos
 * Demonstrates DOM manipulation, CSS styling, events, and collections
 * using bQuery's chainable API
 */

import { $, $$, component, html } from 'bquery';

// DOM Demo Component - demonstrates bQuery's chainable DOM manipulation
component('demo-dom', {
  styles: `
    :host { display: block; }
    .box {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.75rem;
      margin-bottom: 1rem;
      transition: all 0.2s ease;
      padding: 1rem;
      text-align: center;
    }
    .box.active {
      background: rgba(99, 102, 241, 0.15);
      border-color: #6366f1;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
    }
    .box[data-state="ready"] { border-left: 3px solid #22c55e; }
    .box[data-state="loading"] { border-left: 3px solid #eab308; }
    .box[data-state="success"] { border-left: 3px solid #6366f1; }
    .box[data-state="error"] { border-left: 3px solid #ef4444; }
    .state-badge {
      font-size: 0.65rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255,255,255,0.1);
      margin-left: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
  render() {
    return html`
      <div class="box" id="dom-box">
        <span id="box-text">Click the buttons below</span>
        <span class="state-badge" id="state-badge" style="display: none;"></span>
      </div>
      <div class="controls">
        <bq-button size="sm" id="btn-toggle">Toggle Class</bq-button>
        <bq-button size="sm" id="btn-text">Change Text</bq-button>
        <bq-button size="sm" id="btn-attr">Set Data Attr</bq-button>
        <bq-button variant="danger" size="sm" id="btn-reset">Reset</bq-button>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;

      // Wrap shadow DOM elements with bQuery's $ for chainable API
      const $box = $(shadow.getElementById('dom-box')!);
      const $text = $(shadow.getElementById('box-text')!);
      const $badge = $(shadow.getElementById('state-badge')!);

      const texts = ['Hello bQuery!', 'DOM is easy!', 'Chainable API ✨', 'Modern & Clean'];
      let textIdx = 0;

      const states = ['ready', 'loading', 'success', 'error'];
      let stateIdx = 0;

      // Toggle Class - demonstrates toggleClass()
      shadow.getElementById('btn-toggle')?.addEventListener('click', () => {
        $box.toggleClass('active');
      });

      // Change Text - demonstrates text() method
      shadow.getElementById('btn-text')?.addEventListener('click', () => {
        textIdx = (textIdx + 1) % texts.length;
        $text.text(texts[textIdx]);
      });

      // Set Data Attribute - demonstrates data() and attr() methods
      shadow.getElementById('btn-attr')?.addEventListener('click', () => {
        stateIdx = (stateIdx + 1) % states.length;
        const state = states[stateIdx];

        // Using bQuery's chainable API
        $box.data('state', state);
        $box.attr('title', `State: ${state}`);

        $badge.text(state);
        $badge.css('display', 'inline');
      });

      // Reset - demonstrates removeClass(), text(), css()
      shadow.getElementById('btn-reset')?.addEventListener('click', () => {
        $box.removeClass('active');
        $box.attr('data-state', '');
        $box.attr('title', '');

        $text.text('Click the buttons below');
        $badge.css('display', 'none');

        textIdx = 0;
        stateIdx = 0;
      });
    });
  },
});

// CSS Demo Component - demonstrates bQuery's css() method
component('demo-css', {
  styles: `
    :host { display: block; }
    .box {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 120px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.75rem;
      margin-bottom: 1rem;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      font-weight: 600;
      position: relative;
      overflow: hidden;
    }
    .box-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      z-index: 1;
    }
    .box-label {
      font-size: 0.875rem;
      color: #fafafa;
    }
    .style-info {
      font-size: 0.65rem;
      font-family: 'JetBrains Mono', monospace;
      color: #71717a;
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .control-group {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.5rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 0.5rem;
      border: 1px solid #1f1f23;
    }
    .control-label {
      width: 100%;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #52525b;
      margin-bottom: 0.25rem;
    }
    .active-indicator {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      display: flex;
      gap: 0.25rem;
    }
    .indicator-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #27272a;
      transition: background 0.2s ease;
    }
    .indicator-dot.active {
      background: #6366f1;
      box-shadow: 0 0 6px rgba(99, 102, 241, 0.5);
    }
  `,
  render() {
    return html`
      <div class="box" id="css-box">
        <div class="active-indicator">
          <div class="indicator-dot" id="ind-color" title="Color"></div>
          <div class="indicator-dot" id="ind-shadow" title="Shadow"></div>
          <div class="indicator-dot" id="ind-radius" title="Radius"></div>
          <div class="indicator-dot" id="ind-transform" title="Transform"></div>
        </div>
        <div class="box-content">
          <span class="box-label">Style me!</span>
          <span class="style-info" id="style-info">default styles</span>
        </div>
      </div>
      <div class="control-group">
        <span class="control-label">Appearance</span>
        <bq-button size="sm" id="btn-color">🎨 Color</bq-button>
        <bq-button size="sm" id="btn-shadow">✦ Shadow</bq-button>
        <bq-button size="sm" id="btn-radius">◐ Radius</bq-button>
      </div>
      <div class="control-group">
        <span class="control-label">Transform</span>
        <bq-button size="sm" id="btn-scale">⤢ Scale</bq-button>
        <bq-button size="sm" id="btn-rotate">↻ Rotate</bq-button>
        <bq-button size="sm" id="btn-skew">◇ Skew</bq-button>
      </div>
      <div class="controls">
        <bq-button variant="danger" size="sm" id="btn-reset">Reset All</bq-button>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;

      // Wrap elements with bQuery's $ for chainable css() API
      const $box = $(shadow.getElementById('css-box')!);
      const $info = $(shadow.getElementById('style-info')!);

      // State tracking
      const state = {
        colorIdx: -1,
        shadow: false,
        radiusIdx: 0,
        rotation: 0,
        scale: 1,
        skew: 0,
      };

      // Style options
      const gradients = [
        {
          name: 'Indigo',
          value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        },
        {
          name: 'Pink',
          value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        },
        {
          name: 'Cyan',
          value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        },
        {
          name: 'Green',
          value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        },
        {
          name: 'Sunset',
          value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        },
      ];

      const radiusOptions = [
        { name: '0.75rem', value: '0.75rem' },
        { name: '1.5rem', value: '1.5rem' },
        { name: '50%', value: '50%' },
      ];

      // Indicator elements
      const $indColor = $(shadow.getElementById('ind-color')!);
      const $indShadow = $(shadow.getElementById('ind-shadow')!);
      const $indRadius = $(shadow.getElementById('ind-radius')!);
      const $indTransform = $(shadow.getElementById('ind-transform')!);

      // Update visual indicators
      const updateIndicators = () => {
        const setActive = ($el: ReturnType<typeof $>, active: boolean) => {
          if (active) {
            $el.addClass('active');
          } else {
            $el.removeClass('active');
          }
        };

        setActive($indColor, state.colorIdx >= 0);
        setActive($indShadow, state.shadow);
        setActive($indRadius, state.radiusIdx > 0);
        setActive($indTransform, state.rotation !== 0 || state.scale !== 1 || state.skew !== 0);
      };

      // Update transform with all values combined
      const updateTransform = () => {
        const transforms: string[] = [];
        if (state.scale !== 1) transforms.push(`scale(${state.scale})`);
        if (state.rotation !== 0) transforms.push(`rotate(${state.rotation}deg)`);
        if (state.skew !== 0) transforms.push(`skewX(${state.skew}deg)`);

        const transformValue = transforms.length > 0 ? transforms.join(' ') : '';
        (shadow.getElementById('css-box') as HTMLElement).style.transform = transformValue;
        updateIndicators();
      };

      // Update info display
      const updateInfo = () => {
        const parts: string[] = [];
        if (state.colorIdx >= 0) parts.push(gradients[state.colorIdx].name);
        if (state.shadow) parts.push('Shadow');
        if (state.radiusIdx > 0) parts.push(`r:${radiusOptions[state.radiusIdx].name}`);
        if (state.scale !== 1) parts.push(`s:${state.scale}`);
        if (state.rotation !== 0) parts.push(`${state.rotation}°`);
        if (state.skew !== 0) parts.push(`skew:${state.skew}°`);

        $info.text(parts.length > 0 ? parts.join(' · ') : 'default styles');
      };

      // Color - cycles through gradients
      shadow.getElementById('btn-color')?.addEventListener('click', () => {
        state.colorIdx = (state.colorIdx + 1) % gradients.length;
        $box.css('background', gradients[state.colorIdx].value);
        updateInfo();
        updateIndicators();
      });

      // Shadow - toggles box shadow
      shadow.getElementById('btn-shadow')?.addEventListener('click', () => {
        state.shadow = !state.shadow;
        $box.css(
          'box-shadow',
          state.shadow
            ? '0 20px 40px rgba(99, 102, 241, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.2)'
            : 'none'
        );
        updateInfo();
        updateIndicators();
      });

      // Radius - cycles through border-radius values
      shadow.getElementById('btn-radius')?.addEventListener('click', () => {
        state.radiusIdx = (state.radiusIdx + 1) % radiusOptions.length;
        $box.css('border-radius', radiusOptions[state.radiusIdx].value);
        updateInfo();
        updateIndicators();
      });

      // Scale - toggles between 1 and 1.1
      shadow.getElementById('btn-scale')?.addEventListener('click', () => {
        state.scale = state.scale === 1 ? 1.1 : 1;
        updateTransform();
        updateInfo();
      });

      // Rotate - increments by 45 degrees
      shadow.getElementById('btn-rotate')?.addEventListener('click', () => {
        state.rotation = (state.rotation + 45) % 360;
        updateTransform();
        updateInfo();
      });

      // Skew - toggles skew effect
      shadow.getElementById('btn-skew')?.addEventListener('click', () => {
        state.skew = state.skew === 0 ? 5 : state.skew === 5 ? -5 : 0;
        updateTransform();
        updateInfo();
      });

      // Reset - demonstrates css() with object syntax for multiple properties
      shadow.getElementById('btn-reset')?.addEventListener('click', () => {
        // Reset state
        state.colorIdx = -1;
        state.shadow = false;
        state.radiusIdx = 0;
        state.rotation = 0;
        state.scale = 1;
        state.skew = 0;

        // Reset styles - using direct style access for transform due to css() limitation
        const boxEl = shadow.getElementById('css-box') as HTMLElement;
        boxEl.style.background = '#18181b';
        boxEl.style.boxShadow = 'none';
        boxEl.style.borderRadius = '0.75rem';
        boxEl.style.transform = '';

        updateInfo();
        updateIndicators();
      });

      // Initialize indicators
      updateIndicators();
    });
  },
});

// Events Demo Component - demonstrates bQuery's on() method for event handling
component('demo-events', {
  styles: `
    :host { display: block; }
    .box {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.75rem;
      margin-bottom: 0.75rem;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .box:hover {
      background: #27272a;
    }
    input {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      padding: 0.625rem 0.875rem;
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 0.875rem;
      color: #fafafa;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      margin-bottom: 0.75rem;
      outline: none;
    }
    input:focus {
      border-color: #6366f1;
    }
    .log {
      max-height: 100px;
      overflow-y: auto;
      background: #0a0a0b;
      border: 1px solid #1f1f23;
      border-radius: 0.5rem;
      padding: 0.5rem;
    }
    .log-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      color: #71717a;
      border-radius: 0.25rem;
      animation: fadeIn 0.2s ease;
    }
    .log-item:nth-child(odd) {
      background: rgba(255, 255, 255, 0.02);
    }
    .event-type {
      padding: 1px 6px;
      background: rgba(99, 102, 241, 0.15);
      border-radius: 0.25rem;
      color: #6366f1;
      font-weight: 500;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  render() {
    return html`
      <div class="box" id="event-box">
        <span>Hover, click, or type below</span>
      </div>
      <input type="text" id="event-input" placeholder="Type here..." />
      <div class="log" id="event-log">
        <div class="log-item">Events will appear here...</div>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const inputEl = shadow.getElementById('event-input') as HTMLInputElement;

      // Wrap elements with bQuery's $ for chainable on() API
      const $box = $(shadow.getElementById('event-box')!);
      const $input = $(inputEl);
      const $log = $(shadow.getElementById('event-log')!);

      // Helper to add event log entries
      const logEvent = (type: string, detail: string) => {
        const item = document.createElement('div');
        item.className = 'log-item';
        item.innerHTML = `<span class="event-type">${type}</span> ${detail}`;
        $log.prepend(item);

        // Keep only last 5 entries
        const logEl = $log.raw;
        while (logEl.children.length > 5) {
          logEl.removeChild(logEl.lastChild!);
        }
      };

      // Demonstrate bQuery's chainable on() method
      $box
        .on('click', () => logEvent('click', 'Box clicked'))
        .on('mouseenter', () => logEvent('hover', 'Mouse entered'))
        .on('mouseleave', () => logEvent('leave', 'Mouse left'));

      $input
        .on('input', () => logEvent('input', `"${inputEl.value.slice(-10)}..."`))
        .on('focus', () => logEvent('focus', 'Input focused'));
    });
  },
});

// Collection Demo Component - demonstrates bQuery's $$() collection API
component('demo-collection', {
  styles: `
    :host { display: block; }
    .grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .item {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }
    .item.selected {
      background: #6366f1;
      border-color: #6366f1;
      transform: scale(1.05);
    }
    .item.even {
      background: #a855f7;
      border-color: #a855f7;
      transform: scale(1.05);
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
  render() {
    return html`
      <div class="grid" id="collection-grid">
        <div class="item">1</div>
        <div class="item">2</div>
        <div class="item">3</div>
        <div class="item">4</div>
        <div class="item">5</div>
        <div class="item">6</div>
      </div>
      <div class="controls">
        <bq-button size="sm" id="btn-all">Select All</bq-button>
        <bq-button size="sm" id="btn-even">Select Even</bq-button>
        <bq-button size="sm" id="btn-shuffle">Shuffle</bq-button>
        <bq-button variant="danger" size="sm" id="btn-reset">Reset</bq-button>
      </div>
    `;
  },
  connected() {
    queueMicrotask(() => {
      const shadow = (this as unknown as HTMLElement).shadowRoot!;
      const grid = shadow.getElementById('collection-grid')!;

      // Use bQuery's $$() to wrap NodeList as a collection
      const getItems = () => $$(Array.from(grid.querySelectorAll('.item')));

      // Select All - demonstrates addClass() on collection
      shadow.getElementById('btn-all')?.addEventListener('click', () => {
        getItems().removeClass('even').addClass('selected');
      });

      // Select Even - demonstrates filter() and toggleClass()
      shadow.getElementById('btn-even')?.addEventListener('click', () => {
        const $items = getItems().removeClass('selected', 'even');

        // Filter to even-numbered items (2, 4, 6)
        $items.filter((_: Element, idx: number) => (idx + 1) % 2 === 0).addClass('even');
      });

      // Shuffle - demonstrates each() for iteration
      shadow.getElementById('btn-shuffle')?.addEventListener('click', () => {
        const items = Array.from(grid.querySelectorAll('.item'));

        // Fisher-Yates shuffle
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [items[i], items[j]] = [items[j], items[i]];
        }

        // Re-append in shuffled order and clear classes
        $$(items)
          .removeClass('selected', 'even')
          .each((el: Element) => grid.appendChild(el));
      });

      // Reset - demonstrates removeClass() on collection
      shadow.getElementById('btn-reset')?.addEventListener('click', () => {
        getItems().removeClass('selected', 'even');
      });
    });
  },
});

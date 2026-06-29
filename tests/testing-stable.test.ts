/**
 * Testing → Stable (1.15.0) tests — issue #147.
 *
 * Proves the Testing-Library-parity surface behaves consistently across
 * **light and shadow DOM** — the bit that matters for bQuery's Web Component
 * model — plus `userEvent` / `fireEvent` / `within` and a representative mock.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { component } from '../src/component/index';
import {
  cleanup,
  fireEvent,
  mockSignal,
  renderComponent,
  screen,
  userEvent,
  within,
} from '../src/testing/index';

const SHADOW_TAG = 'stable-shadow-card';
const LIGHT_TAG = 'stable-light-card';

beforeEach(() => {
  if (!customElements.get(SHADOW_TAG)) {
    component(SHADOW_TAG, {
      render() {
        return `
          <button data-testid="shadow-btn" aria-label="Save">Save</button>
          <p data-testid="shadow-text">In shadow</p>
        `;
      },
    });
  }
  if (!customElements.get(LIGHT_TAG)) {
    component(LIGHT_TAG, {
      shadow: false,
      render() {
        return `<button data-testid="light-btn">Click</button>`;
      },
    });
  }
});

afterEach(() => cleanup());

describe('Testing Stable — shadow-DOM-aware queries (#147)', () => {
  it('screen queries pierce shadow roots', () => {
    renderComponent(SHADOW_TAG);
    // getByRole / getByText / getByTestId all reach into the shadow root.
    expect(screen.getByRole('button')).toBeDefined();
    expect(screen.getByText('In shadow')).toBeDefined();
    expect(screen.getByTestId('shadow-text').textContent).toContain('In shadow');
  });

  it('queries light DOM components too', () => {
    renderComponent(LIGHT_TAG);
    expect(screen.getByTestId('light-btn')).toBeDefined();
  });

  it('within() scopes queries to a subtree', () => {
    const { el } = renderComponent(SHADOW_TAG);
    const scoped = within(el);
    expect(scoped.getByTestId('shadow-btn')).toBeDefined();
  });
});

describe('Testing Stable — userEvent / fireEvent (#147)', () => {
  it('userEvent.click dispatches into a shadow-rendered button', async () => {
    renderComponent(SHADOW_TAG);
    const btn = screen.getByTestId('shadow-btn');
    let clicks = 0;
    btn.addEventListener('click', () => {
      clicks += 1;
    });
    await userEvent.click(btn);
    expect(clicks).toBe(1);
  });

  it('fireEvent dispatches a typed event with options', () => {
    renderComponent(LIGHT_TAG);
    const btn = screen.getByTestId('light-btn');
    let seen = false;
    btn.addEventListener('click', () => {
      seen = true;
    });
    fireEvent(btn, 'click');
    expect(seen).toBe(true);
  });
});

describe('Testing Stable — mocks (#147)', () => {
  it('mockSignal exposes a controllable reactive value', () => {
    const s = mockSignal(1);
    expect(s.value).toBe(1);
    s.value = 5;
    expect(s.value).toBe(5);
  });
});

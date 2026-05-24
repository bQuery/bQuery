/**
 * Tests for the 1.14+ testing extension helpers.
 */

import { afterEach, describe, expect, it } from 'bun:test';

import {
  cleanup,
  expectAccessible,
  fireEvent,
  flushPromises,
  getReactiveSummary,
  mockComputed,
  mockEffect,
  mockFetch,
  mockForm,
  mockI18n,
  mockStore,
  mockWebSocket,
  prettyDOM,
  renderComponent,
  screen,
  tick,
  userEvent,
  within,
} from '../src/testing/index';
import { signal } from '../src/reactive/index';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// fireEvent shortcuts
// ---------------------------------------------------------------------------

describe('fireEvent shortcuts', () => {
  it('fireEvent.click dispatches a click event', () => {
    let called = false;
    const btn = document.createElement('button');
    btn.addEventListener('click', () => {
      called = true;
    });
    document.body.appendChild(btn);
    fireEvent.click(btn);
    expect(called).toBe(true);
  });

  it('fireEvent.input sets value and dispatches input', () => {
    const input = document.createElement('input');
    let fired = '';
    input.addEventListener('input', () => {
      fired = input.value;
    });
    document.body.appendChild(input);
    fireEvent.input(input, 'hello');
    expect(input.value).toBe('hello');
    expect(fired).toBe('hello');
  });

  it('fireEvent.submit dispatches a submit event', () => {
    const form = document.createElement('form');
    let submitted = false;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitted = true;
    });
    document.body.appendChild(form);
    fireEvent.submit(form);
    expect(submitted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// userEvent
// ---------------------------------------------------------------------------

describe('userEvent', () => {
  it('type() appends characters and dispatches input events', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    let count = 0;
    input.addEventListener('input', () => count++);
    await userEvent.type(input, 'hi');
    expect(input.value).toBe('hi');
    expect(count).toBe(2);
  });

  it('clear() empties an input and dispatches change', async () => {
    const input = document.createElement('input');
    input.value = 'old';
    document.body.appendChild(input);
    await userEvent.clear(input);
    expect(input.value).toBe('');
  });

  it('click() dispatches mousedown/up/click in order', async () => {
    const btn = document.createElement('button');
    const seen: string[] = [];
    ['mousedown', 'mouseup', 'click'].forEach((evt) =>
      btn.addEventListener(evt, () => seen.push(evt))
    );
    document.body.appendChild(btn);
    await userEvent.click(btn);
    expect(seen).toEqual(['mousedown', 'mouseup', 'click']);
  });
});

// ---------------------------------------------------------------------------
// Screen queries
// ---------------------------------------------------------------------------

describe('screen / within queries', () => {
  it('getByText finds an element by text content', () => {
    document.body.innerHTML = '<div><p>Hello</p><p>World</p></div>';
    expect(screen.getByText('Hello').tagName).toBe('P');
  });

  it('getByRole matches implicit roles', () => {
    document.body.innerHTML = '<button>Click me</button>';
    expect(screen.getByRole('button').textContent).toBe('Click me');
  });

  it('getByTestId finds via data-testid', () => {
    document.body.innerHTML = '<span data-testid="greeting">Hi</span>';
    expect(screen.getByTestId('greeting').textContent).toBe('Hi');
  });

  it('queryByText returns null when nothing matches', () => {
    document.body.innerHTML = '<p>nope</p>';
    expect(screen.queryByText('missing')).toBeNull();
  });

  it('within() scopes queries to a subtree', () => {
    document.body.innerHTML = `
      <section data-testid="a"><p>inside-a</p></section>
      <section data-testid="b"><p>inside-b</p></section>
    `;
    const a = screen.getByTestId('a');
    expect(within(a).getByText('inside-a')).toBeTruthy();
    expect(within(a).queryByText('inside-b')).toBeNull();
  });

  it('findByText resolves once content appears', async () => {
    setTimeout(() => {
      document.body.innerHTML = '<p>delayed</p>';
    }, 5);
    const el = await screen.findByText('delayed');
    expect(el.textContent).toBe('delayed');
  });

  it('getByLabelText resolves via for/id', () => {
    document.body.innerHTML = '<label for="i">Name</label><input id="i" />';
    expect(screen.getByLabelText('Name').tagName).toBe('INPUT');
  });
});

// ---------------------------------------------------------------------------
// Cleanup tracking
// ---------------------------------------------------------------------------

describe('cleanup()', () => {
  it('is idempotent when nothing is pending', () => {
    expect(() => cleanup()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------

describe('tick + flushPromises', () => {
  it('tick resolves on the next microtask', async () => {
    let v = 0;
    Promise.resolve().then(() => (v = 1));
    await tick();
    expect(v).toBe(1);
  });

  it('flushPromises drains timers', async () => {
    let v = 0;
    setTimeout(() => (v = 1), 0);
    await flushPromises();
    expect(v).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Reactive helpers
// ---------------------------------------------------------------------------

describe('mockComputed + mockEffect', () => {
  it('counts recomputations of mockComputed', () => {
    const a = signal(1);
    const sum = mockComputed(() => a.value + 1);
    expect(sum.value).toBe(2);
    expect(sum.recomputeCount).toBe(1);
    a.value = 5;
    expect(sum.value).toBe(6);
    expect(sum.recomputeCount).toBe(2);
  });

  it('counts runs of mockEffect and disposes', () => {
    const a = signal(0);
    const e = mockEffect(() => {
      void a.value;
    });
    expect(e.runs).toBe(1);
    a.value = 1;
    expect(e.runs).toBe(2);
    e.dispose();
    a.value = 2;
    expect(e.runs).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

describe('mockStore', () => {
  it('reset restores initial state', () => {
    const store = mockStore({ count: 0 });
    store.set({ count: 5 });
    expect(store.state.count).toBe(5);
    store.reset();
    expect(store.state.count).toBe(0);
  });
});

describe('mockI18n', () => {
  it('returns translated message with variable interpolation', () => {
    const i18n = mockI18n({
      locale: 'en',
      messages: { en: { hello: 'Hello {name}' } },
    });
    expect(i18n.t('hello', { name: 'World' })).toBe('Hello World');
  });

  it('falls back to key when no translation', () => {
    const i18n = mockI18n();
    expect(i18n.t('missing')).toBe('missing');
  });

  it('setLocale updates the active locale', () => {
    const i18n = mockI18n({
      locale: 'en',
      messages: { en: { hi: 'Hi' }, de: { hi: 'Hallo' } },
    });
    i18n.setLocale('de');
    expect(i18n.t('hi')).toBe('Hallo');
  });
});

describe('mockForm', () => {
  it('set updates values reactively', () => {
    const form = mockForm({ name: '' });
    form.set('name', 'A');
    expect(form.values.value.name).toBe('A');
  });

  it('setError adds and removes errors', () => {
    const form = mockForm({ name: '' });
    form.setError('name', 'required');
    expect(form.errors.value.name).toBe('required');
    form.setError('name', undefined);
    expect(form.errors.value.name).toBeUndefined();
  });
});

describe('mockFetch', () => {
  it('intercepts fetch and serves mocked responses', async () => {
    const m = mockFetch({
      '/api/x': { status: 200, body: { ok: true } },
    });
    const res = await fetch('https://example.com/api/x');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.calls.length).toBe(1);
    m.restore();
  });

  it('returns 404 for unmocked routes', async () => {
    const m = mockFetch({});
    const res = await fetch('https://example.com/nope');
    expect(res.status).toBe(404);
    m.restore();
  });
});

describe('mockWebSocket', () => {
  it('relays sent messages and emits received ones', () => {
    const ws = mockWebSocket();
    const received: string[] = [];
    ws.socket.onmessage = (e): void => {
      received.push(e.data);
    };
    ws.open();
    ws.socket.send('ping');
    ws.emit('pong');
    expect(ws.sent).toEqual(['ping']);
    expect(received).toEqual(['pong']);
  });
});

// ---------------------------------------------------------------------------
// Snapshot / a11y
// ---------------------------------------------------------------------------

describe('prettyDOM', () => {
  it('renders nested elements with attributes', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p class="x">Hi</p>';
    const out = prettyDOM(el);
    expect(out).toContain('<div>');
    expect(out).toContain('<p class="x">');
  });

  it('truncates long output', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>'.repeat(2000) + '</span>'.repeat(2000);
    const out = prettyDOM(el, { maxLength: 200 });
    expect(out.endsWith('(truncated)')).toBe(true);
  });
});

describe('getReactiveSummary', () => {
  it('counts custom-element descendants', () => {
    const el = document.createElement('div');
    el.innerHTML = '<my-card></my-card><my-card></my-card><span data-testid="x"></span>';
    const summary = getReactiveSummary(el);
    expect(summary.components).toBe(2);
    expect(summary.testIds).toEqual(['x']);
  });
});

describe('expectAccessible', () => {
  it('reports missing image alt text', () => {
    const el = document.createElement('div');
    el.innerHTML = '<img src="x.png"><img src="ok.png" alt="ok">';
    const result = expectAccessible(el);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].rule).toBe('image-alt');
  });

  it('reports buttons without accessible name', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button></button>';
    const result = expectAccessible(el);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.rule === 'button-name')).toBe(true);
  });

  it('passes for accessible content', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button>Save</button><img alt="thumb" src="t.png">';
    const result = expectAccessible(el);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderComponent + cleanup integration
// ---------------------------------------------------------------------------

describe('renderComponent integration', () => {
  it('mounts a custom element', () => {
    if (!customElements.get('test-extx-card')) {
      class TestCard extends HTMLElement {
        connectedCallback(): void {
          this.textContent = 'card-content';
        }
      }
      customElements.define('test-extx-card', TestCard);
    }
    const result = renderComponent('test-extx-card');
    expect(result.el.textContent).toBe('card-content');
    result.unmount();
  });
});

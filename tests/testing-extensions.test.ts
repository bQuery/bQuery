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
  waitFor,
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

  it('fireEvent.input throws for non-form elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    expect(() => fireEvent.input(div, 'hello')).toThrow(
      /requires an input, textarea, or select element/
    );
  });

  it('fireEvent.keyDown dispatches a KeyboardEvent', () => {
    const input = document.createElement('input');
    let receivedEvent: Event | null = null;
    input.addEventListener('keydown', (event) => {
      receivedEvent = event;
    });
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(receivedEvent).toBeInstanceOf(KeyboardEvent);
    expect((receivedEvent as KeyboardEvent | null)?.key).toBe('Enter');
    expect((receivedEvent as KeyboardEvent | null)?.code).toBe('Enter');
  });

  it('fireEvent keyboard shortcuts validate the target element', () => {
    expect(() => fireEvent.keyDown(null as unknown as Element)).toThrow('requires a valid element');
    expect(() => fireEvent.keyUp(null as unknown as Element)).toThrow('requires a valid element');
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

  it('type() throws for non-form elements with the fireEvent validation error', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    await expect(userEvent.type(div, 'hi')).rejects.toThrow(
      /requires an input, textarea, or select element/
    );
  });

  it('selectOptions() throws for non-select elements', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    await expect(userEvent.selectOptions(input, 'x')).rejects.toThrow(/requires a select element/);
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

  it('within() finds elements inside nested shadow roots', () => {
    const outerHost = document.createElement('div');
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    const innerHost = document.createElement('section');
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    const label = document.createElement('span');
    label.textContent = 'nested-shadow-text';

    innerShadow.appendChild(label);
    outerShadow.appendChild(innerHost);
    document.body.appendChild(outerHost);

    expect(within(outerHost).getByText('nested-shadow-text')).toBe(label);
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

  it('getByLabelText resolves multiple aria-labelledby ids in shadow DOM', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <span id="first">Primary</span>
      <span id="second">Name</span>
      <input aria-labelledby="first second" />
    `;
    document.body.appendChild(host);

    const input = shadow.querySelector('input');
    expect(input).toBeTruthy();
    if (!input) throw new Error('expected shadow-root input');
    expect(screen.getByLabelText('Primary Name')).toBe(input);
  });

  it('screen throws a clear error without document', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    try {
      expect(() => screen.getByText('Hello')).toThrow(/require a document-like environment/);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'document', descriptor);
      } else {
        delete (globalThis as { document?: Document }).document;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Cleanup tracking
// ---------------------------------------------------------------------------

describe('cleanup()', () => {
  it('is idempotent when nothing is pending', () => {
    expect(() => cleanup()).not.toThrow();
  });

  it('unmounts tracked renderComponent results', () => {
    if (!customElements.get('test-extx-cleanup')) {
      customElements.define(
        'test-extx-cleanup',
        class extends HTMLElement {
          connectedCallback(): void {
            this.textContent = 'cleanup-target';
          }
        }
      );
    }

    const result = renderComponent('test-extx-cleanup');
    expect(document.body.contains(result.el)).toBe(true);

    cleanup();

    expect(document.body.contains(result.el)).toBe(false);
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

// ---------------------------------------------------------------------------
// *ByRole name filter, typed events, wrapped labels (found via create-bquery)
// ---------------------------------------------------------------------------

describe('*ByRole { name } option', () => {
  it('filters by exact, whitespace-normalised button text', () => {
    document.body.innerHTML = `
      <button>Cancel</button>
      <button>
        Save
        <span>draft</span>
      </button>
      <button>Save</button>
    `;
    const buttons = document.querySelectorAll('button');
    expect(screen.getByRole('button', { name: 'Save' })).toBe(buttons[2]);
    expect(screen.getByRole('button', { name: '  Save   draft ' })).toBe(buttons[1]);
    expect(screen.queryByRole('button', { name: 'Sav' })).toBeNull();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBe(buttons[0]);
  });

  it('keeps the role-only form working', () => {
    document.body.innerHTML = '<button>Only</button>';
    expect(screen.getByRole('button').textContent).toBe('Only');
    expect(screen.getByRole('button', {})).toBe(screen.getByRole('button'));
  });

  it('uses aria-label and aria-labelledby before content', () => {
    document.body.innerHTML = `
      <span id="t">Close</span><span id="u">dialog</span>
      <button aria-label="Dismiss">×</button>
      <button aria-labelledby="t u">x</button>
    `;
    const [dismiss, close] = Array.from(document.querySelectorAll('button'));
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBe(dismiss);
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBe(close);
    expect(screen.queryByRole('button', { name: '×' })).toBeNull();
  });

  it('names form controls from their label (for/id and wrapping)', () => {
    document.body.innerHTML = `
      <label for="email">Email</label><input id="email" type="email" />
      <label><span>Title</span> <input id="title" /></label>
      <label><input type="checkbox" id="agree" /> I <b>agree</b></label>
      <input aria-label="Search" type="search" />
    `;
    expect(screen.getByRole('textbox', { name: 'Email' }).id).toBe('email');
    expect(screen.getByRole('textbox', { name: 'Title' }).id).toBe('title');
    expect(screen.getByRole('textbox', { name: /search/i })).toBe(
      document.querySelector('[aria-label="Search"]')!
    );
    expect(screen.getByRole('checkbox', { name: 'I agree' }).id).toBe('agree');
  });

  it('names links, headings and images', () => {
    document.body.innerHTML = `
      <h1>Todos</h1><h2>About us</h2>
      <a href="/a">Home</a><a href="/b"><img alt="Logo" src="x.png" /></a>
      <img alt="Avatar" src="y.png" />
    `;
    expect(screen.getByRole('heading', { name: 'About us' }).tagName).toBe('H2');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/a');
    expect(screen.getByRole('link', { name: 'Logo' }).getAttribute('href')).toBe('/b');
    expect(screen.getByRole('img', { name: 'Avatar' }).getAttribute('src')).toBe('y.png');
  });

  it('works through within() and shadow roots', () => {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML = '<button>Inner</button><button>Other</button>';
    document.body.appendChild(host);
    expect(within(host).getByRole('button', { name: 'Inner' }).textContent).toBe('Inner');
    expect(screen.getByRole('button', { name: 'Other' }).textContent).toBe('Other');
  });

  it('mentions the name filter and the available names in errors', () => {
    document.body.innerHTML = '<button>Cancel</button><button>Delete</button>';
    expect(() => screen.getByRole('button', { name: 'Save' })).toThrow(
      'no element found matching role "button" with name "Save" (accessible names of role "button": "Cancel", "Delete")'
    );
    expect(() => screen.getByRole('button', { name: /e/ })).toThrow(
      'multiple elements (2) match role "button" with name /e/'
    );
  });

  it('findByRole waits for a matching name', async () => {
    document.body.innerHTML = '<button>Loading</button>';
    setTimeout(() => {
      document.body.innerHTML = '<button>Loading</button><button>Save</button>';
    }, 20);
    const el = await screen.findByRole('button', { name: 'Save' });
    expect(el.textContent).toBe('Save');
  });

  it('findByRole accepts a timeout after the options, and still a timeout alone', async () => {
    document.body.innerHTML = '<button>Cancel</button>';
    await expect(screen.findByRole('button', { name: 'Save' }, 30)).rejects.toThrow(
      /timed out after 30ms waiting for role "button" with name "Save"/
    );
    await expect(
      screen.findByRole('button', { name: 'Save' }, { timeout: 30, interval: 5 })
    ).rejects.toThrow(/with name "Save"/);
    expect((await screen.findByRole('button', 50)).textContent).toBe('Cancel');
    await expect(screen.findByRole('link', { timeout: 20 })).rejects.toThrow(
      /timed out after 20ms waiting for role "link"/
    );
  });
});

describe('fireEvent / userEvent dispatch typed events', () => {
  it('click-family events are MouseEvents for the primary button', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    const seen: MouseEvent[] = [];
    for (const type of ['click', 'dblclick', 'mousedown', 'mouseup', 'contextmenu']) {
      btn.addEventListener(type, (e) => seen.push(e as MouseEvent));
    }

    fireEvent.click(btn);
    fireEvent.dblClick(btn);
    fireEvent(btn, 'mousedown');
    fireEvent(btn, 'mouseup');
    fireEvent(btn, 'contextmenu');

    expect(seen.map((e) => e instanceof MouseEvent)).toEqual([true, true, true, true, true]);
    expect(seen.map((e) => [e.type, e.button, e.detail])).toEqual([
      ['click', 0, 1],
      ['dblclick', 0, 2],
      ['mousedown', 0, 1],
      ['mouseup', 0, 1],
      ['contextmenu', 2, 0],
    ]);
    expect(seen[0].bubbles && seen[0].cancelable && seen[0].composed).toBe(true);
    expect(seen[2].buttons).toBe(1);
  });

  it('init fields override the defaults', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    let event: MouseEvent | undefined;
    btn.addEventListener('click', (e) => {
      event = e as MouseEvent;
    });
    fireEvent.click(btn, { button: 1, ctrlKey: true, detail: 3, bubbles: false });
    expect(event?.button).toBe(1);
    expect(event?.ctrlKey).toBe(true);
    expect(event?.detail).toBe(3);
    expect(event?.bubbles).toBe(false);
  });

  it('pointer, input and focus events use their own classes', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const seen: Record<string, Event> = {};
    for (const type of ['pointerdown', 'input', 'focus', 'blur']) {
      input.addEventListener(type, (e) => {
        seen[type] = e;
      });
    }
    fireEvent(input, 'pointerdown');
    fireEvent.input(input, 'x', { inputType: 'insertText', data: 'x' });
    fireEvent.focus(input);
    fireEvent.blur(input);

    const pointer = seen.pointerdown as PointerEvent;
    expect(pointer).toBeInstanceOf(PointerEvent);
    expect([pointer.button, pointer.pointerType, pointer.isPrimary]).toEqual([0, 'mouse', true]);
    const view = window as unknown as typeof globalThis;
    expect(seen.input).toBeInstanceOf(view.InputEvent);
    expect((seen.input as InputEvent).data).toBe('x');
    expect(seen.focus).toBeInstanceOf(view.FocusEvent);
    expect(seen.blur).toBeInstanceOf(view.FocusEvent);
  });

  it('keeps CustomEvent for object details and unknown event names', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const seen: Event[] = [];
    el.addEventListener('click', (e) => seen.push(e));
    el.addEventListener('my-event', (e) => seen.push(e));
    fireEvent(el, 'click', { detail: { action: 'save' } });
    fireEvent(el, 'my-event', { detail: 1 });
    expect(seen[0]).toBeInstanceOf(CustomEvent);
    expect((seen[0] as CustomEvent).detail).toEqual({ action: 'save' });
    expect(seen[1]).toBeInstanceOf(CustomEvent);
  });

  it('userEvent.click sends left-button MouseEvents', async () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    const seen: Array<[string, boolean, number]> = [];
    for (const type of ['mousedown', 'mouseup', 'click']) {
      btn.addEventListener(type, (e) =>
        seen.push([e.type, e instanceof MouseEvent, (e as MouseEvent).button])
      );
    }
    await userEvent.click(btn);
    expect(seen).toEqual([
      ['mousedown', true, 0],
      ['mouseup', true, 0],
      ['click', true, 0],
    ]);
  });

  it('a click toggles a checkbox like a real one', () => {
    document.body.innerHTML = '<input type="checkbox" />';
    const box = document.querySelector('input') as HTMLInputElement;
    let changes = 0;
    box.addEventListener('change', () => changes++);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    expect(changes).toBe(1);
  });

  it('fireEvent.click and userEvent.click navigate with <bq-link>', async () => {
    const { createRouter, currentRoute, registerBqLink } = await import('../src/router/index');
    registerBqLink();
    const happyDOM = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM;
    const originalURL = window.location.href;
    happyDOM.setURL('http://localhost/');
    const router = createRouter({
      hash: true,
      routes: [
        { path: '/', component: () => null },
        { path: '/about', component: () => null },
        { path: '/contact', component: () => null },
      ],
    });
    try {
      document.body.innerHTML =
        '<bq-link to="/about">About</bq-link><bq-link to="/contact">Contact</bq-link>';

      fireEvent.click(screen.getByText('About'));
      await waitFor(() => currentRoute.value.path === '/about');

      await userEvent.click(screen.getByText('Contact'));
      await waitFor(() => currentRoute.value.path === '/contact');

      // Non-primary buttons are still ignored.
      fireEvent.click(screen.getByText('About'), { button: 1 });
      await flushPromises();
      expect(currentRoute.value.path).toBe('/contact');
    } finally {
      router.destroy();
      happyDOM.setURL(originalURL);
    }
  });
});

describe('getByLabelText with wrapped labels', () => {
  it('matches label text that sits in nested elements', () => {
    document.body.innerHTML = `
      <label><span>Title</span><input id="title" /></label>
      <label><strong>Due</strong> <em>date</em> <input id="due" type="date" /></label>
      <label for="notes"><span>Notes</span></label><textarea id="notes">Notes body</textarea>
    `;
    expect(screen.getByLabelText('Title').id).toBe('title');
    expect(screen.getByLabelText('Due date').id).toBe('due');
    expect(screen.getByLabelText(/^due date$/i).id).toBe('due');
    expect(screen.getByLabelText('Notes').id).toBe('notes');
  });

  it("ignores the control's own content in the label text", () => {
    document.body.innerHTML = `
      <label>Pick <select id="s"><option>Apples</option></select></label>
    `;
    expect(screen.getByLabelText('Pick').id).toBe('s');
    expect(screen.queryByLabelText('Apples')).toBeNull();
  });
});

describe('find* / waitFor deadlines', () => {
  it('find* never sleeps past its timeout, whatever the interval', async () => {
    const started = Date.now();
    await expect(screen.findByTestId('missing', { timeout: 50, interval: 1000 })).rejects.toThrow(
      /timed out after 50ms/
    );
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('find* runs a last check when the timeout is due', async () => {
    setTimeout(() => {
      document.body.innerHTML = '<p data-testid="late">late</p>';
    }, 20);
    const started = Date.now();
    expect((await screen.findByTestId('late', { timeout: 80, interval: 1000 })).textContent).toBe(
      'late'
    );
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('waitFor never sleeps past its timeout', async () => {
    const started = Date.now();
    await expect(waitFor(() => false, { timeout: 50, interval: 1000 })).rejects.toThrow(
      /timed out after 50ms/
    );
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('findByRole reads timeout / interval from its role options', async () => {
    document.body.innerHTML = '<button>Cancel</button>';
    const started = Date.now();
    await expect(
      screen.findByRole('button', { name: 'Save', timeout: 50, interval: 1000 })
    ).rejects.toThrow(/timed out after 50ms waiting for role "button" with name "Save"/);
    expect(Date.now() - started).toBeLessThan(500);
    // A separate third argument still wins.
    await expect(
      screen.findByRole('button', { name: 'Save', timeout: 5000 }, { timeout: 20 })
    ).rejects.toThrow(/timed out after 20ms/);
    expect((await screen.findByRole('button', { name: 'Cancel', timeout: 50 })).textContent).toBe(
      'Cancel'
    );
  });
});

describe('fireEvent browser-like event flags', () => {
  const flagsOf = (type: string, fire: (el: HTMLInputElement) => void): boolean[] => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    let event: Event | undefined;
    input.addEventListener(type, (e) => {
      event = e;
    });
    fire(input);
    input.remove();
    return [event!.bubbles, event!.cancelable, event!.composed];
  };

  it('uses the flags a browser sends for each event type', () => {
    const expected: Record<string, boolean[]> = {
      focus: [false, false, true],
      blur: [false, false, true],
      focusin: [true, false, true],
      focusout: [true, false, true],
      mouseenter: [false, false, false],
      mouseleave: [false, false, false],
      pointerenter: [false, false, false],
      pointerleave: [false, false, false],
      mouseover: [true, true, true],
      click: [true, true, true],
      keydown: [true, true, true],
      beforeinput: [true, true, true],
      input: [true, false, true],
      change: [true, false, false],
      submit: [true, true, false],
      load: [false, false, false],
      scroll: [false, false, false],
      'my-event': [true, true, true],
    };
    for (const [type, flags] of Object.entries(expected)) {
      expect([type, ...flagsOf(type, (el) => fireEvent(el, type))]).toEqual([type, ...flags]);
    }
    expect(flagsOf('focus', (el) => fireEvent.focus(el))).toEqual([false, false, true]);
    expect(flagsOf('input', (el) => fireEvent.input(el, 'x'))).toEqual([true, false, true]);
    expect(flagsOf('change', (el) => fireEvent.change(el, 'x'))).toEqual([true, false, false]);
  });

  it('non-bubbling events skip ancestors unless the call says otherwise', () => {
    const parent = document.createElement('div');
    const input = document.createElement('input');
    parent.appendChild(input);
    document.body.appendChild(parent);
    const seen: string[] = [];
    for (const type of ['focus', 'blur', 'focusin', 'mouseenter']) {
      parent.addEventListener(type, () => seen.push(type));
    }
    fireEvent.focus(input);
    fireEvent.blur(input);
    fireEvent(input, 'mouseenter');
    fireEvent(input, 'focusin');
    expect(seen).toEqual(['focusin']);

    fireEvent.focus(input, { bubbles: true });
    expect(seen).toEqual(['focusin', 'focus']);
    expect(fireEvent.input(input, 'x', { cancelable: true })).toBe(true);
  });

  it('a change event does not leave its shadow root', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<input />';
    document.body.appendChild(host);
    const seen: string[] = [];
    for (const type of ['change', 'input']) host.addEventListener(type, () => seen.push(type));
    const input = shadow.querySelector('input')!;
    fireEvent.change(input, 'a');
    fireEvent.input(input, 'b');
    expect(seen).toEqual(['input']);
  });
});

describe('userEvent hover / type follow browser event order', () => {
  it('hover sends mouseenter to every entered element, outermost first', async () => {
    const outer = document.createElement('div');
    const inner = document.createElement('span');
    outer.appendChild(inner);
    document.body.appendChild(outer);
    const seen: string[] = [];
    for (const [name, el] of [
      ['outer', outer],
      ['inner', inner],
    ] as const) {
      for (const type of ['mouseover', 'mouseenter', 'mouseout', 'mouseleave']) {
        el.addEventListener(type, (e) =>
          seen.push(`${type}@${name}:${e.target === inner ? 'inner' : 'outer'}`)
        );
      }
    }

    await userEvent.hover(inner);
    expect(seen).toEqual([
      'mouseover@inner:inner',
      'mouseover@outer:inner',
      'mouseenter@outer:outer',
      'mouseenter@inner:inner',
    ]);

    seen.length = 0;
    await userEvent.unhover(inner);
    expect(seen).toEqual([
      'mouseout@inner:inner',
      'mouseout@outer:inner',
      'mouseleave@inner:inner',
      'mouseleave@outer:outer',
    ]);
  });

  it('hover enters the shadow host of an element in a shadow root', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button>Menu</button>';
    document.body.appendChild(host);
    const entered: EventTarget[] = [];
    host.addEventListener('mouseenter', (e) => entered.push(e.target!));
    await userEvent.hover(shadow.querySelector('button')!);
    expect(entered).toEqual([host]);
  });

  it('hover enters the slot and shadow wrappers of a slotted element', async () => {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML = '<section><slot></slot></section>';
    const child = document.createElement('span');
    host.appendChild(child);
    document.body.appendChild(host);
    const entered: string[] = [];
    const shadow = host.shadowRoot!;
    for (const el of [
      host,
      shadow.querySelector('section')!,
      shadow.querySelector('slot')!,
      child,
    ]) {
      el.addEventListener('mouseenter', () => entered.push(el.tagName));
    }
    await userEvent.hover(child);
    expect(entered).toEqual(['DIV', 'SECTION', 'SLOT', 'SPAN']);
    host.remove();
  });

  it('type sends keydown, keypress, beforeinput, input and keyup per character', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const seen: string[] = [];
    for (const type of ['keydown', 'keypress', 'beforeinput', 'input', 'keyup']) {
      input.addEventListener(type, () => seen.push(`${type}:${input.value}`));
    }
    await userEvent.type(input, 'a');
    expect(seen).toEqual(['keydown:', 'keypress:', 'beforeinput:', 'input:a', 'keyup:a']);
  });

  it('type keeps a character out when keydown, keypress or beforeinput is cancelled', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const seen: string[] = [];
    for (const type of ['keypress', 'beforeinput', 'input', 'keyup']) {
      input.addEventListener(type, () => seen.push(type));
    }
    input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'x') e.preventDefault();
    });
    input.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key === 'y') e.preventDefault();
    });
    input.addEventListener('beforeinput', (e) => {
      if ((e as InputEvent).data === 'z') e.preventDefault();
    });

    await userEvent.type(input, 'axbycz');
    expect(input.value).toBe('abc');

    seen.length = 0;
    await userEvent.type(input, 'x');
    expect(seen).toEqual(['keyup']);
    seen.length = 0;
    await userEvent.type(input, 'z');
    expect(seen).toEqual(['keypress', 'beforeinput', 'keyup']);
    expect(input.value).toBe('abc');
  });
});

describe('*ByRole accessible-name edge cases', () => {
  it('uses the text of an aria-labelledby target whose aria-label is empty', () => {
    document.body.innerHTML = `
      <span id="l1" aria-label="">Visible text</span>
      <button aria-labelledby="l1">fallback</button>
    `;
    expect(screen.getByRole('button', { name: 'Visible text' }).textContent).toBe('fallback');
  });

  it('treats submit / reset / image / button inputs as buttons', () => {
    document.body.innerHTML = `
      <input type="submit" value="Send" />
      <input type="submit" />
      <input type="reset" />
      <input type="image" alt="Search" />
      <input type="image" />
      <input type="button" value="Plain" />
      <input type="text" value="Not a button" />
    `;
    const inputs = document.querySelectorAll('input');
    expect(screen.getByRole('button', { name: 'Send' })).toBe(inputs[0]);
    expect(screen.getByRole('button', { name: 'Submit' })).toBe(inputs[1]);
    expect(screen.getByRole('button', { name: 'Reset' })).toBe(inputs[2]);
    expect(screen.getByRole('button', { name: 'Search' })).toBe(inputs[3]);
    expect(screen.getByRole('button', { name: 'Submit Query' })).toBe(inputs[4]);
    expect(screen.getByRole('button', { name: 'Plain' })).toBe(inputs[5]);
    expect(screen.queryByRole('button', { name: 'Not a button' })).toBeNull();
  });

  it('leaves CSS-hidden content out of the name', () => {
    document.body.innerHTML = `
      <style>.gone { display: none } .ghost { visibility: hidden }</style>
      <button id="a"><div style="display:none">invisible</div>Go</button>
      <button id="b"><span style="visibility: hidden">Ghost</span> Stop</button>
      <button id="c"><span class="gone">x</span><span class="ghost">y</span>Next</button>
      <button id="d"><span class="ghost">Outer <b style="visibility: visible">Shown</b></span></button>
      <button id="e"><img alt="Hidden icon" style="visibility:hidden" /> Back</button>
      <label for="mail">Email <span class="gone">(required)</span></label><input id="mail" />
    `;
    expect(screen.getByRole('button', { name: 'Go' }).id).toBe('a');
    expect(screen.getByRole('button', { name: 'Stop' }).id).toBe('b');
    expect(screen.getByRole('button', { name: 'Next' }).id).toBe('c');
    expect(screen.getByRole('button', { name: 'Shown' }).id).toBe('d');
    expect(screen.getByRole('button', { name: 'Back' }).id).toBe('e');
    expect(screen.getByLabelText('Email').id).toBe('mail');
  });

  it('still names an element from a hidden aria-labelledby target', () => {
    document.body.innerHTML = `
      <div style="display:none" id="hid">Hidden <span hidden>label</span></div>
      <button aria-labelledby="hid">x</button>
    `;
    expect(screen.getByRole('button', { name: 'Hidden label' }).textContent).toBe('x');
  });

  it("honours a slotted element's own alt, aria-label and hidden", () => {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML = '<button><slot></slot></button>';
    host.innerHTML = '<img alt="Home" /><span hidden>secret</span><i aria-label="Go">→</i>';
    document.body.appendChild(host);
    expect(within(host).getByRole('button', { name: 'Home Go' })).toBeTruthy();
  });
});

/**
 * Tests for the SSR-stability work (GitHub issues #127–#130):
 * - #128 interactive directive parity (`bq-model`, `bq-on`) + unsupported boundary
 * - #130 production hydration with `detectHydrationMismatches()` / `hydrate()`
 * - #129 resumable boundaries (`createResumableBoundary`, `createResumableGraph`, `resume`)
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { signal } from '../src/reactive/index';
import { createStore, destroyStore } from '../src/store/index';
import {
  configureSSR,
  createResumableBoundary,
  createResumableGraph,
  detectHydrationMismatches,
  hydrate,
  renderToString,
  RESUMABLE_BOUNDARY_ATTR,
  resume,
  SSR_ON_MARKER_ATTR,
  type SerializedResumableGraph,
} from '../src/ssr/index';

type Backend = 'dom' | 'pure';
const BACKENDS: Backend[] = ['dom', 'pure'];

const withBackend = (backend: Backend, run: () => void): void => {
  configureSSR({ backend });
  try {
    run();
  } finally {
    configureSSR({ backend: 'auto' });
  }
};

const captureWarnings = (run: () => void): string[] => {
  const original = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
  try {
    run();
  } finally {
    console.warn = original;
  }
  return warnings;
};

describe('#128 interactive directive parity — bq-model', () => {
  for (const backend of BACKENDS) {
    describe(`backend: ${backend}`, () => {
      it('renders text input value in full mode and omits it in static mode', () => {
        withBackend(backend, () => {
          const full = renderToString('<input bq-model="name">', { name: 'Ada' }, {
            directives: 'full',
          }).html;
          expect(full).toContain('value="Ada"');

          const staticHtml = renderToString('<input bq-model="name">', { name: 'Ada' }).html;
          expect(staticHtml).not.toContain('value="Ada"');
        });
      });

      it('reflects checkbox checked state from the bound value', () => {
        withBackend(backend, () => {
          const on = renderToString('<input type="checkbox" bq-model="agree">', { agree: true }, {
            directives: 'full',
          }).html;
          expect(on).toContain('checked');

          const off = renderToString('<input type="checkbox" bq-model="agree">', { agree: false }, {
            directives: 'full',
          }).html;
          expect(off).not.toContain('checked');
        });
      });

      it('checks the radio whose value matches the model', () => {
        withBackend(backend, () => {
          const html = renderToString(
            '<input type="radio" value="b" bq-model="choice">',
            { choice: 'b' },
            { directives: 'full' }
          ).html;
          expect(html).toContain('checked');

          const miss = renderToString(
            '<input type="radio" value="b" bq-model="choice">',
            { choice: 'a' },
            { directives: 'full' }
          ).html;
          expect(miss).not.toContain('checked');
        });
      });

      it('writes the textarea body from the model', () => {
        withBackend(backend, () => {
          const html = renderToString('<textarea bq-model="bio"></textarea>', { bio: 'hello' }, {
            directives: 'full',
          }).html;
          expect(html).toContain('>hello</textarea>');
        });
      });

      it('marks the matching select option as selected', () => {
        withBackend(backend, () => {
          const html = renderToString(
            '<select bq-model="color"><option value="red">Red</option><option value="blue">Blue</option></select>',
            { color: 'blue' },
            { directives: 'full' }
          ).html;
          expect(html).toMatch(/<option value="blue"[^>]*selected/);
          expect(html).not.toMatch(/<option value="red"[^>]*selected/);
        });
      });
    });
  }
});

describe('#128 interactive directive parity — bq-on', () => {
  for (const backend of BACKENDS) {
    describe(`backend: ${backend}`, () => {
      it('emits a data-bq-on hydration marker in full mode only', () => {
        withBackend(backend, () => {
          const full = renderToString('<button bq-on:click="inc">+</button>', {}, {
            directives: 'full',
          }).html;
          expect(full).toContain(`${SSR_ON_MARKER_ATTR}="click"`);

          const staticHtml = renderToString('<button bq-on:click="inc">+</button>', {}).html;
          expect(staticHtml).not.toContain(SSR_ON_MARKER_ATTR);
        });
      });

      it('collects multiple event names and strips modifiers', () => {
        withBackend(backend, () => {
          const html = renderToString(
            '<button bq-on:keydown.enter="a" bq-on:click="b">x</button>',
            {},
            { directives: 'full' }
          ).html;
          expect(html).toContain(`${SSR_ON_MARKER_ATTR}="keydown click"`);
        });
      });

      it('never executes handlers or emits inline on* attributes', () => {
        withBackend(backend, () => {
          const html = renderToString('<button bq-on:click="alert(1)">x</button>', {}, {
            directives: 'full',
          }).html;
          expect(html).not.toContain('onclick');
        });
      });
    });
  }
});

describe('#128 unsupported-directive boundary', () => {
  for (const backend of BACKENDS) {
    describe(`backend: ${backend}`, () => {
      it('warns about bq-model/bq-on in static mode', () => {
        withBackend(backend, () => {
          const warnings = captureWarnings(() => {
            renderToString('<input bq-model="x"><button bq-on:click="y">z</button>', { x: 'a' }, {
              onUnsupportedDirective: 'warn',
            });
          });
          expect(warnings.some((w) => w.includes('bq-model'))).toBe(true);
          expect(warnings.some((w) => w.includes('bq-on:click'))).toBe(true);
        });
      });

      it('warns about client-only directives (bq-ref) in any mode', () => {
        withBackend(backend, () => {
          const warnings = captureWarnings(() => {
            renderToString('<div bq-ref="el"></div>', {}, {
              directives: 'full',
              onUnsupportedDirective: 'warn',
            });
          });
          expect(warnings.some((w) => w.includes('bq-ref'))).toBe(true);
        });
      });

      it('throws when configured to throw', () => {
        withBackend(backend, () => {
          expect(() =>
            renderToString('<button bq-on:click="y">z</button>', {}, {
              onUnsupportedDirective: 'throw',
            })
          ).toThrow(/bq-on:click/);
        });
      });

      it('stays silent by default and in full mode for handled directives', () => {
        withBackend(backend, () => {
          const warnings = captureWarnings(() => {
            renderToString('<input bq-model="x"><button bq-on:click="y">z</button>', { x: 'a' }, {
              directives: 'full',
              onUnsupportedDirective: 'warn',
            });
          });
          expect(warnings).toHaveLength(0);
        });
      });

      it('is silent by default (backwards compatible)', () => {
        withBackend(backend, () => {
          const warnings = captureWarnings(() => {
            renderToString('<input bq-model="x">', { x: 'a' });
          });
          expect(warnings).toHaveLength(0);
        });
      });
    });
  }
});

describe('#130 detectHydrationMismatches', () => {
  const mountServer = (html: string): HTMLElement => {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
  };

  it('returns no mismatches when DOM and client context agree', () => {
    const { html } = renderToString('<p bq-text="msg"></p>', { msg: 'same' });
    const root = mountServer(html);
    expect(detectHydrationMismatches(root, { msg: 'same' })).toHaveLength(0);
  });

  it('flags a bq-text content divergence', () => {
    const { html } = renderToString('<p bq-text="msg"></p>', { msg: 'server' });
    const root = mountServer(html);
    const mismatches = detectHydrationMismatches(root, { msg: 'client' });
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].kind).toBe('text');
    expect(mismatches[0].domValue).toBe('server');
    expect(mismatches[0].clientValue).toBe('client');
  });

  it('flags a bq-bind attribute divergence', () => {
    const { html } = renderToString('<a bq-bind:href="url">x</a>', { url: '/a' });
    const root = mountServer(html);
    const mismatches = detectHydrationMismatches(root, { url: '/b' });
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].kind).toBe('attribute');
    expect(mismatches[0].directive).toBe('bq-bind:href');
  });

  it('flags a bq-show visibility divergence', () => {
    const { html } = renderToString('<p bq-show="open">hi</p>', { open: false });
    const root = mountServer(html);
    const mismatches = detectHydrationMismatches(root, { open: true });
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].kind).toBe('show');
  });

  it('does not false-positive on bq-for loop variables', () => {
    const { html } = renderToString('<ul><li bq-for="item in items" bq-text="item"></li></ul>', {
      items: ['a', 'b', 'c'],
    });
    const root = mountServer(html);
    // The expanded <li> reference `item`, which is not in the root context.
    expect(detectHydrationMismatches(root, { items: ['a', 'b', 'c'] })).toHaveLength(0);
  });

  it('flags a structural signature divergence from annotateHydration', () => {
    const { html } = renderToString('<p bq-text="msg"></p>', { msg: 'hi' }, {
      annotateHydration: true,
    });
    const root = mountServer(html);
    const p = root.querySelector('p')!;
    p.setAttribute('bq-text', 'tampered');
    const mismatches = detectHydrationMismatches(root, { msg: 'hi', tampered: 'hi' });
    expect(mismatches.some((m) => m.kind === 'signature')).toBe(true);
  });
});

describe('#130 hydrate', () => {
  const place = (html: string): HTMLElement => {
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.appendChild(root);
    return root;
  };

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('mounts and keeps reactivity after hydration', () => {
    const { html } = renderToString('<span bq-text="count"></span>', { count: 5 });
    const root = place(html);
    const count = signal(5);
    const { view, mismatches } = hydrate(root, { count });
    expect(mismatches).toHaveLength(0);
    expect(root.querySelector('span')!.textContent).toBe('5');
    count.value = 9;
    expect(root.querySelector('span')!.textContent).toBe('9');
    view.destroy();
  });

  it('repairs a content mismatch before attaching reactivity', () => {
    const { html } = renderToString('<p bq-text="msg"></p>', { msg: 'stale' });
    const root = place(html);
    const { mismatches } = hydrate(root, { msg: 'fresh' }, { onMismatch: 'repair' });
    expect(mismatches).toHaveLength(1);
    expect(root.querySelector('p')!.textContent).toBe('fresh');
  });

  it('routes mismatches to onError under the error strategy', () => {
    const { html } = renderToString('<p bq-text="msg"></p>', { msg: 'server' });
    const root = place(html);
    const seen: Element[] = [];
    const { mismatches } = hydrate(root, { msg: 'client' }, {
      onMismatch: 'error',
      onError: (_err, boundary) => seen.push(boundary),
    });
    expect(mismatches).toHaveLength(1);
    expect(seen).toHaveLength(1);
    expect(seen[0].tagName).toBe('P');
  });

  it('throws under the error strategy when no onError is provided', () => {
    const { html } = renderToString('<p bq-text="msg"></p>', { msg: 'server' });
    const root = place(html);
    expect(() => hydrate(root, { msg: 'client' }, { onMismatch: 'error' })).toThrow(/mismatch/i);
  });

  it('warns under the explicit warn strategy', () => {
    const { html } = renderToString('<p bq-text="msg"></p>', { msg: 'server' });
    const root = place(html);
    const warnings = captureWarnings(() => {
      hydrate(root, { msg: 'client' }, { onMismatch: 'warn' });
    });
    expect(warnings.some((w) => w.includes('Hydration mismatch'))).toBe(true);
  });

  it('repairs a text-input model value of "checked" as a value, not a checkbox toggle', () => {
    const { html } = renderToString('<input bq-model="v">', { v: 'old' }, { directives: 'full' });
    const root = place(html);
    const v = signal('checked');
    const { mismatches } = hydrate(root, { v }, { onMismatch: 'repair' });
    expect(mismatches).toHaveLength(1);
    const input = root.querySelector('input')!;
    expect(input.getAttribute('value')).toBe('checked');
    expect(input.hasAttribute('checked')).toBe(false);
  });
});

describe('#129 resumable boundaries — server', () => {
  afterEach(() => {
    try {
      destroyStore('cart');
    } catch {
      /* ok */
    }
  });

  it('collects signals, handlers and store slices into a boundary snapshot', () => {
    createStore({ id: 'cart', state: () => ({ items: 3 }) });
    const count = signal(7);
    const boundary = createResumableBoundary('cart');
    boundary.signal('count', count).handler('addItem').store('cart');
    const snapshot = boundary.toJSON();
    expect(snapshot.id).toBe('cart');
    expect(snapshot.signals.count).toBe(7);
    expect(snapshot.handlers).toEqual(['addItem']);
    expect(snapshot.stores.cart).toEqual({ items: 3 });
    expect(boundary.attrs()).toEqual({ [RESUMABLE_BOUNDARY_ATTR]: 'cart' });
  });

  it('honours the serialize allowlist', () => {
    const boundary = createResumableBoundary('only-signals', { serialize: ['signals'] });
    boundary.signal('a', 1).handler('nope').store('ghost', { x: 1 });
    const snapshot = boundary.toJSON();
    expect(snapshot.signals.a).toBe(1);
    expect(snapshot.handlers).toEqual([]);
    expect(snapshot.stores).toEqual({});
  });

  it('renders a CSP-nonce-aware, XSS-safe script tag', () => {
    const boundary = createResumableBoundary('b');
    boundary.signal('xss', '</script><script>alert(1)</script>');
    const tag = boundary.render({ nonce: 'N1' });
    expect(tag).toContain('nonce="N1"');
    expect(tag).toContain('window["__BQUERY_RESUME_GRAPH__"]=');
    expect(tag).not.toMatch(/<\/script><script>alert/);
    expect(tag).toContain('\\u003c\\u002fscript\\u003e');
  });

  it('drops prototype-pollution keys', () => {
    const boundary = createResumableBoundary('b');
    boundary.signal('__proto__', { polluted: true }).signal('safe', 1);
    const snapshot = boundary.toJSON();
    expect(Object.prototype.hasOwnProperty.call(snapshot.signals, '__proto__')).toBe(false);
    expect(snapshot.signals.safe).toBe(1);
  });

  it('aggregates multiple boundaries in a graph', () => {
    const graph = createResumableGraph();
    graph.boundary('a').signal('x', 1);
    graph.boundary('b').signal('y', 2);
    const json = graph.toJSON();
    expect(json.boundaries.map((b) => b.id).sort()).toEqual(['a', 'b']);
    expect(graph.render()).toContain('window["__BQUERY_RESUME_GRAPH__"]=');
  });
});

describe('#129 resumable boundaries — client resume', () => {
  const GLOBAL = '__BQUERY_RESUME_GRAPH__';
  const win = window as unknown as Record<string, unknown>;

  afterEach(() => {
    delete win[GLOBAL];
    document.body.replaceChildren();
    try {
      destroyStore('cart');
    } catch {
      /* ok */
    }
  });

  const publish = (graph: SerializedResumableGraph): void => {
    win[GLOBAL] = graph;
  };

  it('seeds signals, wires handlers by id and rehydrates stores in place', () => {
    const store = createStore({ id: 'cart', state: () => ({ items: 0 }) });
    const root = document.createElement('div');
    root.innerHTML =
      '<section data-bq-resume="cart"><button data-bq-handler="addItem" data-bq-event="click">+</button></section>';
    document.body.appendChild(root);

    publish({
      boundaries: [
        { id: 'cart', signals: { count: 42 }, handlers: ['addItem'], stores: { cart: { items: 5 } } },
      ],
    });

    const count = signal(0);
    let fired = 0;
    const result = resume({
      root,
      signals: { count },
      handlers: { addItem: () => (fired += 1) },
      hydrateStores: true,
    });

    expect(result.resumed).toBe(true);
    expect(result.boundaries).toEqual(['cart']);
    expect(result.seededSignals).toEqual(['count']);
    expect(count.value).toBe(42);
    expect(result.wiredHandlers).toBe(1);

    root.querySelector('button')!.dispatchEvent(new Event('click'));
    expect(fired).toBe(1);

    // Store slice rehydrated in place without re-running actions.
    expect(store.items).toBe(5);

    // Snapshot global is cleaned up after resume.
    expect(win[GLOBAL]).toBeUndefined();
  });

  it('returns an empty result when no snapshot is present', () => {
    delete win[GLOBAL];
    const result = resume();
    expect(result.resumed).toBe(false);
    expect(result.boundaries).toHaveLength(0);
  });

  it('ignores unknown signal keys and unregistered handlers', () => {
    publish({ boundaries: [{ id: 'x', signals: { ghost: 1 }, handlers: [], stores: {} }] });
    const result = resume({ signals: {}, handlers: {} });
    expect(result.resumed).toBe(true);
    expect(result.seededSignals).toHaveLength(0);
    expect(result.wiredHandlers).toBe(0);
  });
});

describe('#176 bq-style CSS injection guard', () => {
  for (const backend of BACKENDS) {
    describe(`backend: ${backend}`, () => {
      it('drops style values that try to inject extra declarations', () => {
        withBackend(backend, () => {
          const html = renderToString('<div bq-style="styles"></div>', {
            styles: { width: 'x;} body{display:none' },
          }).html;
          expect(html).not.toContain('display:none');
          expect(html).not.toContain('body{');
        });
      });

      it('keeps safe style declarations', () => {
        withBackend(backend, () => {
          const html = renderToString('<div bq-style="styles"></div>', {
            styles: { color: 'red', marginTop: '4px' },
          }).html;
          expect(html).toContain('color: red');
          expect(html).toContain('margin-top: 4px');
        });
      });
    });
  }
});

describe('#163 bq-text escaping on raw-text elements', () => {
  for (const backend of BACKENDS) {
    describe(`backend: ${backend}`, () => {
      it('escapes bq-text values inside <textarea>', () => {
        withBackend(backend, () => {
          const html = renderToString('<textarea bq-text="msg"></textarea>', {
            msg: '</textarea><img src=x onerror=alert(1)>',
          }).html;
          expect(html).not.toContain('<img');
          expect(html).toContain('&lt;/textarea&gt;');
        });
      });

      it('escapes bq-text values inside <title>', () => {
        withBackend(backend, () => {
          const html = renderToString('<title bq-text="msg"></title>', {
            msg: '</title><script>alert(1)</script>',
          }).html;
          expect(html).not.toContain('<script>');
        });
      });

      it('leaves bq-text on normal elements escaped exactly once', () => {
        withBackend(backend, () => {
          const html = renderToString('<p bq-text="msg"></p>', {
            msg: '<b>&amp;</b>',
          }).html;
          expect(html).toContain('&lt;b&gt;');
          expect(html).not.toContain('&amp;amp;amp;');
        });
      });
    });
  }
});

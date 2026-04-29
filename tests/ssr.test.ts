/**
 * Tests for SSR / Pre-rendering module.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { signal, computed } from '../src/reactive/index';
import type { HydrateMountOptions } from '../src/ssr/index';
import { createStore, destroyStore, listStores } from '../src/store/index';
import {
  configureSSR,
  getSSRConfig,
  renderToString,
  hydrateMount,
  serializeStoreState,
  deserializeStoreState,
  hydrateStore,
  hydrateStores,
} from '../src/ssr/index';

// ============================================================================
// renderToString
// ============================================================================
describe('renderToString', () => {
  it('renders a simple template with bq-text', () => {
    const result = renderToString('<div><h1 bq-text="title"></h1></div>', { title: 'Hello World' });
    expect(result.html).toContain('Hello World');
    expect(result.html).toContain('<h1');
  });

  it('renders bq-text with signal values', () => {
    const title = signal('From Signal');
    const result = renderToString('<div><span bq-text="title"></span></div>', { title });
    expect(result.html).toContain('From Signal');
  });

  it('renders bq-text with computed values', () => {
    const name = signal('World');
    const greeting = computed(() => `Hello, ${name.value}!`);
    const result = renderToString('<div><p bq-text="greeting"></p></div>', { greeting });
    expect(result.html).toContain('Hello, World!');
  });

  it('renders bq-text with null/undefined as empty string', () => {
    const result = renderToString('<div><span bq-text="missing"></span></div>', { missing: null });
    expect(result.html).toContain('<span bq-text="missing"></span>');
  });

  it('renders bq-if: truthy condition keeps element', () => {
    const result = renderToString('<div><p bq-if="show">Visible</p></div>', { show: true });
    expect(result.html).toContain('Visible');
  });

  it('renders bq-if: falsy condition removes element', () => {
    const result = renderToString('<div><p bq-if="show">Hidden</p></div>', { show: false });
    expect(result.html).not.toContain('Hidden');
    expect(result.html).not.toContain('<p');
  });

  it('renders bq-if with negation', () => {
    const result = renderToString('<div><p bq-if="!hidden">Shown</p></div>', { hidden: false });
    expect(result.html).toContain('Shown');
  });

  it('renders bq-if with signal', () => {
    const show = signal(true);
    const result = renderToString('<div><p bq-if="show">Visible</p></div>', { show });
    expect(result.html).toContain('Visible');
  });

  it('renders bq-show: falsy condition adds display:none', () => {
    const result = renderToString('<div><p bq-show="visible">Content</p></div>', {
      visible: false,
    });
    expect(result.html).toContain('display: none');
  });

  it('renders bq-show: truthy condition keeps display', () => {
    const result = renderToString('<div><p bq-show="visible">Content</p></div>', { visible: true });
    expect(result.html).not.toContain('display: none');
    expect(result.html).toContain('Content');
  });

  it('renders bq-for: basic list', () => {
    const result = renderToString('<ul><li bq-for="item in items" bq-text="item.name"></li></ul>', {
      items: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }],
    });
    expect(result.html).toContain('Alice');
    expect(result.html).toContain('Bob');
    expect(result.html).toContain('Charlie');
    // Should have 3 <li> elements
    const liCount = (result.html.match(/<li/g) || []).length;
    expect(liCount).toBe(3);
  });

  it('renders bq-for: with index', () => {
    const result = renderToString('<ul><li bq-for="(item, i) in items" bq-text="i"></li></ul>', {
      items: ['a', 'b', 'c'],
    });
    expect(result.html).toContain('0');
    expect(result.html).toContain('1');
    expect(result.html).toContain('2');
  });

  it('renders bq-for: with signal array', () => {
    const items = signal([{ name: 'X' }, { name: 'Y' }]);
    const result = renderToString('<ul><li bq-for="item in items" bq-text="item.name"></li></ul>', {
      items,
    });
    expect(result.html).toContain('X');
    expect(result.html).toContain('Y');
  });

  it('renders bq-for: empty array produces no children', () => {
    const result = renderToString('<ul><li bq-for="item in items" bq-text="item"></li></ul>', {
      items: [],
    });
    const liCount = (result.html.match(/<li/g) || []).length;
    expect(liCount).toBe(0);
  });

  it('renders bq-class: object syntax', () => {
    const result = renderToString(
      '<div><span bq-class="{ active: isActive, disabled: isDisabled }">text</span></div>',
      { isActive: true, isDisabled: false }
    );
    // The rendered span should have the 'active' class added
    expect(result.html).toContain('class="active"');
    // The 'disabled' class should NOT appear in the class attribute
    expect(result.html).not.toContain('class="active disabled"');
  });

  it('renders bq-class: string expression', () => {
    const result = renderToString('<div><span bq-class="cls">text</span></div>', {
      cls: 'highlight bold',
    });
    expect(result.html).toContain('highlight');
    expect(result.html).toContain('bold');
  });

  it('renders bq-bind:attr', () => {
    const result = renderToString('<div><a bq-bind:href="url">Link</a></div>', {
      url: 'https://example.com',
    });
    expect(result.html).toContain('href="https://example.com"');
  });

  it('renders bq-bind:attr with boolean false (removes attribute)', () => {
    const result = renderToString(
      '<div><button bq-bind:disabled="isDisabled">Click</button></div>',
      { isDisabled: false },
      { stripDirectives: true }
    );
    // With stripDirectives, the bq-bind:disabled attribute is removed
    // and since isDisabled=false, the 'disabled' attribute should NOT be set
    expect(result.html).not.toContain(' disabled');
  });

  it('renders bq-bind:attr with boolean true (sets empty attribute)', () => {
    const result = renderToString(
      '<div><button bq-bind:disabled="isDisabled">Click</button></div>',
      { isDisabled: true }
    );
    expect(result.html).toContain('disabled');
  });

  it('renders bq-html', () => {
    const result = renderToString('<div><span bq-html="content"></span></div>', {
      content: '<strong onclick="alert(1)">Bold</strong><script>alert(1)</script>',
    });
    expect(result.html).toContain('<strong>Bold</strong>');
    expect(result.html).not.toContain('onclick=');
    expect(result.html).not.toContain('<script');
  });

  it('drops unsafe script elements and inline event handlers from the template output', () => {
    const result = renderToString(
      '<div onclick="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">Bad</a><button>Safe</button></div>',
      {}
    );

    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('onclick=');
    expect(result.html).not.toContain('javascript:alert(1)');
    expect(result.html).toContain('<button>Safe</button>');
  });

  it('strips directive attributes when stripDirectives is true', () => {
    const result = renderToString(
      '<div><h1 bq-text="title">placeholder</h1></div>',
      { title: 'Hello' },
      { stripDirectives: true }
    );
    expect(result.html).not.toContain('bq-text');
    expect(result.html).toContain('Hello');
  });

  it('keeps directive attributes when stripDirectives is false', () => {
    const result = renderToString(
      '<div><h1 bq-text="title">placeholder</h1></div>',
      { title: 'Hello' },
      { stripDirectives: false }
    );
    expect(result.html).toContain('bq-text');
  });

  it('supports custom prefix', () => {
    const result = renderToString(
      '<div><span x-text="title"></span></div>',
      { title: 'Custom' },
      { prefix: 'x' }
    );
    expect(result.html).toContain('Custom');
  });

  it('falls back to the DOM-free pure renderer when DOMParser is unavailable', () => {
    const originalDOMParser = globalThis.DOMParser;
    const previousConfig = getSSRConfig();

    try {
      configureSSR({ backend: 'auto', documentImpl: null });
      Object.defineProperty(globalThis, 'DOMParser', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const result = renderToString(
        '<div><span bq-text="title"></span><span bq-html="content"></span></div>',
        {
          title: 'Pure',
          content: '<strong onclick="alert(1)">Bold</strong><script>alert(1)</script>',
        }
      );
      expect(result.html).toContain('Pure');
      expect(result.html).toContain('<strong>Bold</strong>');
      expect(result.html).not.toContain('onclick=');
      expect(result.html).not.toContain('<script');
    } finally {
      configureSSR(previousConfig);
      Object.defineProperty(globalThis, 'DOMParser', {
        value: originalDOMParser,
        configurable: true,
        writable: true,
      });
    }
  });

  it('renders nested elements correctly', () => {
    const result = renderToString(
      '<div><section bq-if="show"><h2 bq-text="title"></h2><p bq-text="body"></p></section></div>',
      { show: true, title: 'Title', body: 'Body text' }
    );
    expect(result.html).toContain('Title');
    expect(result.html).toContain('Body text');
  });

  it('renders deeply nested bq-if correctly', () => {
    const result = renderToString(
      '<div><div bq-if="outer"><span bq-if="inner">Deep</span></div></div>',
      { outer: true, inner: false }
    );
    expect(result.html).not.toContain('Deep');
    expect(result.html).toContain('<div');
  });

  it('throws for empty template', () => {
    expect(() => renderToString('', {})).toThrow('template must be a non-empty string');
  });

  it('throws for non-string template', () => {
    expect(() => renderToString(null as unknown as string, {})).toThrow();
  });

  it('handles template with multiple root elements', () => {
    const result = renderToString('<h1 bq-text="a"></h1><p bq-text="b"></p>', {
      a: 'Title',
      b: 'Para',
    });
    expect(result.html).toContain('Title');
    expect(result.html).toContain('Para');
  });

  it('renders bq-for with nested bq-text', () => {
    const result = renderToString(
      '<div><div bq-for="user in users"><span bq-text="user.name"></span><span bq-text="user.age"></span></div></div>',
      {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      }
    );
    expect(result.html).toContain('Alice');
    expect(result.html).toContain('30');
    expect(result.html).toContain('Bob');
    expect(result.html).toContain('25');
  });

  it('renders dot-notation access in bq-text', () => {
    const result = renderToString('<div><span bq-text="user.name"></span></div>', {
      user: { name: 'Deep Value' },
    });
    expect(result.html).toContain('Deep Value');
  });

  it('includes store state when includeStoreState is true', () => {
    createStore({
      id: 'ssr-render-test',
      state: () => ({ count: 99 }),
    });
    try {
      const result = renderToString(
        '<div><span bq-text="title"></span></div>',
        { title: 'Hi' },
        { includeStoreState: true }
      );
      expect(result.storeState).toBeDefined();
      expect(result.storeState).toContain('ssr-render-test');
      expect(result.storeState).toContain('99');
    } finally {
      destroyStore('ssr-render-test');
    }
  });

  it('includes only specified store IDs when includeStoreState is array', () => {
    createStore({ id: 'ssr-a', state: () => ({ x: 1 }) });
    createStore({ id: 'ssr-b', state: () => ({ y: 2 }) });
    try {
      const result = renderToString('<div></div>', {}, { includeStoreState: ['ssr-a'] });
      expect(result.storeState).toContain('ssr-a');
      expect(result.storeState).not.toContain('ssr-b');
    } finally {
      destroyStore('ssr-a');
      destroyStore('ssr-b');
    }
  });
});

// ============================================================================
// serializeStoreState / deserializeStoreState
// ============================================================================
describe('serializeStoreState', () => {
  afterEach(() => {
    // Clean up stores
    for (const id of listStores()) {
      if (id.startsWith('serialize-')) {
        destroyStore(id);
      }
    }
  });

  it('serializes all stores by default', () => {
    createStore({ id: 'serialize-a', state: () => ({ val: 'hello' }) });
    createStore({ id: 'serialize-b', state: () => ({ num: 42 }) });

    const result = serializeStoreState();
    const parsed = JSON.parse(result.stateJson);
    expect(parsed['serialize-a']).toEqual({ val: 'hello' });
    expect(parsed['serialize-b']).toEqual({ num: 42 });
  });

  it('serializes specific stores by ID', () => {
    createStore({ id: 'serialize-x', state: () => ({ a: 1 }) });
    createStore({ id: 'serialize-y', state: () => ({ b: 2 }) });

    const result = serializeStoreState({ storeIds: ['serialize-x'] });
    const parsed = JSON.parse(result.stateJson);
    expect(parsed['serialize-x']).toEqual({ a: 1 });
    expect(parsed['serialize-y']).toBeUndefined();
  });

  it('generates a valid script tag', () => {
    createStore({ id: 'serialize-tag', state: () => ({ v: 'test' }) });

    const result = serializeStoreState({ storeIds: ['serialize-tag'] });
    expect(result.scriptTag).toContain('<script');
    expect(result.scriptTag).toContain('__BQUERY_STORE_STATE__');
    expect(result.scriptTag).toContain('__BQUERY_INITIAL_STATE__');
    expect(result.scriptTag).toContain('</script>');
  });

  it('uses custom scriptId and globalKey', () => {
    createStore({ id: 'serialize-custom', state: () => ({ z: 0 }) });

    const result = serializeStoreState({
      storeIds: ['serialize-custom'],
      scriptId: 'my-state',
      globalKey: 'MY_STATE',
    });
    expect(result.scriptTag).toContain('id="my-state"');
    expect(result.scriptTag).toContain('MY_STATE');
  });

  it('escapes custom scriptId values for attribute context', () => {
    createStore({ id: 'serialize-safe-id', state: () => ({ z: 2 }) });

    const result = serializeStoreState({
      storeIds: ['serialize-safe-id'],
      scriptId: 'bad" onclick="alert(1)',
    });

    expect(result.scriptTag).not.toContain('id="bad" onclick="alert(1)"');
    expect(result.scriptTag).toContain('&quot;');
  });

  it('supports custom globalKey values that are not valid identifiers', () => {
    createStore({ id: 'serialize-custom-key', state: () => ({ z: 1 }) });

    const result = serializeStoreState({
      storeIds: ['serialize-custom-key'],
      globalKey: 'my-state',
    });

    expect(result.scriptTag).toContain('window["my-state"]=');
    expect(result.scriptTag).not.toContain('window.my-state=');
  });

  it('uses custom serializer', () => {
    createStore({ id: 'serialize-ser', state: () => ({ k: 'v' }) });
    let serializerArg: unknown;

    const result = serializeStoreState({
      storeIds: ['serialize-ser'],
      serialize: (data) => {
        serializerArg = data;
        return JSON.stringify(data, null, 2);
      },
    });
    expect(result.stateJson).toContain('  '); // indented JSON
    expect(serializerArg).toEqual({ 'serialize-ser': { k: 'v' } });
  });

  it('throws when custom serializer returns invalid JSON', () => {
    createStore({ id: 'serialize-invalid-json', state: () => ({ bad: true }) });

    expect(() =>
      serializeStoreState({
        storeIds: ['serialize-invalid-json'],
        serialize: (() => '{invalid json}') as (data: unknown) => string,
      })
    ).toThrow('serializeStoreState: custom serialize function returned invalid JSON.');
  });

  it('throws when custom serializer returns non-object JSON', () => {
    createStore({ id: 'serialize-non-object-json', state: () => ({ bad: true }) });

    expect(() =>
      serializeStoreState({
        storeIds: ['serialize-non-object-json'],
        serialize: (() => '[]') as (data: unknown) => string,
      })
    ).toThrow('serializeStoreState: custom serialize function must return a JSON object string.');
  });

  it('does not re-parse JSON when using the default serializer', () => {
    createStore({ id: 'serialize-default-json', state: () => ({ ok: true }) });
    const originalParse = JSON.parse;

    JSON.parse = (() => {
      throw new Error('default serializer should not re-parse');
    }) as typeof JSON.parse;

    try {
      const result = serializeStoreState({ storeIds: ['serialize-default-json'] });
      expect(result.stateJson).toBe('{"serialize-default-json":{"ok":true}}');
    } finally {
      JSON.parse = originalParse;
    }
  });

  it('escapes dangerous HTML characters in script tag', () => {
    createStore({
      id: 'serialize-xss',
      state: () => ({ val: '</script><script>alert(1)</script>' }),
    });

    const result = serializeStoreState({ storeIds: ['serialize-xss'] });
    // Should NOT contain literal </script>
    expect(result.scriptTag).not.toContain('</script><script>');
    // Should contain escaped version
    expect(result.scriptTag).toContain('\\u003c');
  });

  it('returns empty map for non-existent store IDs', () => {
    const result = serializeStoreState({ storeIds: ['does-not-exist'] });
    const parsed = JSON.parse(result.stateJson);
    expect(Object.keys(parsed).length).toBe(0);
  });

  it('skips dangerous store IDs during serialization', () => {
    createStore({ id: 'serialize-safe', state: () => ({ value: 1 }) });
    createStore({ id: '__proto__', state: () => ({ ignored: true }) });

    try {
      const result = serializeStoreState({ storeIds: ['serialize-safe', '__proto__'] });
      const parsed = JSON.parse(result.stateJson) as Record<string, Record<string, unknown>>;

      expect(parsed['serialize-safe']).toEqual({ value: 1 });
      expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(false);
    } finally {
      destroyStore('__proto__');
    }
  });

  it('sanitizes dangerous top-level store state keys during serialization', () => {
    const pollutedState = Object.assign(Object.create(null), {
      safe: 'ok',
      constructor: 'bad',
      prototype: 'bad',
      ['__proto__']: 'bad',
    }) as Record<string, unknown>;

    createStore({ id: 'serialize-pollution', state: () => pollutedState });

    const result = serializeStoreState({ storeIds: ['serialize-pollution'] });
    const parsed = JSON.parse(result.stateJson) as Record<string, Record<string, unknown>>;

    expect(parsed['serialize-pollution']).toEqual({ safe: 'ok' });
  });

  it('throws for dangerous global keys during serialization', () => {
    expect(() => serializeStoreState({ globalKey: '__proto__' })).toThrow(
      'serializeStoreState: invalid globalKey "__proto__" - prototype-pollution keys are not allowed.'
    );
  });

  it('throws for dangerous script IDs during serialization', () => {
    expect(() => serializeStoreState({ scriptId: 'constructor' })).toThrow(
      'serializeStoreState: invalid scriptId "constructor" - prototype-pollution keys are not allowed.'
    );
  });
});

describe('deserializeStoreState', () => {
  afterEach(() => {
    // Clean up
    delete (window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__;
  });

  it('returns empty object when no state is set', () => {
    const state = deserializeStoreState();
    expect(state).toEqual({});
  });

  it('returns empty object when window is undefined', () => {
    // Even with happy-dom, if the key doesn't exist:
    const state = deserializeStoreState('__NONEXISTENT_KEY__');
    expect(state).toEqual({});
  });

  it('reads and cleans up global state', () => {
    (window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__ = {
      myStore: { count: 5 },
    };

    const state = deserializeStoreState();
    expect(state).toEqual({ myStore: { count: 5 } });

    // Global should be cleaned up
    expect((window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__).toBeUndefined();
  });

  it('removes a custom scriptId during cleanup', () => {
    (window as unknown as Record<string, unknown>).CUSTOM_STATE = {
      myStore: { count: 1 },
    };

    const script = document.createElement('script');
    script.id = 'custom-ssr-state';
    document.body.appendChild(script);

    const state = deserializeStoreState('CUSTOM_STATE', 'custom-ssr-state');

    expect(state).toEqual({ myStore: { count: 1 } });
    expect(document.getElementById('custom-ssr-state')).toBeNull();
  });

  it('skips script cleanup when document APIs are unavailable', () => {
    const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

    try {
      Object.defineProperty(globalThis, 'document', {
        value: undefined,
        configurable: true,
      });

      (window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__ = {
        myStore: { count: 2 },
      };

      const state = deserializeStoreState();

      expect(state).toEqual({ myStore: { count: 2 } });
      expect(
        (window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__
      ).toBeUndefined();
    } finally {
      if (originalDocumentDescriptor) {
        Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
      }
    }
  });

  it('returns empty object for non-object values', () => {
    (window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__ = 'not an object';
    const state = deserializeStoreState();
    expect(state).toEqual({});
  });

  it('returns empty object for array state values', () => {
    (window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__ = [];
    const state = deserializeStoreState();
    expect(state).toEqual({});
  });

  it('returns empty object when a store entry is not an object', () => {
    (window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__ = {
      myStore: 'invalid',
    };

    const state = deserializeStoreState();
    expect(state).toEqual({});
  });

  it('sanitizes dangerous store IDs and state keys during deserialization', () => {
    const stateMap = Object.create(null) as Record<string, unknown>;
    stateMap.safeStore = Object.assign(Object.create(null), {
      safe: 'ok',
      constructor: 'bad',
    }) as Record<string, unknown>;
    stateMap['__proto__'] = { polluted: true };
    stateMap['constructor'] = { polluted: true };

    (window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__ = stateMap;

    const state = deserializeStoreState();

    expect(state).toEqual({ safeStore: { safe: 'ok' } });
    expect(Object.prototype.hasOwnProperty.call(state, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(state, 'constructor')).toBe(false);
  });

  it('rejects prototype-pollution globalKey values before touching window state', () => {
    const originalWindowPrototype = Object.getPrototypeOf(window);

    expect(() => deserializeStoreState('__proto__')).toThrow(
      'deserializeStoreState: invalid globalKey "__proto__" - prototype-pollution keys are not allowed.'
    );

    expect(Object.getPrototypeOf(window)).toBe(originalWindowPrototype);
    expect((window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__).toBeUndefined();
  });

  it('rejects prototype-pollution scriptId values before cleanup side effects', () => {
    const stateMap = {
      safeStore: { count: 1 },
    };
    (window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__ = stateMap;

    const script = document.createElement('script');
    script.id = 'safe-ssr-state';
    document.body.appendChild(script);

    const originalWindowPrototype = Object.getPrototypeOf(window);

    expect(() => deserializeStoreState('__BQUERY_INITIAL_STATE__', '__proto__')).toThrow(
      'deserializeStoreState: invalid scriptId "__proto__" - prototype-pollution keys are not allowed.'
    );

    expect(Object.getPrototypeOf(window)).toBe(originalWindowPrototype);
    expect((window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__).toBe(stateMap);
    expect(document.getElementById('safe-ssr-state')).toBe(script);

    script.remove();
    delete (window as unknown as Record<string, unknown>).__BQUERY_INITIAL_STATE__;
  });
});

// ============================================================================
// hydrateStore / hydrateStores
// ============================================================================
describe('hydrateStore', () => {
  afterEach(() => {
    for (const id of listStores()) {
      if (id.startsWith('hydrate-')) {
        destroyStore(id);
      }
    }
  });

  it('patches store with deserialized state', () => {
    const store = createStore({
      id: 'hydrate-patch',
      state: () => ({ count: 0, name: 'initial' }),
    });

    hydrateStore('hydrate-patch', { count: 42, name: 'hydrated' });
    expect(store.count).toBe(42);
    expect(store.name).toBe('hydrated');
  });

  it('partially patches store state', () => {
    const store = createStore({
      id: 'hydrate-partial',
      state: () => ({ a: 1, b: 2 }),
    });

    hydrateStore('hydrate-partial', { a: 10 });
    expect(store.a).toBe(10);
    expect(store.b).toBe(2); // unchanged
  });

  it('ignores non-existent stores', () => {
    // Should not throw
    hydrateStore('hydrate-nonexistent', { x: 1 });
  });

  it('filters prototype-pollution keys before patching hydrated state', () => {
    const store = createStore({
      id: 'hydrate-sanitized',
      state: () => ({ safe: 'initial' }),
    });

    hydrateStore('hydrate-sanitized', {
      safe: 'hydrated',
      __proto__: { polluted: true },
      constructor: 'ignored',
      prototype: 'ignored',
    } as Record<string, unknown>);

    expect(store.safe).toBe('hydrated');
    expect((store as unknown as Record<string, unknown>).constructor).not.toBe('ignored');
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('hydrateStores', () => {
  afterEach(() => {
    for (const id of listStores()) {
      if (id.startsWith('hydrate-all-')) {
        destroyStore(id);
      }
    }
  });

  it('hydrates multiple stores at once', () => {
    const s1 = createStore({
      id: 'hydrate-all-a',
      state: () => ({ val: 0 }),
    });
    const s2 = createStore({
      id: 'hydrate-all-b',
      state: () => ({ val: 0 }),
    });

    hydrateStores({
      'hydrate-all-a': { val: 100 },
      'hydrate-all-b': { val: 200 },
    });

    expect(s1.val).toBe(100);
    expect(s2.val).toBe(200);
  });

  it('skips stores that do not exist', () => {
    const s1 = createStore({
      id: 'hydrate-all-c',
      state: () => ({ val: 0 }),
    });

    // Should not throw even if 'missing' doesn't exist
    hydrateStores({
      'hydrate-all-c': { val: 50 },
      missing: { val: 99 },
    });

    expect(s1.val).toBe(50);
  });
});

// ============================================================================
// hydrateMount
// ============================================================================
describe('hydrateMount', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'hydrate-app';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('attaches reactivity to pre-rendered DOM', () => {
    // Simulate server-rendered HTML
    container.innerHTML = '<h1 bq-text="title">Server Title</h1>';

    const title = signal('Server Title');
    const view = hydrateMount(container, { title }, { hydrate: true });

    expect(view.el).toBe(container);
    expect(container.querySelector('h1')!.textContent).toBe('Server Title');

    // Now update reactively
    title.value = 'Client Title';
    expect(container.querySelector('h1')!.textContent).toBe('Client Title');

    view.destroy();
  });

  it('preserves existing DOM structure', () => {
    container.innerHTML = '<ul><li>Item 1</li><li>Item 2</li></ul>';

    const view = hydrateMount(container, {}, { hydrate: true });

    // DOM should still have the items
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('Item 1');

    view.destroy();
  });

  it('supports bq-if hydration', () => {
    container.innerHTML = '<p bq-if="show">Conditional</p>';

    const show = signal(true);
    const view = hydrateMount(container, { show }, { hydrate: true });

    expect(container.querySelector('p')).not.toBeNull();

    show.value = false;
    expect(container.querySelector('p')).toBeNull();

    show.value = true;
    expect(container.querySelector('p')).not.toBeNull();

    view.destroy();
  });

  it('supports bq-class hydration', () => {
    container.innerHTML = '<span bq-class="{ active: isActive }">text</span>';

    const isActive = signal(false);
    const view = hydrateMount(container, { isActive }, { hydrate: true });

    const span = container.querySelector('span')!;
    expect(span.classList.contains('active')).toBe(false);

    isActive.value = true;
    expect(span.classList.contains('active')).toBe(true);

    view.destroy();
  });

  it('returns a view with destroy method', () => {
    container.innerHTML = '<span bq-text="val">0</span>';

    const val = signal(0);
    const view = hydrateMount(container, { val }, { hydrate: true });

    val.value = 1;
    expect(container.querySelector('span')!.textContent).toBe('1');

    view.destroy();

    // After destroy, updates should not propagate
    val.value = 2;
    expect(container.querySelector('span')!.textContent).toBe('1');
  });

  it('throws when hydrate is explicitly set to false', () => {
    container.innerHTML = '<h1 bq-text="title">Server Title</h1>';

    expect(() =>
      hydrateMount(container, {}, { hydrate: false } as unknown as HydrateMountOptions)
    ).toThrow('bQuery ssr: hydrateMount() requires { hydrate: true } when options are provided.');
  });
});

// ============================================================================
// Integration: renderToString → hydrateMount
// ============================================================================
describe('SSR → Hydration integration', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'ssr-integration';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    for (const id of listStores()) {
      if (id.startsWith('integration-')) {
        destroyStore(id);
      }
    }
  });

  it('renders on server then hydrates on client', () => {
    // Server side
    const serverResult = renderToString(
      '<div><h1 bq-text="title"></h1><p bq-text="body"></p></div>',
      { title: 'SSR Title', body: 'SSR Body' }
    );

    // Transfer to client (simulate server-rendered HTML insertion)
    container.innerHTML = serverResult.html;

    // Client side hydration
    const title = signal('SSR Title');
    const body = signal('SSR Body');
    const view = hydrateMount(
      container.firstElementChild! as Element,
      { title, body },
      { hydrate: true }
    );

    // Content should match server render
    expect(container.querySelector('h1')!.textContent).toBe('SSR Title');
    expect(container.querySelector('p')!.textContent).toBe('SSR Body');

    // Now client-side updates work
    title.value = 'Updated Title';
    expect(container.querySelector('h1')!.textContent).toBe('Updated Title');

    view.destroy();
  });

  it('full SSR flow with store serialization and hydration', () => {
    // Server side: create store, render template, serialize
    const serverStore = createStore({
      id: 'integration-counter',
      state: () => ({ count: 42 }),
    });

    renderToString('<div><span bq-text="count"></span></div>', { count: serverStore.count });

    const { stateJson } = serializeStoreState({ storeIds: ['integration-counter'] });

    // Clean up server store
    destroyStore('integration-counter');

    // Client side: recreate store, apply SSR state
    const clientStore = createStore({
      id: 'integration-counter',
      state: () => ({ count: 0 }),
    });

    const ssrState = JSON.parse(stateJson);
    if (ssrState['integration-counter']) {
      hydrateStore('integration-counter', ssrState['integration-counter']);
    }

    expect(clientStore.count).toBe(42);
  });
});

// ============================================================================
// Module exports
// ============================================================================
describe('SSR module exports', () => {
  it('exports renderToString', () => {
    expect(typeof renderToString).toBe('function');
  });

  it('exports hydrateMount', () => {
    expect(typeof hydrateMount).toBe('function');
  });

  it('exports serializeStoreState', () => {
    expect(typeof serializeStoreState).toBe('function');
  });

  it('exports deserializeStoreState', () => {
    expect(typeof deserializeStoreState).toBe('function');
  });

  it('exports hydrateStore', () => {
    expect(typeof hydrateStore).toBe('function');
  });

  it('exports hydrateStores', () => {
    expect(typeof hydrateStores).toBe('function');
  });

  it('is re-exported from main index', async () => {
    const mainExports = await import('../src/index');
    expect(typeof mainExports.renderToString).toBe('function');
    expect(typeof mainExports.hydrateMount).toBe('function');
    expect(typeof mainExports.serializeStoreState).toBe('function');
    expect(typeof mainExports.deserializeStoreState).toBe('function');
    expect(typeof mainExports.hydrateStore).toBe('function');
    expect(typeof mainExports.hydrateStores).toBe('function');
  });

  it('is exported from full bundle', async () => {
    const fullExports = await import('../src/full');
    expect(typeof fullExports.renderToString).toBe('function');
    expect(typeof fullExports.hydrateMount).toBe('function');
    expect(typeof fullExports.serializeStoreState).toBe('function');
    expect(typeof fullExports.deserializeStoreState).toBe('function');
    expect(typeof fullExports.hydrateStore).toBe('function');
    expect(typeof fullExports.hydrateStores).toBe('function');
  });
});

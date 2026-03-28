import { describe, expect, it, spyOn } from 'bun:test';
import type {
  ComponentDefinition,
  ComponentRenderContext,
  ComponentSignalLike,
} from '../src/component/index';
import {
  bool,
  component,
  defineComponent,
  html,
  registerDefaultComponents,
  safeHtml,
  useComputed,
  useEffect,
  useSignal,
} from '../src/component/index';
import { computed, signal } from '../src/reactive/index';
import { sanitizeHtml, trusted } from '../src/security/sanitize';

const expectType = <T>(_value: T): void => {};

describe('component/html', () => {
  it('creates HTML from template literal', () => {
    const result = html`<div>Hello</div>`;
    expect(result).toBe('<div>Hello</div>');
  });

  it('interpolates values correctly', () => {
    const name = 'World';
    const result = html`<span>Hello ${name}</span>`;
    expect(result).toBe('<span>Hello World</span>');
  });

  it('handles multiple interpolations', () => {
    const first = 'Hello';
    const second = 'World';
    const result = html`<div>${first} ${second}!</div>`;
    expect(result).toBe('<div>Hello World!</div>');
  });

  it('handles null and undefined values', () => {
    const result = html`<div>${null}${undefined}</div>`;
    expect(result).toBe('<div></div>');
  });

  it('handles numeric values', () => {
    const count = 42;
    const result = html`<span>Count: ${count}</span>`;
    expect(result).toBe('<span>Count: 42</span>');
  });

  it('handles boolean values', () => {
    const result = html`<span>${true} ${false}</span>`;
    expect(result).toBe('<span>true false</span>');
  });

  it('escapes interpolated values in safeHtml templates', () => {
    const result = safeHtml`<div>${'<strong>Hello</strong>'}</div>`;
    expect(String(result)).toBe('<div>&lt;strong&gt;Hello&lt;/strong&gt;</div>');
  });

  it('splices trusted sanitized fragments into safeHtml templates without double-escaping', () => {
    const icon = trusted(sanitizeHtml('<strong onclick="alert(1)">Hi</strong>'));
    const result = safeHtml`<div>${icon}</div>`;

    expect(String(result)).toBe('<div><strong>Hi</strong></div>');
  });

  it('can compose trusted safeHtml fragments', () => {
    const icon = trusted(safeHtml`<span class="icon">&hearts;</span>`);
    const result = safeHtml`<button>${icon}<span>${'Save & Close'}</span></button>`;

    expect(String(result)).toBe(
      '<button><span class="icon">&hearts;</span><span>Save &amp; Close</span></button>'
    );
  });
  it('renders multiple enabled boolean attributes without values', () => {
    const result = html`<button ${bool('disabled', true)} ${bool('loading', true)}>Save</button>`;
    expect(result).toBe('<button disabled loading>Save</button>');
  });

  it('omits disabled boolean attributes entirely', () => {
    const result = html`<button ${bool('disabled', false)}>Save</button>`;
    expect(result).toBe('<button >Save</button>');
  });

  it('supports boolean attributes in safeHtml templates', () => {
    const result = safeHtml`<button ${bool('disabled', true)}>${'<Save>'}</button>`;
    expect(String(result)).toBe('<button disabled>&lt;Save&gt;</button>');
  });

  it('does not escape boolean attribute markers in safeHtml templates', () => {
    const result = safeHtml`<button ${bool('data-safe&sound', true)}>Save</button>`;
    expect(String(result)).toBe('<button data-safe&sound>Save</button>');
  });

  it('rejects invalid boolean attribute names', () => {
    expect(() => bool('disabled="true"', true)).toThrow(
      'Invalid boolean attribute name: disabled="true"'
    );
  });

  it('returns an immutable boolean attribute marker', () => {
    expect(Object.isFrozen(bool('disabled', true))).toBe(true);
  });
});

describe('component/component', () => {
  it('registers a custom element', () => {
    const tagName = `test-component-${Date.now()}`;

    component(tagName, {
      props: {},
      render: () => html`<div>Test</div>`,
    });

    expect(customElements.get(tagName)).toBeDefined();
  });

  it('defines observed attributes from props', () => {
    const tagName = `test-props-${Date.now()}`;

    component(tagName, {
      props: {
        name: { type: String, required: true },
        count: { type: Number, default: 0 },
      },
      render: ({ props }) => html`<div>${props.name}: ${props.count}</div>`,
    });

    const ElementClass = customElements.get(tagName);
    expect(ElementClass).toBeDefined();
    // Check if observedAttributes is defined
    expect(
      (ElementClass as typeof HTMLElement & { observedAttributes?: string[] }).observedAttributes
    ).toBeDefined();
  });

  it('coerces prop types from attributes', () => {
    const tagName = `test-prop-coercion-${Date.now()}`;

    component(tagName, {
      props: {
        count: { type: Number, default: 0 },
        active: { type: Boolean, default: false },
        meta: { type: Object, default: {} },
      },
      render: ({ props }) =>
        html`<div>
          ${typeof props.count}:${props.count}|${props.active}|${(props.meta as { role?: string })
            .role ?? ''}
        </div>`,
    });

    const el = document.createElement(tagName);
    el.setAttribute('count', '3');
    el.setAttribute('active', 'true');
    el.setAttribute('meta', '{"role":"admin"}');
    document.body.appendChild(el);

    const rendered = el.shadowRoot?.innerHTML ?? '';

    expect(rendered).toContain('number:3|true|admin');

    el.remove();
  });

  it('renders into closed shadow roots', () => {
    const tagName = `test-closed-shadow-${Date.now()}`;
    let capturedShadowRoot: ShadowRoot | undefined;
    const originalAttachShadow = HTMLElement.prototype.attachShadow;

    HTMLElement.prototype.attachShadow = function (
      this: HTMLElement,
      init: ShadowRootInit
    ): ShadowRoot {
      const root = originalAttachShadow.call(this, init);
      if (this.tagName.toLowerCase() === tagName) {
        capturedShadowRoot = root;
      }
      return root;
    };

    try {
      component(tagName, {
        shadow: 'closed',
        props: {},
        render: () => html`<div>Closed Shadow Content</div>`,
      });

      const el = document.createElement(tagName);
      document.body.appendChild(el);

      expect(el.shadowRoot).toBeNull();
      expect(capturedShadowRoot).toBeDefined();
      if (!capturedShadowRoot) {
        throw new Error('Expected closed shadow root to be captured');
      }
      expect(capturedShadowRoot.textContent).toContain('Closed Shadow Content');

      el.remove();
    } finally {
      HTMLElement.prototype.attachShadow = originalAttachShadow;
    }
  });

  it('preserves typed state generics in component definitions', () => {
    type Props = { label: string };
    type State = { count: number; ready: boolean };

    const definition: ComponentDefinition<Props, State> = {
      props: {
        label: { type: String, required: true },
      },
      state: {
        count: 0,
        ready: false,
      },
      render({ props, state }) {
        expectType<string>(props.label);
        expectType<number>(state.count);
        expectType<boolean>(state.ready);
        // @ts-expect-error state.count should remain a number
        expectType<string>(state.count);

        return html`<div>${props.label}:${state.count}:${state.ready}</div>`;
      },
    };

    const tagName = `test-typed-state-${Date.now()}`;
    component<Props, State>(tagName, definition);

    const renderContext: ComponentRenderContext<Props, State> = {
      props: { label: 'Counter' },
      state: { count: 1, ready: true },
      signals: {},
      emit: () => {},
    };

    expectType<number>(renderContext.state.count);
    expectType<boolean>(renderContext.state.ready);
    // @ts-expect-error typed state should not widen to string fields
    expectType<string>(renderContext.state.ready);

    const el = document.createElement(tagName);
    el.setAttribute('label', 'Counter');
    document.body.appendChild(el);

    expect(el.shadowRoot?.textContent).toContain('Counter:0:false');

    el.remove();
  });

  it('requires initial state when an explicit state generic is used', () => {
    type Props = { label: string };
    type State = { count: number };

    // @ts-expect-error explicit state generics require an initial state object
    const invalidDefinition: ComponentDefinition<Props, State> = {
      props: {
        label: { type: String, required: true },
      },
      render: ({ props, state }) => html`<div>${props.label}:${state.count}</div>`,
    };

    expect(invalidDefinition).toBeDefined();
  });

  it('requires runtime signals when an explicit signal generic is used', () => {
    type Props = Record<string, never>;
    type ThemeSignals = { theme: ComponentSignalLike<'light' | 'dark'> };

    // @ts-expect-error explicit signal generics require a matching runtime signals object
    const invalidDefinition: ComponentDefinition<Props, undefined, ThemeSignals> = {
      props: {},
      render: ({ signals }) => html`<div>${signals.theme.value}</div>`,
    };

    expect(invalidDefinition).toBeDefined();
  });

  it('keeps inferred state untyped when TState is not explicit', () => {
    const tagName = `test-untyped-inferred-state-${Date.now()}`;

    const ElementClass = defineComponent(tagName, {
      props: {},
      state: {
        count: 0,
      },
      connected() {
        expectType<unknown>(this.getState('count'));
        expectType<number>(this.getState<number>('count'));
        this.setState('dynamic', true);
      },
      render({ state }) {
        expectType<unknown>(state.count);
        return html`<div>${String(state.count)}:${String(state.anotherKey)}</div>`;
      },
    });

    customElements.define(tagName, ElementClass);
    const instance = document.createElement(tagName) as InstanceType<typeof ElementClass>;
    expectType<unknown>(instance.getState('count'));
    expectType<number>(instance.getState<number>('count'));
    instance.setState('anotherKey', 1);

    expect(instance.getState('anotherKey')).toBe(1);
    expect(instance.shadowRoot?.textContent).toContain('0:1');
    instance.remove();
  });

  it('calls beforeMount before the first render', () => {
    const tagName = `test-before-mount-${Date.now()}`;
    const callOrder: string[] = [];

    component(tagName, {
      props: {},
      beforeMount() {
        callOrder.push('beforeMount');
      },
      connected() {
        callOrder.push('connected');
      },
      render: () => {
        callOrder.push('render');
        return html`<div>Test</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(callOrder).toEqual(['beforeMount', 'connected', 'render']);

    el.remove();
  });

  it('supports arrow-function lifecycle hooks that do not use this', () => {
    const tagName = `test-arrow-hooks-${Date.now()}`;
    const calls: string[] = [];

    component(tagName, {
      props: {},
      beforeMount: () => {
        calls.push('beforeMount');
      },
      connected: () => {
        calls.push('connected');
      },
      updated: () => {
        calls.push('updated');
      },
      render: () => html`<div>Arrow hooks</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);
    el.setAttribute('data-test', '1');

    expect(calls).toContain('beforeMount');
    expect(calls).toContain('connected');

    el.remove();
  });

  it('calls beforeUpdate before re-renders and receives new and previous props', () => {
    const tagName = `test-before-update-${Date.now()}`;
    const receivedProps: Array<{ newProps: { count: number }; oldProps: { count: number } }> = [];
    let renderCount = 0;

    component<{ count: number }>(tagName, {
      props: {
        count: { type: Number, default: 0 },
      },
      beforeUpdate(newProps, oldProps) {
        receivedProps.push({ newProps: { ...newProps }, oldProps: { ...oldProps } });
        return true; // allow update
      },
      render: ({ props }) => {
        renderCount++;
        return html`<div>Count: ${props.count}</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(renderCount).toBe(1);
    expect(receivedProps).toHaveLength(0); // beforeUpdate not called on initial render

    // Trigger an attribute change after mounting
    el.setAttribute('count', '10');

    expect(renderCount).toBe(2);
    expect(receivedProps).toHaveLength(1);
    expect(receivedProps[0]).toEqual({
      newProps: { count: 10 },
      oldProps: { count: 0 },
    });

    el.remove();
  });

  it('beforeUpdate returning false prevents re-render', () => {
    const tagName = `test-before-update-prevent-${Date.now()}`;
    let renderCount = 0;

    component<{ count: number }>(tagName, {
      props: {
        count: { type: Number, default: 0 },
      },
      beforeUpdate(props) {
        // Prevent update if count is negative
        if (props.count < 0) return false;
      },
      render: ({ props }) => {
        renderCount++;
        return html`<div>Count: ${props.count}</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(renderCount).toBe(1);

    // Valid update - should render
    el.setAttribute('count', '10');
    expect(renderCount).toBe(2);

    // Negative count - should be prevented
    el.setAttribute('count', '-5');
    expect(renderCount).toBe(2); // No additional render

    el.remove();
  });

  it('calls updated after re-renders', () => {
    const tagName = `test-updated-${Date.now()}`;
    const callOrder: string[] = [];
    const receivedChanges: Array<{
      name: string;
      oldValue: string | null;
      newValue: string | null;
    }> = [];

    component<{ count: number }>(tagName, {
      props: {
        count: { type: Number, default: 0 },
      },
      beforeUpdate() {
        callOrder.push('beforeUpdate');
        return true;
      },
      updated(change) {
        callOrder.push('updated');
        if (change) receivedChanges.push(change);
      },
      render: () => {
        callOrder.push('render');
        return html`<div>Test</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    callOrder.length = 0; // Clear initial render calls

    el.setAttribute('count', '10');

    expect(callOrder).toEqual(['beforeUpdate', 'render', 'updated']);
    expect(receivedChanges).toEqual([{ name: 'count', oldValue: null, newValue: '10' }]);

    el.remove();
  });

  it('passes undefined to updated for non-attribute updates', () => {
    const tagName = `test-updated-state-${Date.now()}`;
    const receivedChanges: unknown[] = [];

    component(tagName, {
      props: {},
      updated(change) {
        receivedChanges.push(change);
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName) as HTMLElement & {
      setState: (key: string, value: unknown) => void;
    };
    document.body.appendChild(el);

    el.setState('count', 1);

    expect(receivedChanges).toEqual([undefined]);

    el.remove();
  });

  it('does not let beforeUpdate block state-driven renders when props are unchanged', () => {
    const tagName = `test-state-before-update-${Date.now()}`;
    let renderCount = 0;
    let beforeUpdateCount = 0;

    component<{ label: string }, { count: number }>(tagName, {
      props: {
        label: { type: String, default: 'count' },
      },
      state: {
        count: 0,
      },
      beforeUpdate(newProps, oldProps) {
        beforeUpdateCount++;
        return newProps.label !== oldProps.label;
      },
      render: ({ props, state }) => {
        renderCount++;
        return html`<div>${props.label}:${state.count}</div>`;
      },
    });

    const el = document.createElement(tagName) as HTMLElement & {
      setState: (key: string, value: unknown) => void;
    };
    document.body.appendChild(el);

    expect(renderCount).toBe(1);
    expect(beforeUpdateCount).toBe(0);
    expect(el.shadowRoot?.textContent).toContain('count:0');

    el.setState('count', 1);

    expect(renderCount).toBe(2);
    expect(beforeUpdateCount).toBe(0);
    expect(el.shadowRoot?.textContent).toContain('count:1');

    el.setAttribute('label', 'updated');

    expect(beforeUpdateCount).toBe(1);
    expect(renderCount).toBe(3);
    expect(el.shadowRoot?.textContent).toContain('updated:1');

    el.remove();
  });

  it('re-renders when declared signals change', () => {
    const tagName = `test-signal-rerender-${Date.now()}`;
    const theme = signal<'light' | 'dark'>('light');
    let renderCount = 0;

    component(tagName, {
      props: {},
      signals: { theme },
      render: ({ signals }) => {
        renderCount++;
        return html`<div class="${signals.theme.value}">${signals.theme.value}</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(renderCount).toBe(1);
    expect(el.shadowRoot?.querySelector('div')?.className).toBe('light');

    theme.value = 'dark';

    expect(renderCount).toBe(2);
    expect(el.shadowRoot?.querySelector('div')?.className).toBe('dark');

    el.remove();
  });

  it('does not let beforeUpdate block signal-driven renders when props are unchanged', () => {
    const tagName = `test-signal-before-update-${Date.now()}`;
    const theme = signal<'light' | 'dark'>('light');
    let renderCount = 0;
    let beforeUpdateCount = 0;

    component<{ label: string }, { theme: ComponentSignalLike<'light' | 'dark'> }>(tagName, {
      props: {
        label: { type: String, default: 'theme' },
      },
      signals: { theme },
      beforeUpdate(newProps, oldProps) {
        beforeUpdateCount++;
        return newProps.label !== oldProps.label;
      },
      render: ({ props, signals }) => {
        renderCount++;
        return html`<div>${props.label}:${signals.theme.value}</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(renderCount).toBe(1);
    expect(beforeUpdateCount).toBe(0);
    expect(el.shadowRoot?.textContent).toContain('theme:light');

    theme.value = 'dark';

    expect(renderCount).toBe(2);
    expect(beforeUpdateCount).toBe(0);
    expect(el.shadowRoot?.textContent).toContain('theme:dark');

    el.setAttribute('label', 'updated');

    expect(beforeUpdateCount).toBe(1);
    expect(renderCount).toBe(3);
    expect(el.shadowRoot?.textContent).toContain('updated:dark');

    el.remove();
  });

  it('supports computed values as component signals', () => {
    const tagName = `test-computed-signal-${Date.now()}`;
    const theme = signal<'light' | 'dark'>('light');
    const themeClass = computed(() => `theme-${theme.value}`);

    component(tagName, {
      props: {},
      signals: { themeClass },
      render: ({ signals }) => html`<div class="${signals.themeClass.value}">Theme</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.shadowRoot?.querySelector('div')?.className).toBe('theme-light');

    theme.value = 'dark';

    expect(el.shadowRoot?.querySelector('div')?.className).toBe('theme-dark');

    el.remove();
  });

  it('only subscribes to signals declared in the component definition', () => {
    const tagName = `test-explicit-signals-${Date.now()}`;
    const declared = signal('declared-1');
    const undeclared = signal('undeclared-1');
    let renderCount = 0;

    component(tagName, {
      props: {},
      signals: { declared },
      render: ({ signals }) => {
        renderCount++;
        return html`<div>${signals.declared.value}:${undeclared.value}</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(renderCount).toBe(1);

    undeclared.value = 'undeclared-2';
    expect(renderCount).toBe(1);

    declared.value = 'declared-2';
    expect(renderCount).toBe(2);
    expect(el.shadowRoot?.textContent).toContain('declared-2:undeclared-2');

    const renderCountBeforeRemove = renderCount;
    el.remove();

    declared.value = 'declared-3';
    expect(renderCount).toBe(renderCountBeforeRemove);

    document.body.appendChild(el);
    expect(renderCount).toBe(renderCountBeforeRemove + 1);
    expect(el.shadowRoot?.textContent).toContain('declared-3:undeclared-2');

    el.remove();
  });

  it('skips signal effect setup when the signals map is empty', () => {
    const tagName = `test-empty-signals-${Date.now()}`;
    let renderCount = 0;

    component(tagName, {
      props: {},
      signals: {},
      render: () => {
        renderCount++;
        return html`<div>Static</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(renderCount).toBe(1);
    expect(el.shadowRoot?.textContent).toContain('Static');

    el.remove();
    document.body.appendChild(el);

    expect(renderCount).toBe(1);
    expect(el.shadowRoot?.textContent).toContain('Static');

    el.remove();
  });

  it('restores signal subscriptions after reconnecting with missing required props', () => {
    const tagName = `test-signal-reconnect-required-${Date.now()}`;
    const theme = signal<'light' | 'dark'>('light');
    let renderCount = 0;

    component(tagName, {
      props: {
        label: { type: String, required: true },
      },
      signals: { theme },
      render: ({ props, signals }) => {
        renderCount++;
        return html`<div>${String(props.label)}:${signals.theme.value}</div>`;
      },
    });

    const el = document.createElement(tagName);
    el.setAttribute('label', 'ready');
    document.body.appendChild(el);

    expect(renderCount).toBe(1);

    el.removeAttribute('label');
    expect(renderCount).toBe(2);

    el.remove();
    theme.value = 'dark';

    document.body.appendChild(el);
    const renderCountAfterReconnect = renderCount;

    el.setAttribute('label', 'restored');
    expect(renderCount).toBe(renderCountAfterReconnect + 1);

    theme.value = 'light';

    expect(renderCount).toBe(renderCountAfterReconnect + 2);
    expect(el.shadowRoot?.textContent).toContain('restored:light');

    el.remove();
  });

  it('calls connected again when a mounted component reconnects', () => {
    const tagName = `test-connected-reconnect-${Date.now()}`;
    const calls: string[] = [];

    component(tagName, {
      props: {},
      connected() {
        calls.push('connected');
      },
      disconnected() {
        calls.push('disconnected');
      },
      render: () => html`<div>Reconnect</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);
    el.remove();
    document.body.appendChild(el);

    expect(calls).toEqual(['connected', 'disconnected', 'connected']);

    el.remove();
  });

  it('restores signal subscriptions on reconnect even if connected throws', () => {
    const tagName = `test-connected-throw-reconnect-${Date.now()}`;
    const theme = signal<'light' | 'dark'>('light');
    const capturedErrors: Error[] = [];
    let connectedCount = 0;
    let renderCount = 0;

    component(tagName, {
      props: {},
      signals: { theme },
      connected() {
        connectedCount++;
        if (connectedCount > 1) {
          throw new Error('Reconnect error');
        }
      },
      onError(error) {
        capturedErrors.push(error);
      },
      render: ({ signals }) => {
        renderCount++;
        return html`<div>${signals.theme.value}</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(renderCount).toBe(1);
    expect(capturedErrors).toHaveLength(0);

    el.remove();
    document.body.appendChild(el);

    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0].message).toBe('Reconnect error');
    expect(renderCount).toBe(2);
    expect(el.shadowRoot?.textContent).toContain('light');

    theme.value = 'dark';

    expect(renderCount).toBe(3);
    expect(el.shadowRoot?.textContent).toContain('dark');

    el.remove();
  });

  it('routes signal subscription errors through onError', () => {
    const tagName = `test-signal-on-error-${Date.now()}`;
    const value = signal(1);
    const shouldThrow = signal(false);
    const capturedErrors: Error[] = [];
    const derived = computed(() => {
      if (shouldThrow.value) {
        throw new Error('Signal subscription error');
      }
      return value.value;
    });

    component(tagName, {
      props: {},
      signals: { derived },
      onError(error) {
        capturedErrors.push(error);
      },
      render: () => html`<div>Signal test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(capturedErrors).toHaveLength(0);

    shouldThrow.value = true;

    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0].message).toBe('Signal subscription error');

    el.remove();
  });

  it('calls onError when lifecycle methods throw', () => {
    const tagName = `test-on-error-lifecycle-${Date.now()}`;
    const capturedErrors: Error[] = [];

    component(tagName, {
      props: {},
      connected() {
        throw new Error('Connected error');
      },
      onError(error) {
        capturedErrors.push(error);
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0].message).toBe('Connected error');

    el.remove();
  });

  it('does not render when beforeMount throws during initial mount', () => {
    const tagName = `test-on-error-before-mount-${Date.now()}`;
    const capturedErrors: Error[] = [];
    const calls: string[] = [];

    component(tagName, {
      props: {},
      beforeMount() {
        calls.push('beforeMount');
        throw new Error('BeforeMount error');
      },
      connected() {
        calls.push('connected');
      },
      onError(error) {
        capturedErrors.push(error);
      },
      render: () => {
        calls.push('render');
        return html`<div>Test</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(calls).toEqual(['beforeMount']);
    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0].message).toBe('BeforeMount error');
    expect(el.shadowRoot?.textContent ?? '').not.toContain('Test');

    el.remove();
  });

  it('disposes failed mount scopes before a later retry', () => {
    const tagName = `test-before-mount-scope-cleanup-${Date.now()}`;
    const source = signal('initial');
    const seenValues: string[] = [];
    let shouldThrow = true;

    component(tagName, {
      props: {},
      beforeMount() {
        useEffect(() => {
          seenValues.push(source.value);
        });

        if (shouldThrow) {
          shouldThrow = false;
          throw new Error('BeforeMount retry error');
        }
      },
      onError() {},
      render: () => html`<div>Recovered</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.shadowRoot?.textContent ?? '').not.toContain('Recovered');
    expect(seenValues).toEqual(['initial']);

    source.value = 'after-failure';
    expect(seenValues).toEqual(['initial']);

    el.remove();
    document.body.appendChild(el);

    expect(el.shadowRoot?.textContent).toContain('Recovered');
    expect(seenValues).toEqual(['initial', 'after-failure']);

    source.value = 'after-retry';
    expect(seenValues).toEqual(['initial', 'after-failure', 'after-retry']);

    el.remove();
  });

  it('calls onError when render throws', () => {
    const tagName = `test-on-error-render-${Date.now()}`;
    const capturedErrors: Error[] = [];

    component(tagName, {
      props: {},
      onError(error) {
        capturedErrors.push(error);
      },
      render: () => {
        throw new Error('Render error');
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0].message).toBe('Render error');

    el.remove();
  });

  it('calls onError when beforeUpdate throws', () => {
    const tagName = `test-on-error-before-update-${Date.now()}`;
    const capturedErrors: Error[] = [];

    component<{ count: number }>(tagName, {
      props: {
        count: { type: Number, default: 0 },
      },
      beforeUpdate() {
        throw new Error('BeforeUpdate error');
      },
      onError(error) {
        capturedErrors.push(error);
      },
      render: ({ props }) => html`<div>Count: ${props.count}</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    // Initial render should work (beforeUpdate not called)
    expect(capturedErrors).toHaveLength(0);

    // Trigger an update to invoke beforeUpdate
    el.setAttribute('count', '10');

    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0].message).toBe('BeforeUpdate error');

    el.remove();
  });

  it('validates prop values using validator function', () => {
    const tagName = `test-prop-validator-${Date.now()}`;
    const capturedErrors: Error[] = [];

    component<{ count: number }>(tagName, {
      props: {
        count: {
          type: Number,
          default: 0,
          validator: (value) => typeof value === 'number' && value >= 0 && value <= 100,
        },
      },
      onError(error) {
        capturedErrors.push(error);
      },
      render: ({ props }) => html`<div>Count: ${props.count}</div>`,
    });

    const el = document.createElement(tagName);
    el.setAttribute('count', '50'); // Valid value
    document.body.appendChild(el);

    expect(capturedErrors).toHaveLength(0);

    // Invalid value - should trigger validation error
    el.setAttribute('count', '150');

    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0].message).toContain('validation failed');
    expect(capturedErrors[0].message).toContain('count');

    el.remove();
  });

  it('calls validator after prop coercion with correct type', () => {
    const tagName = `test-validator-after-coercion-${Date.now()}`;
    const receivedValues: unknown[] = [];
    const receivedTypes: string[] = [];

    component<{ count: number }>(tagName, {
      props: {
        count: {
          type: Number,
          default: 0,
          validator: (value) => {
            receivedValues.push(value);
            receivedTypes.push(typeof value);
            return true;
          },
        },
      },
      render: ({ props }) => html`<div>Count: ${props.count}</div>`,
    });

    const el = document.createElement(tagName);
    el.setAttribute('count', '42'); // String "42" should be coerced to number 42
    document.body.appendChild(el);

    // Validator should receive the coerced number, not the raw string
    expect(receivedValues).toContain(42);
    expect(receivedTypes).toContain('number');
    expect(receivedValues).not.toContain('42');
    expect(receivedTypes).not.toContain('string');

    el.remove();
  });

  it('validator receives coerced boolean values', () => {
    const tagName = `test-validator-boolean-coercion-${Date.now()}`;
    const receivedValues: unknown[] = [];

    component<{ active: boolean }>(tagName, {
      props: {
        active: {
          type: Boolean,
          default: false,
          validator: (value) => {
            receivedValues.push(value);
            return typeof value === 'boolean';
          },
        },
      },
      render: ({ props }) => html`<div>Active: ${props.active}</div>`,
    });

    const el = document.createElement(tagName);
    el.setAttribute('active', 'true'); // String "true" should be coerced to boolean true
    document.body.appendChild(el);

    // Validator should receive boolean true, not string "true"
    expect(receivedValues).toContain(true);
    expect(receivedValues).not.toContain('true');

    el.remove();
  });

  it('validation failure throws error with prop name and value in message', () => {
    const tagName = `test-validator-error-message-${Date.now()}`;
    const capturedErrors: Error[] = [];

    component<{ age: number }>(tagName, {
      props: {
        age: {
          type: Number,
          default: 18, // Valid default to allow initial mount
          validator: (value) => typeof value === 'number' && value >= 18,
        },
      },
      onError(error) {
        capturedErrors.push(error);
      },
      render: ({ props }) => html`<div>Age: ${props.age}</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    // Now trigger validation failure with an update
    el.setAttribute('age', '10'); // Invalid: under 18

    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0].message).toContain('validation failed');
    expect(capturedErrors[0].message).toContain('age');
    expect(capturedErrors[0].message).toContain('10');

    el.remove();
  });

  it('validator is called on attribute updates', () => {
    const tagName = `test-validator-on-update-${Date.now()}`;
    let validatorCallCount = 0;
    const capturedErrors: Error[] = [];

    component<{ count: number }>(tagName, {
      props: {
        count: {
          type: Number,
          default: 0,
          validator: (value) => {
            validatorCallCount++;
            return typeof value === 'number' && value <= 50;
          },
        },
      },
      onError(error) {
        capturedErrors.push(error);
      },
      render: ({ props }) => html`<div>Count: ${props.count}</div>`,
    });

    const el = document.createElement(tagName);
    el.setAttribute('count', '10'); // Valid
    document.body.appendChild(el);

    const initialCallCount = validatorCallCount;
    expect(capturedErrors).toHaveLength(0);

    // Update with valid value
    el.setAttribute('count', '20');
    expect(validatorCallCount).toBeGreaterThan(initialCallCount);
    expect(capturedErrors).toHaveLength(0);

    // Update with invalid value
    el.setAttribute('count', '100');
    expect(capturedErrors).toHaveLength(1);

    el.remove();
  });

  it('validator is not called for undefined default values', () => {
    const tagName = `test-validator-undefined-${Date.now()}`;
    let validatorCalled = false;

    component<{ optional: string }>(tagName, {
      props: {
        optional: {
          type: String,
          required: false,
          // No default, value will be undefined
          validator: () => {
            validatorCalled = true;
            return true;
          },
        },
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    // Validator should not be called when value is undefined
    expect(validatorCalled).toBe(false);

    el.remove();
  });

  it('validator is called for default values when provided', () => {
    const tagName = `test-validator-default-${Date.now()}`;
    const receivedValues: unknown[] = [];

    component<{ count: number }>(tagName, {
      props: {
        count: {
          type: Number,
          default: 5,
          validator: (value) => {
            receivedValues.push(value);
            return true;
          },
        },
      },
      render: ({ props }) => html`<div>Count: ${props.count}</div>`,
    });

    const el = document.createElement(tagName);
    // No attribute set, should use default value
    document.body.appendChild(el);

    // Validator should be called with the default value
    expect(receivedValues).toContain(5);

    el.remove();
  });

  it('validation errors are caught by onError handler', () => {
    const tagName = `test-validator-onerror-${Date.now()}`;
    const capturedErrors: Error[] = [];

    component<{ email: string }>(tagName, {
      props: {
        email: {
          type: String,
          default: 'default@example.com', // Valid default to allow initial mount
          validator: (value) => typeof value === 'string' && value.includes('@'),
        },
      },
      onError(error) {
        capturedErrors.push(error);
      },
      render: ({ props }) => html`<div>Email: ${props.email}</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    // Initial mount should succeed with valid default
    expect(capturedErrors).toHaveLength(0);

    // Now trigger validation failure with an invalid update
    el.setAttribute('email', 'invalid-email'); // No @ sign

    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0]).toBeInstanceOf(Error);
    expect(capturedErrors[0].message).toContain('validation failed');
    expect(capturedErrors[0].message).toContain('email');

    el.remove();
  });

  it('validator with Object prop receives parsed JSON', () => {
    const tagName = `test-validator-object-${Date.now()}`;
    const receivedValues: unknown[] = [];

    component<{ config: { enabled: boolean } }>(tagName, {
      props: {
        config: {
          type: Object,
          default: { enabled: false },
          validator: (value) => {
            receivedValues.push(value);
            return typeof value === 'object' && value !== null;
          },
        },
      },
      render: () => html`<div>Config</div>`,
    });

    const el = document.createElement(tagName);
    el.setAttribute('config', '{"enabled":true}');
    document.body.appendChild(el);

    // Validator is called for both initial default and attribute value
    // We check that at least one call received the parsed object
    const parsedObjectCalls = receivedValues.filter(
      (v) => typeof v === 'object' && v !== null && (v as { enabled: boolean }).enabled === true
    );
    expect(parsedObjectCalls.length).toBeGreaterThanOrEqual(1);
    // Ensure no raw JSON strings were passed
    expect(receivedValues).not.toContain('{"enabled":true}');

    el.remove();
  });
});

describe('component/defineComponent', () => {
  it('returns an HTMLElement subclass', () => {
    const tagName = `test-define-class-${Date.now()}`;
    const ElementClass = defineComponent(tagName, {
      props: {},
      render: () => html`<div>Test</div>`,
    });

    expect(ElementClass).toBeDefined();
    expect(typeof ElementClass).toBe('function');
    expect(ElementClass.prototype instanceof HTMLElement).toBe(true);
  });

  it('returned class can be registered with custom tag name', () => {
    const originalTagName = `test-define-original-${Date.now()}`;
    const customTagName = `test-define-custom-${Date.now()}`;

    const ElementClass = defineComponent(originalTagName, {
      props: {},
      render: () => html`<div>Test</div>`,
    });

    // Register with a different tag name
    customElements.define(customTagName, ElementClass);

    expect(customElements.get(customTagName)).toBe(ElementClass);

    const el = document.createElement(customTagName);
    document.body.appendChild(el);

    expect(el.shadowRoot).toBeDefined();
    expect(el.shadowRoot?.innerHTML).toContain('Test');

    el.remove();
  });

  it('returned class has correct observedAttributes', () => {
    const tagName = `test-define-observed-${Date.now()}`;
    const ElementClass = defineComponent(tagName, {
      props: {
        name: { type: String, required: true },
        count: { type: Number, default: 0 },
        active: { type: Boolean, default: false },
      },
      render: () => html`<div>Test</div>`,
    });

    const observedAttrs = (ElementClass as typeof HTMLElement & { observedAttributes: string[] })
      .observedAttributes;
    expect(observedAttrs).toBeDefined();
    expect(observedAttrs).toContain('name');
    expect(observedAttrs).toContain('count');
    expect(observedAttrs).toContain('active');
  });

  it('instances have shadow DOM', () => {
    const tagName = `test-define-shadow-${Date.now()}`;
    const ElementClass = defineComponent(tagName, {
      props: {},
      render: () => html`<div>Shadow Content</div>`,
    });

    customElements.define(tagName, ElementClass);
    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.shadowRoot).toBeDefined();
    expect(el.shadowRoot?.mode).toBe('open');
    expect(el.shadowRoot?.innerHTML).toContain('Shadow Content');

    el.remove();
  });

  it('returns instances with typed state helpers', () => {
    type Props = Record<string, never>;
    type State = { count: number; ready: boolean };

    const tagName = `test-define-state-helpers-${Date.now()}`;
    const ElementClass = defineComponent<Props, State>(tagName, {
      props: {},
      state: {
        count: 0,
        ready: false,
      },
      connected() {
        expectType<number>(this.getState('count'));
        expectType<boolean>(this.getState('ready'));
        this.setState('count', this.getState('count') + 1);
      },
      render: ({ state }) => html`<div>${state.count}:${state.ready}</div>`,
    });

    customElements.define(tagName, ElementClass);
    const instance = document.createElement(tagName) as InstanceType<typeof ElementClass>;
    const assertInvalidConnectedSetState = (element: InstanceType<typeof ElementClass>): void => {
      // @ts-expect-error count expects a number
      element.setState('count', '1');
    };

    expectType<number>(instance.getState('count'));
    expectType<boolean>(instance.getState('ready'));
    instance.setState('count', 2);
    const assertInvalidInstanceSetState = (element: InstanceType<typeof ElementClass>): void => {
      // @ts-expect-error ready expects a boolean
      element.setState('ready', 'true');
    };
    const assertNumericStateKeyIsRejected = (element: InstanceType<typeof ElementClass>): void => {
      // @ts-expect-error state keys must be strings
      element.getState(0);
    };
    void assertInvalidConnectedSetState;
    void assertInvalidInstanceSetState;
    void assertNumericStateKeyIsRejected;

    expect(instance.shadowRoot?.textContent).toContain('2:false');
    instance.remove();
  });

  it('attributeChangedCallback triggers re-render', () => {
    const tagName = `test-define-attr-change-${Date.now()}`;
    let renderCount = 0;

    const ElementClass = defineComponent<{ count: number }>(tagName, {
      props: {
        count: { type: Number, default: 0 },
      },
      render: ({ props }) => {
        renderCount++;
        return html`<div>Count: ${props.count}</div>`;
      },
    });

    customElements.define(tagName, ElementClass);
    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(renderCount).toBe(1);
    expect(el.shadowRoot?.innerHTML).toContain('Count: 0');

    // Trigger attribute change
    el.setAttribute('count', '42');

    expect(renderCount).toBe(2);
    expect(el.shadowRoot?.innerHTML).toContain('Count: 42');

    el.remove();
  });

  it('does not render when attributes are set before connectedCallback', () => {
    const tagName = `test-define-pre-mount-${Date.now()}`;
    let renderCount = 0;

    const ElementClass = defineComponent<{ value: string }>(tagName, {
      props: {
        value: { type: String, default: 'default' },
      },
      render: ({ props }) => {
        renderCount++;
        return html`<div>Value: ${props.value}</div>`;
      },
    });

    customElements.define(tagName, ElementClass);

    // Create element and set attributes BEFORE connecting to DOM
    const el = document.createElement(tagName);
    el.setAttribute('value', 'initial');
    el.setAttribute('value', 'changed');
    el.setAttribute('value', 'final');

    // Should not have rendered yet (attributeChangedCallback called but hasMounted is false)
    expect(renderCount).toBe(0);

    // Connect to DOM - this triggers connectedCallback and first render
    document.body.appendChild(el);

    // Should render exactly once with the final attribute value
    expect(renderCount).toBe(1);
    expect(el.shadowRoot?.innerHTML).toContain('Value: final');

    el.remove();
  });

  it('attributeChangedCallback triggers re-render after mount', () => {
    const tagName = `test-define-post-mount-rerender-${Date.now()}`;
    let renderCount = 0;

    const ElementClass = defineComponent<{ value: string }>(tagName, {
      props: {
        value: { type: String, default: 'initial' },
      },
      render: ({ props }) => {
        renderCount++;
        return html`<div>Value: ${props.value}</div>`;
      },
    });

    customElements.define(tagName, ElementClass);
    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(renderCount).toBe(1);
    expect(el.shadowRoot?.innerHTML).toContain('Value: initial');

    // Now that component is mounted, attribute changes should trigger re-renders
    el.setAttribute('value', 'updated1');
    expect(renderCount).toBe(2);
    expect(el.shadowRoot?.innerHTML).toContain('Value: updated1');

    el.setAttribute('value', 'updated2');
    expect(renderCount).toBe(3);
    expect(el.shadowRoot?.innerHTML).toContain('Value: updated2');

    el.remove();
  });

  it('instances sanitize rendered markup for security', () => {
    const tagName = `test-define-sanitize-${Date.now()}`;
    const ElementClass = defineComponent(tagName, {
      props: {},
      render: () =>
        html`<div>
          <script>
            alert('xss');
          </script>
          Safe text
        </div>`,
    });

    customElements.define(tagName, ElementClass);
    const el = document.createElement(tagName);
    document.body.appendChild(el);

    const shadowHTML = el.shadowRoot?.innerHTML ?? '';
    // Script tags should be stripped by sanitizeHtml
    expect(shadowHTML).not.toContain('<script>');
    expect(shadowHTML).not.toContain('alert');
    expect(shadowHTML).toContain('Safe text');

    el.remove();
  });

  it('merges per-component sanitizer options with the base allowlist', () => {
    const tagName = `test-define-sanitize-options-${Date.now()}`;
    const ElementClass = defineComponent(tagName, {
      props: {},
      sanitize: {
        allowAttributes: ['open', 'style'],
      },
      render: () =>
        html`<div role="dialog" open style="--offset: 12px" onclick="alert('xss')">Visible</div>`,
    });

    customElements.define(tagName, ElementClass);
    const el = document.createElement(tagName);
    document.body.appendChild(el);

    const dialog = el.shadowRoot?.querySelector('div');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(dialog?.getAttribute('style')).toBe('--offset: 12px');
    expect(dialog?.hasAttribute('onclick')).toBe(false);
    expect(el.shadowRoot?.innerHTML).not.toContain('onclick');
    expect(el.shadowRoot?.innerHTML).not.toContain('alert');
    expect(el.shadowRoot?.innerHTML).toContain('Visible');

    el.remove();
  });

  it('extends the component sanitizer tag allowlist when explicitly requested', () => {
    const restrictedComponentTagName = `test-define-sanitize-tag-default-${Date.now()}`;
    const permissiveComponentTagName = `test-define-sanitize-tag-allowed-${Date.now()}`;

    const DefaultElementClass = defineComponent(restrictedComponentTagName, {
      props: {},
      render: () => html`<dialog>Default hidden dialog</dialog>`,
    });
    const AllowedElementClass = defineComponent(permissiveComponentTagName, {
      props: {},
      sanitize: {
        allowTags: ['dialog'],
      },
      render: () => html`<dialog>Allowed visible dialog</dialog>`,
    });

    customElements.define(restrictedComponentTagName, DefaultElementClass);
    customElements.define(permissiveComponentTagName, AllowedElementClass);

    const defaultEl = document.createElement(restrictedComponentTagName);
    const allowedEl = document.createElement(permissiveComponentTagName);

    document.body.appendChild(defaultEl);
    document.body.appendChild(allowedEl);

    expect(defaultEl.shadowRoot?.querySelector('dialog')).toBeNull();
    expect(defaultEl.shadowRoot?.innerHTML).not.toContain('<dialog');

    const allowedDialog = allowedEl.shadowRoot?.querySelector('dialog');
    expect(allowedDialog).not.toBeNull();
    expect(allowedDialog?.textContent).toBe('Allowed visible dialog');

    defaultEl.remove();
    allowedEl.remove();
  });

  it('instances apply styles correctly', () => {
    const tagName = `test-define-styles-${Date.now()}`;
    const ElementClass = defineComponent(tagName, {
      props: {},
      styles: '.test { color: red; }',
      render: () => html`<div class="test">Styled</div>`,
    });

    customElements.define(tagName, ElementClass);
    const el = document.createElement(tagName);
    document.body.appendChild(el);

    const styleTag = el.shadowRoot?.querySelector('style');
    expect(styleTag).toBeDefined();
    expect(styleTag?.textContent).toContain('color: red');

    el.remove();
  });

  it('reuses the same style element across attribute-triggered re-renders', () => {
    const tagName = `test-define-style-reuse-${Date.now()}`;
    const ElementClass = defineComponent<{ value: string }>(tagName, {
      props: {
        value: { type: String, default: 'initial' },
      },
      styles: '.test { color: red; }',
      render: ({ props }) => html`<div class="test">${props.value}</div>`,
    });

    customElements.define(tagName, ElementClass);
    const el = document.createElement(tagName);
    document.body.appendChild(el);

    const initialStyleTag = el.shadowRoot?.querySelector(
      'style[data-bquery-component-style]'
    ) as HTMLStyleElement | null;
    expect(initialStyleTag).not.toBeNull();
    expect(initialStyleTag?.tagName).toBe('STYLE');

    el.setAttribute('value', 'updated');

    const updatedStyleTag = el.shadowRoot?.querySelector(
      'style[data-bquery-component-style]'
    ) as HTMLStyleElement | null;
    expect(updatedStyleTag).toBe(initialStyleTag);
    expect(el.shadowRoot?.querySelectorAll('style')).toHaveLength(1);
    expect(el.shadowRoot?.textContent).toContain('updated');

    el.remove();
  });

  it('can be used to test component in isolation', () => {
    // This pattern is useful for testing without polluting global registry
    const ElementClass = defineComponent('test-isolated', {
      props: {
        value: { type: String, default: 'default' },
      },
      render: ({ props }) => html`<span>${props.value}</span>`,
    });

    // Use a unique tag for testing
    const testTag = `test-isolated-${Date.now()}`;
    customElements.define(testTag, ElementClass);

    const el = document.createElement(testTag);
    el.setAttribute('value', 'custom');
    document.body.appendChild(el);

    expect(el.shadowRoot?.innerHTML).toContain('custom');

    el.remove();
  });
});

describe('component/registerDefaultComponents', () => {
  it('registers the default foundational component library', () => {
    const prefix = `ui${Date.now()}`;
    const tags = registerDefaultComponents({ prefix });

    expect(customElements.get(tags.button)).toBeDefined();
    expect(customElements.get(tags.card)).toBeDefined();
    expect(customElements.get(tags.input)).toBeDefined();
    expect(customElements.get(tags.textarea)).toBeDefined();
    expect(customElements.get(tags.checkbox)).toBeDefined();
  });

  it('allows re-registering the same default component tags for repeat dev bootstraps', () => {
    const prefix = `dev${Date.now()}`;

    expect(() => registerDefaultComponents({ prefix })).not.toThrow();
    expect(() => registerDefaultComponents({ prefix })).not.toThrow();
  });

  it('updates button text when the label attribute changes', () => {
    const prefix = `story${Date.now()}`;
    const tags = registerDefaultComponents({ prefix });

    const button = document.createElement(tags.button);
    button.setAttribute('label', 'Continue');
    document.body.appendChild(button);

    expect(button.shadowRoot?.textContent).toContain('Continue');

    button.setAttribute('label', 'Updated label');
    expect(button.shadowRoot?.textContent).toContain('Updated label');

    button.remove();
  });

  it('renders string props as text instead of injected markup', () => {
    const prefix = `safe${Date.now()}`;
    const tags = registerDefaultComponents({ prefix });

    const button = document.createElement(tags.button);
    button.setAttribute('label', '<img src=x onerror=alert(1)>');
    document.body.appendChild(button);

    const card = document.createElement(tags.card);
    card.setAttribute('title', '<a href="https://example.com">Title</a>');
    card.setAttribute('footer', '<img src="https://example.com/x.png">');
    document.body.appendChild(card);

    const input = document.createElement(tags.input);
    input.setAttribute('label', '<strong>Name</strong>');
    input.setAttribute('placeholder', '"quoted"');
    input.setAttribute('value', '<value>');
    document.body.appendChild(input);

    const textarea = document.createElement(tags.textarea);
    textarea.setAttribute('label', '<em>Notes</em>');
    textarea.setAttribute('value', '<script>alert(1)</script>');
    document.body.appendChild(textarea);

    const checkbox = document.createElement(tags.checkbox);
    checkbox.setAttribute('label', '<svg>Active</svg>');
    document.body.appendChild(checkbox);

    expect(button.shadowRoot?.querySelector('img')).toBeNull();
    expect(button.shadowRoot?.textContent).toContain('<img src=x onerror=alert(1)>');

    expect(card.shadowRoot?.querySelector('a')).toBeNull();
    expect(card.shadowRoot?.querySelector('img')).toBeNull();
    expect(card.shadowRoot?.textContent).toContain('<a href="https://example.com">Title</a>');
    expect(card.shadowRoot?.textContent).toContain('<img src="https://example.com/x.png">');

    expect(input.shadowRoot?.querySelector('strong')).toBeNull();
    expect(input.shadowRoot?.querySelector('.label')?.textContent).toBe('<strong>Name</strong>');
    expect(input.shadowRoot?.querySelector('img')).toBeNull();

    expect(textarea.shadowRoot?.querySelector('em')).toBeNull();
    expect(textarea.shadowRoot?.querySelector('.label')?.textContent).toBe('<em>Notes</em>');
    expect(
      (textarea.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null)?.value
    ).toBe('<script>alert(1)</script>');

    expect(checkbox.shadowRoot?.querySelector('svg')).toBeNull();
    expect(checkbox.shadowRoot?.textContent).toContain('<svg>Active</svg>');

    button.remove();
    card.remove();
    input.remove();
    textarea.remove();
    checkbox.remove();
  });

  it('keeps form components interactive without external dependencies', () => {
    const prefix = `kit${Date.now()}`;
    const tags = registerDefaultComponents({ prefix });

    const input = document.createElement(tags.input);
    input.setAttribute('label', 'Name');
    document.body.appendChild(input);

    const inputControl = input.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    expect(inputControl).not.toBeNull();
    if (!inputControl) throw new Error('Expected input control to exist');
    inputControl.value = 'Ada';
    inputControl.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.getAttribute('value')).toBe('Ada');

    const checkbox = document.createElement(tags.checkbox);
    checkbox.setAttribute('label', 'Active');
    document.body.appendChild(checkbox);

    const checkboxControl = checkbox.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    expect(checkboxControl).not.toBeNull();
    checkboxControl!.checked = true;
    checkboxControl!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(checkbox.getAttribute('checked')).toBe('true');

    input.remove();
    checkbox.remove();
  });

  it('preserves standard form attributes in component shadow DOM', () => {
    const prefix = `attrs${Date.now()}`;
    const tags = registerDefaultComponents({ prefix });

    const input = document.createElement(tags.input);
    input.setAttribute('label', 'Email');
    input.setAttribute('placeholder', 'user@example.com');
    input.setAttribute('value', 'test@example.com');
    input.setAttribute('disabled', 'true');
    document.body.appendChild(input);

    const inputShadow = input.shadowRoot?.innerHTML ?? '';
    expect(inputShadow).toContain('placeholder="user@example.com"');
    expect(inputShadow).toContain('value="test@example.com"');
    expect(inputShadow).toContain('disabled');

    const textarea = document.createElement(tags.textarea);
    textarea.setAttribute('label', 'Notes');
    textarea.setAttribute('placeholder', 'Enter notes');
    textarea.setAttribute('rows', '6');
    textarea.setAttribute('disabled', 'true');
    document.body.appendChild(textarea);

    const textareaShadow = textarea.shadowRoot?.innerHTML ?? '';
    expect(textareaShadow).toContain('placeholder="Enter notes"');
    expect(textareaShadow).toContain('rows="6"');
    expect(textareaShadow).toContain('disabled');

    const checkbox = document.createElement(tags.checkbox);
    checkbox.setAttribute('label', 'Active');
    checkbox.setAttribute('checked', 'true');
    checkbox.setAttribute('disabled', 'true');
    document.body.appendChild(checkbox);

    const checkboxShadow = checkbox.shadowRoot?.innerHTML ?? '';
    expect(checkboxShadow).toContain('checked');
    expect(checkboxShadow).toContain('disabled');

    input.remove();
    textarea.remove();
    checkbox.remove();
  });

  it('keeps input and textarea controls stable while reflecting typed values', () => {
    const prefix = `stable${Date.now()}`;
    const tags = registerDefaultComponents({ prefix });

    const input = document.createElement(tags.input);
    input.setAttribute('label', 'Name');
    document.body.appendChild(input);

    const inputControl = input.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    expect(inputControl).not.toBeNull();
    if (!inputControl) throw new Error('Expected input control to exist');
    inputControl.value = 'Ada';
    inputControl.dispatchEvent(new Event('input', { bubbles: true }));

    const inputControlAfterUpdate = input.shadowRoot?.querySelector(
      'input'
    ) as HTMLInputElement | null;
    expect(inputControlAfterUpdate).toBe(inputControl);
    expect(input.getAttribute('value')).toBe('Ada');
    expect(inputControlAfterUpdate?.value).toBe('Ada');

    const textarea = document.createElement(tags.textarea);
    textarea.setAttribute('label', 'Notes');
    document.body.appendChild(textarea);

    const textareaControl = textarea.shadowRoot?.querySelector(
      'textarea'
    ) as HTMLTextAreaElement | null;
    expect(textareaControl).not.toBeNull();
    if (!textareaControl) throw new Error('Expected textarea control to exist');
    textareaControl.value = 'Updated notes';
    textareaControl.dispatchEvent(new Event('input', { bubbles: true }));

    const textareaControlAfterUpdate = textarea.shadowRoot?.querySelector(
      'textarea'
    ) as HTMLTextAreaElement | null;
    expect(textareaControlAfterUpdate).toBe(textareaControl);
    expect(textarea.getAttribute('value')).toBe('Updated notes');
    expect(textareaControlAfterUpdate?.value).toBe('Updated notes');

    input.remove();
    textarea.remove();
  });

  it('re-renders textarea when the shadow label node has diverged during a value update', () => {
    const prefix = `textarea-label-divergence${Date.now()}`;
    const tags = registerDefaultComponents({ prefix });

    const textarea = document.createElement(tags.textarea);
    textarea.setAttribute('label', 'Notes');
    document.body.appendChild(textarea);

    const originalControl = textarea.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
    const labelEl = textarea.shadowRoot?.querySelector('.label');
    expect(originalControl).not.toBeNull();
    expect(labelEl).not.toBeNull();
    labelEl?.remove();

    textarea.setAttribute('value', 'Updated notes');

    const nextControl = textarea.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(textarea.shadowRoot?.querySelector('.label')?.textContent).toBe('Notes');
    expect(nextControl).not.toBeNull();
    expect(nextControl).not.toBe(originalControl);
    expect(nextControl?.value).toBe('Updated notes');

    textarea.remove();
  });

  it('re-renders input and textarea controls when non-value props change', () => {
    const prefix = `rerender${Date.now()}`;
    const tags = registerDefaultComponents({ prefix });

    const input = document.createElement(tags.input);
    input.setAttribute('label', 'Name');
    document.body.appendChild(input);

    const inputControl = input.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    expect(inputControl).not.toBeNull();
    if (!inputControl) throw new Error('Expected input control to exist');

    input.setAttribute('label', 'Full name');

    const inputControlAfterLabelUpdate = input.shadowRoot?.querySelector(
      'input'
    ) as HTMLInputElement | null;
    expect(inputControlAfterLabelUpdate).not.toBeNull();
    expect(inputControlAfterLabelUpdate).not.toBe(inputControl);
    expect(input.shadowRoot?.textContent).toContain('Full name');

    const textarea = document.createElement(tags.textarea);
    textarea.setAttribute('label', 'Notes');
    document.body.appendChild(textarea);

    const textareaControl = textarea.shadowRoot?.querySelector(
      'textarea'
    ) as HTMLTextAreaElement | null;
    expect(textareaControl).not.toBeNull();
    if (!textareaControl) throw new Error('Expected textarea control to exist');

    textarea.setAttribute('rows', '6');

    const textareaControlAfterRowsUpdate = textarea.shadowRoot?.querySelector(
      'textarea'
    ) as HTMLTextAreaElement | null;
    expect(textareaControlAfterRowsUpdate).not.toBeNull();
    expect(textareaControlAfterRowsUpdate).not.toBe(textareaControl);
    expect(textareaControlAfterRowsUpdate?.getAttribute('rows')).toBe('6');

    input.remove();
    textarea.remove();
  });

  it('dispatches a single host event for input, textarea, and checkbox interactions', () => {
    const prefix = `events${Date.now()}`;
    const tags = registerDefaultComponents({ prefix });

    const input = document.createElement(tags.input);
    document.body.appendChild(input);
    const inputEvents: Array<{ value: string | undefined }> = [];
    input.addEventListener('input', (event) => {
      inputEvents.push({ value: (event as CustomEvent<{ value: string }>).detail?.value });
    });

    const inputControl = input.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    if (!inputControl) throw new Error('Expected input control to exist');
    inputControl.value = 'Ada';
    inputControl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

    const textarea = document.createElement(tags.textarea);
    document.body.appendChild(textarea);
    const textareaEvents: Array<{ value: string | undefined }> = [];
    textarea.addEventListener('input', (event) => {
      textareaEvents.push({ value: (event as CustomEvent<{ value: string }>).detail?.value });
    });

    const textareaControl = textarea.shadowRoot?.querySelector(
      'textarea'
    ) as HTMLTextAreaElement | null;
    if (!textareaControl) throw new Error('Expected textarea control to exist');
    textareaControl.value = 'Notes';
    textareaControl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

    const checkbox = document.createElement(tags.checkbox);
    document.body.appendChild(checkbox);
    const checkboxEvents: Array<{ checked: boolean | undefined }> = [];
    checkbox.addEventListener('change', (event) => {
      checkboxEvents.push({
        checked: (event as CustomEvent<{ checked: boolean }>).detail?.checked,
      });
    });

    const checkboxControl = checkbox.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    if (!checkboxControl) throw new Error('Expected checkbox control to exist');
    checkboxControl.checked = true;
    checkboxControl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    expect(inputEvents).toEqual([{ value: 'Ada' }]);
    expect(textareaEvents).toEqual([{ value: 'Notes' }]);
    expect(checkboxEvents).toEqual([{ checked: true }]);

    input.remove();
    textarea.remove();
    checkbox.remove();
  });
});

describe('component/onAdopted lifecycle hook', () => {
  it('calls onAdopted when adoptedCallback fires', () => {
    const tagName = `test-adopted-hook-${Date.now()}`;
    const calls: string[] = [];

    component(tagName, {
      props: {},
      onAdopted() {
        calls.push('adopted');
      },
      render: () => html`<div>Adopted</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    // happy-dom does not trigger adoptedCallback via document.adoptNode,
    // so we invoke the lifecycle method directly on the element.
    (el as unknown as { adoptedCallback(): void }).adoptedCallback();

    expect(calls).toEqual(['adopted']);

    el.remove();
  });

  it('keeps component-scoped primitives available inside onAdopted', () => {
    const tagName = `test-adopted-scope-${Date.now()}`;
    const seenValues: string[] = [];
    const errors: Error[] = [];

    component(tagName, {
      props: {},
      onAdopted() {
        const adoptedSignal = useSignal('adopted');
        const upper = useComputed(() => adoptedSignal.value.toUpperCase());
        useEffect(() => {
          seenValues.push(upper.value);
        });
      },
      onError(error) {
        errors.push(error);
      },
      render: () => html`<div>Scoped adopted</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    (el as unknown as { adoptedCallback(): void }).adoptedCallback();

    expect(errors).toEqual([]);
    expect(seenValues).toEqual(['ADOPTED']);

    el.remove();
  });

  it('calls onError when onAdopted throws', () => {
    const tagName = `test-adopted-error-${Date.now()}`;
    const errors: Error[] = [];

    component(tagName, {
      props: {},
      onAdopted() {
        throw new Error('adopted error');
      },
      onError(error) {
        errors.push(error);
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    (el as unknown as { adoptedCallback(): void }).adoptedCallback();

    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe('adopted error');

    el.remove();
  });

  it('does nothing when onAdopted is not defined', () => {
    const tagName = `test-no-adopted-${Date.now()}`;

    component(tagName, {
      props: {},
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    // Should not throw
    expect(() => {
      (el as unknown as { adoptedCallback(): void }).adoptedCallback();
    }).not.toThrow();

    el.remove();
  });
});

describe('component/onAttributeChanged hook', () => {
  it('calls onAttributeChanged when a prop attribute changes', () => {
    const tagName = `test-attr-changed-${Date.now()}`;
    const changes: Array<{ name: string; oldValue: string | null; newValue: string | null }> = [];

    component<{ label: string }>(tagName, {
      props: {
        label: { type: String, default: '' },
      },
      onAttributeChanged(name, oldValue, newValue) {
        changes.push({ name, oldValue, newValue });
      },
      render: ({ props }) => html`<span>${props.label}</span>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    el.setAttribute('label', 'Hello');
    el.setAttribute('label', 'World');

    expect(changes.length).toBe(2);
    expect(changes[0]).toEqual({ name: 'label', oldValue: null, newValue: 'Hello' });
    expect(changes[1]).toEqual({ name: 'label', oldValue: 'Hello', newValue: 'World' });

    el.remove();
  });

  it('observes additional attributes from observeAttributes option', () => {
    const tagName = `test-extra-observe-${Date.now()}`;
    const changes: Array<{ name: string; oldValue: string | null; newValue: string | null }> = [];

    component(tagName, {
      props: {},
      observeAttributes: ['data-custom'],
      onAttributeChanged(name, oldValue, newValue) {
        changes.push({ name, oldValue, newValue });
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    el.setAttribute('data-custom', 'value1');

    expect(changes.length).toBe(1);
    expect(changes[0]).toEqual({ name: 'data-custom', oldValue: null, newValue: 'value1' });

    el.remove();
  });

  it('keeps component-scoped primitives available inside onAttributeChanged', () => {
    const tagName = `test-attr-scope-${Date.now()}`;
    const seenValues: string[] = [];

    component<{ label: string }>(tagName, {
      props: {
        label: { type: String, default: '' },
      },
      onAttributeChanged(_name, _oldValue, newValue) {
        const attrSignal = useSignal(newValue ?? '');
        seenValues.push(attrSignal.value);
      },
      render: ({ props }) => html`<span>${props.label}</span>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    el.setAttribute('label', 'Hello');
    el.setAttribute('label', 'World');

    expect(seenValues).toEqual(['Hello', 'World']);

    el.remove();
  });

  it('keeps component-scoped primitives available before deferred initial mount', () => {
    const tagName = `test-attr-scope-deferred-${Date.now()}`;
    const seenValues: string[] = [];

    component<{ label: string }>(tagName, {
      props: {
        label: { type: String, required: true },
      },
      onAttributeChanged(_name, _oldValue, newValue) {
        const attrSignal = useSignal(newValue ?? '');
        seenValues.push(attrSignal.value);
      },
      render: ({ props }) => html`<span>${props.label}</span>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.shadowRoot?.childNodes.length).toBe(0);

    el.setAttribute('label', 'Hello');

    expect(seenValues).toEqual(['Hello']);
    expect(el.shadowRoot?.textContent).toContain('Hello');

    el.remove();
  });

  it('keeps component-scoped primitives available before connectedCallback runs', () => {
    const tagName = `test-attr-scope-pre-connect-${Date.now()}`;
    const seenValues: string[] = [];
    const errors: Error[] = [];

    component<{ label: string }>(tagName, {
      props: {
        label: { type: String, default: '' },
      },
      onAttributeChanged(_name, _oldValue, newValue) {
        const attrSignal = useSignal(newValue ?? '');
        seenValues.push(attrSignal.value);
      },
      onError(error) {
        errors.push(error);
      },
      render: ({ props }) => html`<span>${props.label}</span>`,
    });

    const el = document.createElement(tagName);

    el.setAttribute('label', 'Hello before connect');

    expect(errors).toEqual([]);
    expect(seenValues).toEqual(['Hello before connect']);

    document.body.appendChild(el);

    expect(el.shadowRoot?.textContent).toContain('Hello before connect');

    el.remove();
  });

  it('deduplicates observeAttributes with props keys', () => {
    const tagName = `test-dedup-observe-${Date.now()}`;

    const ElementClass = defineComponent<{ name: string }>(tagName, {
      props: {
        name: { type: String, default: '' },
      },
      observeAttributes: ['name', 'data-extra'],
      render: () => html`<div>Test</div>`,
    });

    // observedAttributes should not have duplicates
    const observed = ElementClass.observedAttributes;
    expect(observed).toContain('name');
    expect(observed).toContain('data-extra');
    expect(observed.filter((a) => a === 'name').length).toBe(1);
  });
});

describe('component/shadow DOM mode', () => {
  it('creates an open shadow root by default', () => {
    const tagName = `test-shadow-default-${Date.now()}`;

    component(tagName, {
      props: {},
      render: () => html`<p>Content</p>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot?.innerHTML).toContain('Content');

    el.remove();
  });

  it('creates an open shadow root when shadow is true', () => {
    const tagName = `test-shadow-true-${Date.now()}`;

    component(tagName, {
      props: {},
      shadow: true,
      render: () => html`<p>Open</p>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.shadowRoot).not.toBeNull();

    el.remove();
  });

  it('creates an open shadow root when shadow is "open"', () => {
    const tagName = `test-shadow-open-${Date.now()}`;

    component(tagName, {
      props: {},
      shadow: 'open',
      render: () => html`<p>Open</p>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.shadowRoot).not.toBeNull();

    el.remove();
  });

  it('renders into the host element when shadow is false', () => {
    const tagName = `test-shadow-false-${Date.now()}`;

    component(tagName, {
      props: {},
      shadow: false,
      render: () => html`<p>No Shadow</p>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.shadowRoot).toBeNull();
    expect(el.innerHTML).toContain('No Shadow');

    el.remove();
  });

  it('renders styles in light DOM when shadow is false', () => {
    const tagName = `test-shadow-false-styles-${Date.now()}`;

    component(tagName, {
      props: {},
      shadow: false,
      styles: '.content { color: red; }',
      render: () => html`<div class="content">Styled</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    const styleEl = el.querySelector('style[data-bquery-component-style]');
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain('.content { color: red; }');

    el.remove();
  });

  it('re-renders in light DOM when attributes change with shadow false', () => {
    const tagName = `test-shadow-false-rerender-${Date.now()}`;

    component<{ label: string }>(tagName, {
      props: {
        label: { type: String, default: 'initial' },
      },
      shadow: false,
      render: ({ props }) => html`<span>${props.label}</span>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.innerHTML).toContain('initial');

    el.setAttribute('label', 'updated');
    expect(el.innerHTML).toContain('updated');

    el.remove();
  });
});

describe('component/useSignal', () => {
  it('throws when called outside a component scope', () => {
    expect(() => useSignal(0)).toThrow(/must be called inside a component/);
  });

  it('creates a signal accessible during connected()', () => {
    const tagName = `test-use-signal-${Date.now()}`;
    let signalValue: number | undefined;

    component(tagName, {
      props: {},
      connected() {
        const count = useSignal(42);
        signalValue = count.value;
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(signalValue).toBe(42);

    el.remove();
  });

  it('auto-disposes signal when component disconnects', () => {
    const tagName = `test-use-signal-dispose-${Date.now()}`;
    let createdSignal: ReturnType<typeof useSignal<number>> | undefined;

    component(tagName, {
      props: {},
      connected() {
        createdSignal = useSignal(0);
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(createdSignal).toBeDefined();
    expect(createdSignal!.value).toBe(0);

    // Disconnect the element - triggers scope disposal which calls signal.dispose()
    el.remove();

    // After disposal, the signal value is still readable via peek() (no subscribers
    // to clear since none were registered). The important side effect is that
    // all subscribers are removed, preventing memory leaks.
    expect(createdSignal!.peek()).toBe(0);
  });

  it('does not expose scoped primitives during render()', () => {
    const tagName = `test-use-signal-render-${Date.now()}`;
    const capturedErrors: Error[] = [];

    component(tagName, {
      props: {},
      onError(error) {
        capturedErrors.push(error);
      },
      render() {
        useSignal(7);
        return html`<div>unreachable</div>`;
      },
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0].message).toContain('Avoid calling it directly from render()');
    expect(el.shadowRoot?.textContent ?? '').not.toContain('unreachable');

    el.remove();
  });
});

describe('component/useComputed', () => {
  it('throws when called outside a component scope', () => {
    expect(() => useComputed(() => 42)).toThrow(/must be called inside a component/);
  });

  it('creates a computed value accessible during connected()', () => {
    const tagName = `test-use-computed-${Date.now()}`;
    let computedValue: number | undefined;

    component(tagName, {
      props: {},
      connected() {
        const count = useSignal(5);
        const doubled = useComputed(() => count.value * 2);
        computedValue = doubled.value;
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(computedValue).toBe(10);

    el.remove();
  });
});

describe('component/useEffect', () => {
  it('throws when called outside a component scope', () => {
    expect(() => useEffect(() => {})).toThrow(/must be called inside a component/);
  });

  it('runs the effect immediately during connected()', () => {
    const tagName = `test-use-effect-${Date.now()}`;
    const effectCalls: number[] = [];

    component(tagName, {
      props: {},
      connected() {
        const count = useSignal(1);
        useEffect(() => {
          effectCalls.push(count.value);
        });
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(effectCalls).toEqual([1]);

    el.remove();
  });

  it('returns a cleanup function that can be called manually', () => {
    const tagName = `test-use-effect-cleanup-${Date.now()}`;
    let manualCleanup: (() => void) | undefined;
    const cleanups: string[] = [];

    component(tagName, {
      props: {},
      connected() {
        manualCleanup = useEffect(() => {
          return () => {
            cleanups.push('cleaned');
          };
        });
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(manualCleanup).toBeDefined();

    // Manual cleanup should work
    manualCleanup!();
    expect(cleanups).toContain('cleaned');

    el.remove();
  });

  it('auto-disposes effect when component disconnects', () => {
    const tagName = `test-use-effect-auto-dispose-${Date.now()}`;
    const cleanups: string[] = [];

    component(tagName, {
      props: {},
      connected() {
        useEffect(() => {
          return () => {
            cleanups.push('auto-cleaned');
          };
        });
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(cleanups).toEqual([]);

    // Removing element should auto-dispose
    el.remove();

    expect(cleanups).toContain('auto-cleaned');
  });

  it('creates fresh scope on reconnect', () => {
    const tagName = `test-use-effect-reconnect-${Date.now()}`;
    const effects: string[] = [];
    const cleanups: string[] = [];

    component(tagName, {
      props: {},
      connected() {
        useEffect(() => {
          effects.push('connected');
          return () => {
            cleanups.push('disconnected');
          };
        });
      },
      render: () => html`<div>Test</div>`,
    });

    const el = document.createElement(tagName);

    // First connect
    document.body.appendChild(el);
    expect(effects).toEqual(['connected']);
    expect(cleanups).toEqual([]);

    // Disconnect
    el.remove();
    expect(cleanups).toEqual(['disconnected']);

    // Reconnect — new scope should be created
    document.body.appendChild(el);
    expect(effects).toEqual(['connected', 'connected']);

    // Second disconnect
    el.remove();
    expect(cleanups).toEqual(['disconnected', 'disconnected']);
  });
});

describe('component/createComponentScope', () => {
  it('does not log disposer errors in production mode', async () => {
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const originalNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'production';

    try {
      const { createComponentScope: createComponentScopeInProduction } = await import(
        `../src/component/scope.ts?production=${Date.now()}`
      );
      const scope = createComponentScopeInProduction();
      scope.addDisposer(() => {
        throw new Error('dispose failed');
      });
      scope.dispose();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      errorSpy.mockRestore();
    }
  });

  it('does not log disposer errors when process is unavailable', async () => {
    const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
    const originalDevOverride = (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(globalThis, 'process', {
      value: undefined,
      configurable: true,
    });

    try {
      const { createComponentScope: createComponentScopeWithoutProcess } = await import(
        `../src/component/scope.ts?no-process=${Date.now()}`
      );
      const scope = createComponentScopeWithoutProcess();
      scope.addDisposer(() => {
        throw new Error('dispose failed');
      });

      scope.dispose();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      if (originalProcessDescriptor) {
        Object.defineProperty(globalThis, 'process', originalProcessDescriptor);
      } else {
        delete (globalThis as { process?: unknown }).process;
      }
      if (originalDevOverride === undefined) {
        delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
      } else {
        (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = originalDevOverride;
      }
      errorSpy.mockRestore();
    }
  });

  it('logs disposer errors when the dev override is enabled without process', async () => {
    const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
    const originalDevOverride = (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(globalThis, 'process', {
      value: undefined,
      configurable: true,
    });
    (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = true;

    try {
      const { createComponentScope: createComponentScopeWithDevOverride } = await import(
        `../src/component/scope.ts?dev-override=${Date.now()}`
      );
      const scope = createComponentScopeWithDevOverride();
      scope.addDisposer(() => {
        throw new Error('dispose failed');
      });

      scope.dispose();
      expect(errorSpy).toHaveBeenCalledWith(
        'bQuery component: Error disposing scoped resource',
        expect.any(Error)
      );
    } finally {
      if (originalProcessDescriptor) {
        Object.defineProperty(globalThis, 'process', originalProcessDescriptor);
      } else {
        delete (globalThis as { process?: unknown }).process;
      }
      if (originalDevOverride === undefined) {
        delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
      } else {
        (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = originalDevOverride;
      }
      errorSpy.mockRestore();
    }
  });

  it('respects late dev override toggles for disposer errors after import', async () => {
    const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
    const originalDevOverride = (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(globalThis, 'process', {
      value: undefined,
      configurable: true,
    });
    delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;

    try {
      const { createComponentScope } = await import(
        `../src/component/scope.ts?late-dev-override=${Date.now()}`
      );
      const scopeBeforeOverride = createComponentScope();
      scopeBeforeOverride.addDisposer(() => {
        throw new Error('dispose failed');
      });

      scopeBeforeOverride.dispose();
      expect(errorSpy).not.toHaveBeenCalled();

      (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = true;

      const scopeAfterOverride = createComponentScope();
      scopeAfterOverride.addDisposer(() => {
        throw new Error('dispose failed');
      });

      scopeAfterOverride.dispose();
      expect(errorSpy).toHaveBeenCalledWith(
        'bQuery component: Error disposing scoped resource',
        expect.any(Error)
      );
    } finally {
      if (originalProcessDescriptor) {
        Object.defineProperty(globalThis, 'process', originalProcessDescriptor);
      } else {
        delete (globalThis as { process?: unknown }).process;
      }
      if (originalDevOverride === undefined) {
        delete (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__;
      } else {
        (globalThis as { __BQUERY_DEV__?: boolean }).__BQUERY_DEV__ = originalDevOverride;
      }
      errorSpy.mockRestore();
    }
  });
});

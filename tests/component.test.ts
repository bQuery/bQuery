import { describe, expect, it } from 'bun:test';
import { component, defineComponent, html } from '../src/component/index';

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

  it('calls beforeUpdate before re-renders and receives props', () => {
    const tagName = `test-before-update-${Date.now()}`;
    const receivedProps: unknown[] = [];
    let renderCount = 0;

    component<{ count: number }>(tagName, {
      props: {
        count: { type: Number, default: 0 },
      },
      beforeUpdate(props) {
        receivedProps.push({ ...props });
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
    expect(receivedProps[0]).toEqual({ count: 10 });

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

    component<{ count: number }>(tagName, {
      props: {
        count: { type: Number, default: 0 },
      },
      beforeUpdate() {
        callOrder.push('beforeUpdate');
        return true;
      },
      updated() {
        callOrder.push('updated');
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
          validator: (value) => value >= 0 && value <= 100,
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
          validator: (value) => value >= 18,
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
            return value <= 50;
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
          validator: (value) => value.includes('@'),
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

    const observedAttrs = (ElementClass as typeof HTMLElement & { observedAttributes: string[] }).observedAttributes;
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

  it('instances sanitize rendered markup for security', () => {
    const tagName = `test-define-sanitize-${Date.now()}`;
    const ElementClass = defineComponent(tagName, {
      props: {},
      render: () => html`<div><script>alert('xss')</script>Safe text</div>`,
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

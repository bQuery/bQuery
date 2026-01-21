import { describe, expect, it } from 'bun:test';
import { component, html } from '../src/component/index';

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
});

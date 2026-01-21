/**
 * Minimal Web Component helper for building custom elements.
 *
 * This module provides a declarative API for defining Web Components
 * without complex build steps. Features include:
 * - Type-safe props with automatic attribute coercion
 * - Reactive state management
 * - Shadow DOM encapsulation with scoped styles
 * - Lifecycle hooks (connected, disconnected)
 * - Event emission helpers
 *
 * @module bquery/component
 *
 * @example
 * ```ts
 * import { component, html } from 'bquery/component';
 *
 * component('user-card', {
 *   props: {
 *     username: { type: String, required: true },
 *     avatar: { type: String, default: '/default-avatar.png' },
 *   },
 *   styles: `
 *     .card { padding: 1rem; border: 1px solid #ccc; }
 *   `,
 *   render({ props }) {
 *     return html`
 *       <div class="card">
 *         <img src="${props.avatar}" alt="${props.username}" />
 *         <h3>${props.username}</h3>
 *       </div>
 *     `;
 *   },
 * });
 * ```
 */

/**
 * Defines a single prop's type and configuration.
 *
 * @template T - The TypeScript type of the prop value
 *
 * @example
 * ```ts
 * const myProp: PropDefinition<number> = {
 *   type: Number,
 *   required: false,
 *   default: 0,
 * };
 * ```
 */
export type PropDefinition<T = unknown> = {
  /** Constructor or converter function for the prop type */
  type:
    | StringConstructor
    | NumberConstructor
    | BooleanConstructor
    | ObjectConstructor
    | ArrayConstructor
    | { new (value: unknown): T }
    | ((value: unknown) => T);
  /** Whether the prop must be provided */
  required?: boolean;
  /** Default value when prop is not provided */
  default?: T;
};

/**
 * Complete component definition including props, state, styles, and lifecycle.
 *
 * @template TProps - Type of the component's props
 */
export type ComponentDefinition<TProps extends Record<string, unknown> = Record<string, unknown>> =
  {
    /** Prop definitions with types and defaults */
    props?: Record<keyof TProps, PropDefinition>;
    /** Initial internal state */
    state?: Record<string, unknown>;
    /** CSS styles scoped to the component's shadow DOM */
    styles?: string;
    /** Lifecycle hook called when component is added to DOM */
    connected?: () => void;
    /** Lifecycle hook called when component is removed from DOM */
    disconnected?: () => void;
    /** Lifecycle hook called after reactive updates trigger a render */
    updated?: () => void;
    /** Render function returning HTML string */
    render: (context: {
      props: TProps;
      state: Record<string, unknown>;
      emit: (event: string, detail?: unknown) => void;
    }) => string;
  };

/**
 * Coerces a string attribute value into a typed prop value.
 * Supports String, Number, Boolean, Object, Array, and custom converters.
 *
 * @internal
 * @template T - The target type
 * @param rawValue - The raw string value from the attribute
 * @param config - The prop definition with type information
 * @returns The coerced value of type T
 */
const coercePropValue = <T>(rawValue: string, config: PropDefinition<T>): T => {
  const { type } = config;

  if (type === String) return rawValue as T;

  if (type === Number) {
    const parsed = Number(rawValue);
    return (Number.isNaN(parsed) ? rawValue : parsed) as T;
  }

  if (type === Boolean) {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === '' || normalized === 'true' || normalized === '1') {
      return true as T;
    }
    if (normalized === 'false' || normalized === '0') {
      return false as T;
    }
    return Boolean(rawValue) as T;
  }

  if (type === Object || type === Array) {
    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return rawValue as T;
    }
  }

  if (typeof type === 'function') {
    const callable = type as (value: unknown) => T;
    const constructable = type as new (value: unknown) => T;
    try {
      return callable(rawValue);
    } catch {
      return new constructable(rawValue);
    }
  }

  return rawValue as T;
};

/**
 * Tagged template literal for creating HTML strings.
 *
 * This function handles interpolation of values into HTML templates,
 * converting null/undefined to empty strings.
 *
 * @param strings - Template literal string parts
 * @param values - Interpolated values
 * @returns Combined HTML string
 *
 * @example
 * ```ts
 * const name = 'World';
 * const greeting = html`<h1>Hello, ${name}!</h1>`;
 * // Result: '<h1>Hello, World!</h1>'
 * ```
 */
export const html = (strings: TemplateStringsArray, ...values: unknown[]): string => {
  return strings.reduce((acc, part, index) => `${acc}${part}${values[index] ?? ''}`, '');
};

/**
 * Escapes HTML entities in interpolated values for XSS prevention.
 * Use this when you need to safely embed user content in templates.
 *
 * @param strings - Template literal string parts
 * @param values - Interpolated values to escape
 * @returns Combined HTML string with escaped values
 *
 * @example
 * ```ts
 * const userInput = '<script>alert("xss")</script>';
 * const safe = safeHtml`<div>${userInput}</div>`;
 * // Result: '<div>&lt;script&gt;alert("xss")&lt;/script&gt;</div>'
 * ```
 */
export const safeHtml = (strings: TemplateStringsArray, ...values: unknown[]): string => {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;',
  };

  const escape = (value: unknown): string => {
    const str = String(value ?? '');
    return str.replace(/[&<>"'`]/g, (char) => escapeMap[char]);
  };

  return strings.reduce((acc, part, index) => `${acc}${part}${escape(values[index])}`, '');
};

/**
 * Defines and registers a custom Web Component.
 *
 * This function creates a new custom element with the given tag name
 * and configuration. The component uses Shadow DOM for encapsulation
 * and automatically re-renders when observed attributes change.
 *
 * @template TProps - Type of the component's props
 * @param tagName - The custom element tag name (must contain a hyphen)
 * @param definition - The component configuration
 *
 * @example
 * ```ts
 * component('counter-button', {
 *   props: {
 *     start: { type: Number, default: 0 },
 *   },
 *   state: { count: 0 },
 *   styles: `
 *     button { padding: 0.5rem 1rem; }
 *   `,
 *   connected() {
 *     console.log('Counter mounted');
 *   },
 *   render({ props, state, emit }) {
 *     return html`
 *       <button onclick="this.getRootNode().host.increment()">
 *         Count: ${state.count}
 *       </button>
 *     `;
 *   },
 * });
 * ```
 */
export const component = <TProps extends Record<string, unknown>>(
  tagName: string,
  definition: ComponentDefinition<TProps>
): void => {
  /**
   * Internal Web Component class created for each component definition.
   * @internal
   */
  class BQueryComponent extends HTMLElement {
    /** Internal state object for the component */
    private readonly state = { ...(definition.state ?? {}) };
    /** Typed props object populated from attributes */
    private props = {} as TProps;

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.syncProps();
    }

    /**
     * Returns the list of attributes to observe for changes.
     */
    static get observedAttributes(): string[] {
      return Object.keys(definition.props ?? {});
    }

    /**
     * Called when the element is added to the DOM.
     */
    connectedCallback(): void {
      definition.connected?.call(this);
      this.render();
    }

    /**
     * Called when the element is removed from the DOM.
     */
    disconnectedCallback(): void {
      definition.disconnected?.call(this);
    }

    /**
     * Called when an observed attribute changes.
     */
    attributeChangedCallback(): void {
      this.syncProps();
      this.render(true);
    }

    /**
     * Updates a state property and triggers a re-render.
     *
     * @param key - The state property key
     * @param value - The new value
     */
    setState(key: string, value: unknown): void {
      this.state[key] = value;
      this.render(true);
    }

    /**
     * Gets a state property value.
     *
     * @param key - The state property key
     * @returns The current value
     */
    getState<T = unknown>(key: string): T {
      return this.state[key] as T;
    }

    /**
     * Synchronizes props from attributes.
     * @internal
     */
    private syncProps(): void {
      const props = definition.props ?? {};
      for (const [key, config] of Object.entries(props) as [string, PropDefinition][]) {
        const attrValue = this.getAttribute(key);
        if (attrValue == null) {
          if (config.required && config.default === undefined) {
            throw new Error(`bQuery component: missing required prop "${key}"`);
          }
          (this.props as Record<string, unknown>)[key] = config.default ?? undefined;
          continue;
        }
        (this.props as Record<string, unknown>)[key] = coercePropValue(
          attrValue,
          config
        ) as TProps[keyof TProps];
      }
    }

    /**
     * Renders the component to its shadow root.
     * @internal
     */
    private render(triggerUpdated = false): void {
      /**
       * Emits a custom event from the component.
       */
      const emit = (event: string, detail?: unknown): void => {
        this.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, composed: true }));
      };

      if (!this.shadowRoot) return;

      const markup = definition.render({
        props: this.props,
        state: this.state,
        emit,
      });

      const styles = definition.styles ? `<style>${definition.styles}</style>` : '';
      this.shadowRoot.innerHTML = `${styles}${markup}`;

      if (triggerUpdated) {
        definition.updated?.call(this);
      }
    }
  }

  if (!customElements.get(tagName)) {
    customElements.define(tagName, BQueryComponent);
  }
};

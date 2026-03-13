/**
 * Web Component factory and registry.
 *
 * @module bquery/component
 */

import { sanitizeHtml } from '../security/sanitize';
import { coercePropValue } from './props';
import type {
  AttributeChange,
  ComponentClass,
  ComponentDefinition,
  ComponentStateShape,
  PropDefinition,
} from './types';

/**
 * Base extra tags preserved for component shadow DOM renders in addition to the
 * global sanitizer defaults. `slot` must remain allowed here because shadow DOM
 * content projection depends on authored `<slot>` elements in component render
 * output.
 */
const COMPONENT_ALLOWED_TAGS = ['slot'];

/**
 * Base extra attributes preserved for component shadow DOM renders in addition
 * to the global sanitizer defaults.
 */
const COMPONENT_ALLOWED_ATTRIBUTES = [
  'part',
  // Standard form attributes required by interactive shadow DOM content
  'disabled',
  'checked',
  'placeholder',
  'value',
  'rows',
  'cols',
  'readonly',
  'required',
  'maxlength',
  'minlength',
  'max',
  'min',
  'step',
  'pattern',
  'autocomplete',
  'autofocus',
  'for',
  'multiple',
  'selected',
  'wrap',
];

/**
 * Creates a custom element class for a component definition.
 *
 * This is useful when you want to extend or register the class manually
 * (e.g. with different tag names in tests or custom registries).
 *
 * @template TProps - Type of the component's props
 * @param tagName - The custom element tag name (used for diagnostics)
 * @param definition - The component configuration
 */
const createComponentClass = <
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown> | undefined = undefined,
>(
  tagName: string,
  definition: ComponentDefinition<TProps, TState>
): ComponentClass<TState> => {
  const componentAllowedTags = [...COMPONENT_ALLOWED_TAGS, ...(definition.sanitize?.allowTags ?? [])];
  const componentAllowedAttributes = [
    ...COMPONENT_ALLOWED_ATTRIBUTES,
    ...(definition.sanitize?.allowAttributes ?? []),
  ];

  class BQueryComponent extends HTMLElement {
    /** Internal state object for the component */
    private readonly state: ComponentStateShape<TState> = {
      ...(definition.state ?? {}),
    } as ComponentStateShape<TState>;
    /** Typed props object populated from attributes */
    private props = {} as TProps;
    /** Tracks missing required props for validation during connectedCallback */
    private missingRequiredProps = new Set<string>();
    /** Tracks whether the component has completed its initial mount */
    private hasMounted = false;

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
      try {
        // Defer initial render until all required props are present
        // This allows attributes to be set after element creation
        if (this.missingRequiredProps.size > 0) {
          // Component will mount once all required props are satisfied
          // via attributeChangedCallback
          return;
        }
        this.mount();
      } catch (error) {
        this.handleError(error as Error);
      }
    }

    /**
     * Performs the initial mount of the component.
     * Called when the element is connected and all required props are present.
     * @internal
     */
    private mount(): void {
      if (this.hasMounted) return;
      definition.beforeMount?.call(this);
      definition.connected?.call(this);
      this.render();
      this.hasMounted = true;
    }

    /**
     * Called when the element is removed from the DOM.
     */
    disconnectedCallback(): void {
      try {
        definition.disconnected?.call(this);
      } catch (error) {
        this.handleError(error as Error);
      }
    }

    /**
     * Called when an observed attribute changes.
     */
    attributeChangedCallback(
      name: string,
      oldValue: string | null,
      newValue: string | null
    ): void {
      try {
        this.syncProps();

        if (this.hasMounted) {
          // Component already mounted - trigger update render
          this.render(true, { name, oldValue, newValue });
        } else if (this.isConnected && this.missingRequiredProps.size === 0) {
          // All required props are now satisfied and element is connected
          // Trigger the deferred initial mount
          this.mount();
        }
      } catch (error) {
        this.handleError(error as Error);
      }
    }

    /**
     * Handles errors during component lifecycle.
     * @internal
     */
    private handleError(error: Error): void {
      if (definition.onError) {
        definition.onError.call(this, error);
      } else {
        console.error(`bQuery component error in <${tagName}>:`, error);
      }
    }

    /**
     * Updates a state property and triggers a re-render.
     *
     * @param key - The state property key
     * @param value - The new value
     */
    setState<TKey extends keyof ComponentStateShape<TState>>(
      key: TKey,
      value: ComponentStateShape<TState>[TKey]
    ): void {
      this.state[key] = value;
      this.render(true);
    }

    /**
     * Gets a state property value.
     *
     * @param key - The state property key
     * @returns The current value
     */
    getState<TKey extends keyof ComponentStateShape<TState>>(
      key: TKey
    ): ComponentStateShape<TState>[TKey];
    getState<TResult = unknown>(key: string): TResult;
    getState(key: string): unknown {
      return (this.state as Record<string, unknown>)[key];
    }

    /**
     * Synchronizes props from attributes.
     * @internal
     */
    private syncProps(): void {
      const props = definition.props ?? {};
      for (const [key, config] of Object.entries(props) as [string, PropDefinition][]) {
        const attrValue = this.getAttribute(key);
        let value: unknown;

        if (attrValue == null) {
          if (config.required && config.default === undefined) {
            // Mark as missing instead of throwing - validate during connectedCallback
            this.missingRequiredProps.add(key);
            value = undefined;
          } else {
            value = config.default ?? undefined;
          }
        } else {
          // Attribute is present, remove from missing set if it was there
          if (this.missingRequiredProps.has(key)) {
            this.missingRequiredProps.delete(key);
          }
          value = coercePropValue(attrValue, config);
        }

        if (config.validator && value !== undefined) {
          const isValid = config.validator(value);
          if (!isValid) {
            throw new Error(
              `bQuery component: validation failed for prop "${key}" with value ${JSON.stringify(value)}`
            );
          }
        }

        (this.props as Record<string, unknown>)[key] = value;
      }
    }

    /**
     * Renders the component to its shadow root.
     * @internal
     */
    private render(triggerUpdated = false, change?: AttributeChange): void {
      try {
        if (triggerUpdated && definition.beforeUpdate) {
          const shouldUpdate = definition.beforeUpdate.call(this, this.props);
          if (shouldUpdate === false) return;
        }

        const emit = (event: string, detail?: unknown): void => {
          this.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, composed: true }));
        };

        if (!this.shadowRoot) return;

        const markup = definition.render({
          props: this.props,
          state: this.state,
          emit,
        });

        // Component render output is authored by the component definition itself,
        // so we can explicitly preserve shadow-DOM-specific markup such as <slot>,
        // the stylistic `part` attribute, and standard form/input attributes without
        // relaxing the global DOM sanitization rules.
        const sanitizedMarkup = sanitizeHtml(markup, {
          allowTags: componentAllowedTags,
          allowAttributes: componentAllowedAttributes,
        });
        this.shadowRoot.innerHTML = sanitizedMarkup;

        if (definition.styles) {
          const styleElement = document.createElement('style');
          styleElement.textContent = definition.styles;
          this.shadowRoot.prepend(styleElement);
        }

        if (triggerUpdated) {
          definition.updated?.call(this, change);
        }
      } catch (error) {
        this.handleError(error as Error);
      }
    }
  }

  return BQueryComponent as ComponentClass<TState>;
};

/**
 * Creates a custom element class for a component definition.
 *
 * This is useful when you want to extend or register the class manually
 * (e.g. with different tag names in tests or custom registries).
 *
 * @template TProps - Type of the component's props
 * @template TState - Type of the component's internal state. When provided,
 * `definition.state` is required, `render({ state })` is strongly typed, and
 * returned instances expose typed `getState()` / `setState()` helpers.
 * @param tagName - The custom element tag name (used for diagnostics)
 * @param definition - The component configuration
 */
export function defineComponent<TProps extends Record<string, unknown>>(
  tagName: string,
  definition: ComponentDefinition<TProps>
): ComponentClass<undefined>;
export function defineComponent<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown>,
>(
  tagName: string,
  definition: ComponentDefinition<TProps, TState>
): ComponentClass<TState>;
export function defineComponent<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown> | undefined = undefined,
>(
  tagName: string,
  definition: ComponentDefinition<TProps, TState>
): ComponentClass<TState> {
  return createComponentClass(tagName, definition);
}

/**
 * Defines and registers a custom Web Component.
 *
 * This function creates a new custom element with the given tag name
 * and configuration. The component uses Shadow DOM for encapsulation
 * and automatically re-renders when observed attributes change.
 *
 * @template TProps - Type of the component's props
 * @template TState - Type of the component's internal state. When provided,
 * `definition.state` is required and lifecycle hooks receive typed state
 * helpers via `this.getState()` / `this.setState()`.
 * @param tagName - The custom element tag name (must contain a hyphen)
 * @param definition - The component configuration
 *
 * @example
 * ```ts
 * component<{ start: number }, { count: number }>('counter-button', {
 *   props: {
 *     start: { type: Number, default: 0 },
 *   },
 *   state: { count: 0 },
 *   styles: `
 *     button { padding: 0.5rem 1rem; }
 *   `,
 *   connected() {
 *     // Use event delegation on shadow root so handler survives re-renders
 *     const handleClick = (event: Event) => {
 *       const target = event.target as HTMLElement | null;
 *       if (target?.matches('button')) {
 *         this.setState('count', this.getState('count') + 1);
 *       }
 *     };
 *     this.shadowRoot?.addEventListener('click', handleClick);
 *     // Store handler for cleanup
 *     (this as any)._handleClick = handleClick;
 *   },
 *   disconnected() {
 *     // Clean up event listener to prevent memory leaks
 *     const handleClick = (this as any)._handleClick;
 *     if (handleClick) {
 *       this.shadowRoot?.removeEventListener('click', handleClick);
 *     }
 *   },
 *   render({ props, state }) {
 *     return html`
 *       <button>
 *         Count: ${state.count}
 *       </button>
 *     `;
 *   },
 * });
 * ```
 */
export function component<TProps extends Record<string, unknown>>(
  tagName: string,
  definition: ComponentDefinition<TProps>
): void;
export function component<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown>,
>(
  tagName: string,
  definition: ComponentDefinition<TProps, TState>
): void;
export function component<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown> | undefined = undefined,
>(
  tagName: string,
  definition: ComponentDefinition<TProps, TState>
): void {
  const elementClass = createComponentClass(tagName, definition);

  if (!customElements.get(tagName)) {
    customElements.define(tagName, elementClass);
  }
}

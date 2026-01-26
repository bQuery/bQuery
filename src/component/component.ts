/**
 * Web Component factory and registry.
 *
 * @module bquery/component
 */

import { sanitizeHtml } from '../security/sanitize';
import { coercePropValue } from './props';
import type { ComponentDefinition, PropDefinition } from './types';

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
export const defineComponent = <TProps extends Record<string, unknown>>(
  tagName: string,
  definition: ComponentDefinition<TProps>
): typeof HTMLElement => {
  class BQueryComponent extends HTMLElement {
    /** Internal state object for the component */
    private readonly state = { ...(definition.state ?? {}) };
    /** Typed props object populated from attributes */
    private props = {} as TProps;
    /** Tracks missing required props for validation during connectedCallback */
    private missingRequiredProps = new Set<string>();

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
        // Validate required props before mounting
        if (this.missingRequiredProps.size > 0) {
          const missing = Array.from(this.missingRequiredProps).join(', ');
          throw new Error(`bQuery component: missing required props: ${missing}`);
        }
        definition.beforeMount?.call(this);
        definition.connected?.call(this);
        this.render();
      } catch (error) {
        this.handleError(error as Error);
      }
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
      _name: string,
      _oldValue: string | null,
      _newValue: string | null
    ): void {
      try {
        this.syncProps();
        this.render(true);
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
        let value: unknown;

        if (attrValue == null) {
          if (config.required && config.default === undefined) {
            // Mark as missing instead of throwing - validate during connectedCallback
            this.missingRequiredProps.add(key);
            value = undefined;
          } else {
            this.missingRequiredProps.delete(key);
            value = config.default ?? undefined;
          }
        } else {
          this.missingRequiredProps.delete(key);
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
    private render(triggerUpdated = false): void {
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

        const sanitizedMarkup = sanitizeHtml(markup);
        this.shadowRoot.innerHTML = sanitizedMarkup;

        if (definition.styles) {
          const styleElement = document.createElement('style');
          styleElement.textContent = definition.styles;
          this.shadowRoot.prepend(styleElement);
        }

        if (triggerUpdated) {
          definition.updated?.call(this);
        }
      } catch (error) {
        this.handleError(error as Error);
      }
    }
  }

  return BQueryComponent;
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
 *     // Use event delegation on shadow root so handler survives re-renders
 *     const handleClick = (event: Event) => {
 *       const target = event.target as HTMLElement | null;
 *       if (target?.matches('button')) {
 *         this.setState('count', (this.getState('count') as number) + 1);
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
export const component = <TProps extends Record<string, unknown>>(
  tagName: string,
  definition: ComponentDefinition<TProps>
): void => {
  const elementClass = defineComponent(tagName, definition);

  if (!customElements.get(tagName)) {
    customElements.define(tagName, elementClass);
  }
};

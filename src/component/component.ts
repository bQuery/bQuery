/**
 * Web Component factory and registry.
 *
 * @module bquery/component
 */

import type { CleanupFn } from '../reactive/signal';
import { effect, untrack } from '../reactive/signal';
import { sanitizeHtml } from '../security/sanitize';
import { coercePropValue } from './props';
import { createComponentScope, setCurrentScope, type ComponentScope } from './scope';
import type {
  AttributeChange,
  ComponentClass,
  ComponentDefinition,
  ComponentSignalLike,
  ComponentSignals,
  ComponentStateShape,
  PropDefinition,
  ShadowMode,
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
  TSignals extends ComponentSignals = Record<string, never>,
>(
  tagName: string,
  definition: ComponentDefinition<TProps, TState, TSignals>
): ComponentClass<TState> => {
  const componentAllowedTags = [
    ...COMPONENT_ALLOWED_TAGS,
    ...(definition.sanitize?.allowTags ?? []),
  ];
  const componentAllowedAttributes = [
    ...COMPONENT_ALLOWED_ATTRIBUTES,
    ...(definition.sanitize?.allowAttributes ?? []),
  ];
  const signalSources = Object.values(definition.signals ?? {}) as ComponentSignalLike<unknown>[];

  /** Resolve the Shadow DOM mode from the `shadow` option. */
  const resolveShadowMode = (option: ShadowMode | undefined): 'open' | 'closed' | false => {
    if (option === false) return false;
    if (option === 'closed') return 'closed';
    // true, 'open', or undefined all resolve to 'open'
    return 'open';
  };
  const shadowMode = resolveShadowMode(definition.shadow);

  /**
   * Merges prop-derived observed attributes with any extra attributes from
   * `observeAttributes`, deduplicating to avoid redundant callbacks.
   */
  const observedAttrs = Array.from(
    new Set([...Object.keys(definition.props ?? {}), ...(definition.observeAttributes ?? [])])
  );

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
    /** Cleanup for external signal subscriptions */
    private signalEffectCleanup?: CleanupFn;
    /** Component-scoped reactive resource tracker */
    private scope?: ComponentScope;
    /** Render target for open/closed shadow roots or the host element when shadow DOM is disabled */
    private readonly renderRootNode: HTMLElement | ShadowRoot;

    constructor() {
      super();
      if (shadowMode !== false) {
        this.renderRootNode = this.attachShadow({ mode: shadowMode });
      } else {
        this.renderRootNode = this;
      }
      this.syncProps();
    }

    /**
     * Returns the list of attributes to observe for changes.
     */
    static get observedAttributes(): string[] {
      return observedAttrs;
    }

    /**
     * Called when the element is added to the DOM.
     */
    connectedCallback(): void {
      try {
        // Defer only the initial mount until all required props are present.
        // Already-mounted components must still reconnect their signal
        // subscriptions so reactive updates can resume after reattachment.
        if (!this.hasMounted && this.missingRequiredProps.size > 0) {
          // Component will mount once all required props are satisfied
          // via attributeChangedCallback
          return;
        }
        if (this.hasMounted) {
          // Recreate scope for reconnected component
          this.scope = createComponentScope();
          const previousScope = setCurrentScope(this.scope);
          try {
            definition.connected?.call(this);
          } catch (error) {
            this.handleError(error as Error);
          } finally {
            setCurrentScope(previousScope);
          }
          this.setupSignalSubscriptions(true);
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
      const previousScope = setCurrentScope(this.ensureScope());
      let hookError = false;
      try {
        definition.beforeMount?.call(this);
        definition.connected?.call(this);
      } catch (error) {
        hookError = true;
        this.handleError(error as Error);
      } finally {
        setCurrentScope(previousScope);
      }
      if (hookError) {
        this.scope?.dispose();
        this.scope = undefined;
        return;
      }
      this.render();
      this.setupSignalSubscriptions();
      this.hasMounted = true;
    }

    /**
     * Called when the element is removed from the DOM.
     */
    disconnectedCallback(): void {
      try {
        this.signalEffectCleanup?.();
        this.signalEffectCleanup = undefined;
        // Dispose all scoped reactive resources (useSignal, useComputed, useEffect)
        this.scope?.dispose();
        this.scope = undefined;
        definition.disconnected?.call(this);
      } catch (error) {
        this.handleError(error as Error);
      }
    }

    /**
     * Called when an observed attribute changes.
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
      try {
        const previousProps = this.cloneProps();
        this.syncProps();

        // Fire the user-facing onAttributeChanged hook for every observed attribute change
        if (definition.onAttributeChanged) {
          const previousScope = setCurrentScope(this.ensureScope());
          try {
            definition.onAttributeChanged.call(this, name, oldValue, newValue);
          } finally {
            setCurrentScope(previousScope);
          }
        }

        if (this.hasMounted) {
          // Component already mounted - trigger update render
          this.render(true, previousProps, { name, oldValue, newValue });
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
     * Called when the element is moved to a new document (e.g. via `document.adoptNode`).
     */
    adoptedCallback(): void {
      if (!definition.onAdopted) {
        return;
      }

      const previousScope = setCurrentScope(this.ensureScope());
      try {
        definition.onAdopted.call(this);
      } catch (error) {
        this.handleError(error as Error);
      } finally {
        setCurrentScope(previousScope);
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
     * Ensures the component has an active scope for scoped reactive primitives.
     * @internal
     */
    private ensureScope(): ComponentScope {
      return (this.scope ??= createComponentScope());
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
      this.render(true, this.cloneProps(), undefined, false);
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
     * Subscribes to declared reactive sources and re-renders on change.
     *
     * @param renderOnInitialRun - When true, immediately re-renders after
     * re-subscribing so detached components resync with any signal changes
     * that happened while they were disconnected.
     * @internal
     */
    private setupSignalSubscriptions(renderOnInitialRun = false): void {
      if (this.signalEffectCleanup || signalSources.length === 0) return;

      let isInitialRun = true;
      this.signalEffectCleanup = effect(() => {
        try {
          for (const source of signalSources) {
            // Intentionally read each source to register this effect as a subscriber.
            void source.value;
          }

          if (isInitialRun) {
            isInitialRun = false;
            if (renderOnInitialRun && this.hasMounted && this.isConnected) {
              // Signal-driven reconnect renders do not change props, so the
              // previous-props snapshot is the current prop set at reconnect time.
              const previousProps = this.cloneProps();
              untrack(() => {
                this.render(true, previousProps, undefined, false);
              });
            }
            return;
          }

          if (!this.hasMounted || !this.isConnected) return;

          // Signal updates leave props unchanged, so cloning the current props
          // provides the previous-props snapshot expected by beforeUpdate().
          const previousProps = this.cloneProps();
          untrack(() => {
            this.render(true, previousProps, undefined, false);
          });
        } catch (error) {
          this.handleError(error as Error);
        }
      });
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
     * Creates a shallow snapshot of the current props for lifecycle diffing.
     * A shallow copy is sufficient because component props are re-derived from
     * reflected attributes on each update, so nested object mutation is not
     * tracked as part of this lifecycle diff.
     * @internal
     */
    private cloneProps(): TProps {
      return { ...(this.props as Record<string, unknown>) } as TProps;
    }

    /**
     * Renders the component to its shadow root or host element.
     * @internal
     */
    private render(): void;
    private render(triggerUpdated: true, oldProps: TProps, change?: AttributeChange): void;
    private render(
      triggerUpdated: true,
      oldProps: TProps,
      change: AttributeChange | undefined,
      runBeforeUpdate: boolean
    ): void;
    private render(
      triggerUpdated = false,
      oldProps?: TProps,
      change?: AttributeChange,
      runBeforeUpdate = true
    ): void {
      try {
        if (triggerUpdated && runBeforeUpdate && definition.beforeUpdate) {
          if (!oldProps) {
            throw new Error('bQuery component: previous props are required for update renders');
          }
          const shouldUpdate = definition.beforeUpdate.call(this, this.props, oldProps);
          if (shouldUpdate === false) return;
        }

        const emit = (event: string, detail?: unknown): void => {
          this.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, composed: true }));
        };

        const renderRoot = this.renderRootNode;

        const markup = definition.render({
          props: this.props,
          state: this.state,
          signals: (definition.signals ?? {}) as TSignals,
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
        let existingStyleElement: HTMLStyleElement | null = null;
        if (definition.styles) {
          existingStyleElement = renderRoot.querySelector<HTMLStyleElement>(
            'style[data-bquery-component-style]'
          );
        }

        renderRoot.innerHTML = sanitizedMarkup;

        if (definition.styles) {
          const styleElement = existingStyleElement ?? document.createElement('style');
          if (!existingStyleElement) {
            styleElement.setAttribute('data-bquery-component-style', '');
          }
          styleElement.textContent = definition.styles;
          renderRoot.prepend(styleElement);
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
export function defineComponent<
  TProps extends Record<string, unknown>,
  TSignals extends ComponentSignals = Record<string, never>,
>(
  tagName: string,
  definition: ComponentDefinition<TProps, undefined, TSignals>
): ComponentClass<undefined>;
export function defineComponent<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown>,
  TSignals extends ComponentSignals = Record<string, never>,
>(
  tagName: string,
  definition: ComponentDefinition<TProps, TState, TSignals>
): ComponentClass<TState>;
export function defineComponent<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown> | undefined = undefined,
  TSignals extends ComponentSignals = Record<string, never>,
>(
  tagName: string,
  definition: ComponentDefinition<TProps, TState, TSignals>
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
export function component<
  TProps extends Record<string, unknown>,
  TSignals extends ComponentSignals = Record<string, never>,
>(tagName: string, definition: ComponentDefinition<TProps, undefined, TSignals>): void;
export function component<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown>,
  TSignals extends ComponentSignals = Record<string, never>,
>(tagName: string, definition: ComponentDefinition<TProps, TState, TSignals>): void;
export function component<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown> | undefined = undefined,
  TSignals extends ComponentSignals = Record<string, never>,
>(tagName: string, definition: ComponentDefinition<TProps, TState, TSignals>): void {
  const elementClass = createComponentClass(tagName, definition);

  if (!customElements.get(tagName)) {
    customElements.define(tagName, elementClass);
  }
}

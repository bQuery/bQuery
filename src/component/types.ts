/**
 * Component types and render context definitions.
 *
 * @module bquery/component
 */

import type { SanitizeOptions } from '../security/types';

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
  /** Optional validator function to validate prop values */
  validator?: (value: T) => boolean;
  /**
   * Explicitly control whether to invoke `type` with `new` (constructor) or as a plain function.
   * - `true`: Always use `new type(value)` (for class constructors, Date, etc.)
   * - `false`: Always call `type(value)` (for converter functions)
   * - `undefined` (default): Auto-detect based on heuristics with fallback
   */
  construct?: boolean;
};

/**
 * Resolves the concrete runtime state shape exposed by component APIs.
 *
 * When no explicit state generic is provided, component state falls back to
 * an untyped string-keyed record for backwards compatibility.
 */
export type ComponentStateShape<TState extends Record<string, unknown> | undefined = undefined> =
  TState extends Record<string, unknown> ? TState : Record<string, unknown>;

/**
 * Component state keys are string-based because runtime state access is backed
 * by plain object properties.
 */
export type ComponentStateKey<TState extends Record<string, unknown> | undefined = undefined> =
  keyof ComponentStateShape<TState> & string;

/**
 * Public component element instance shape exposed by lifecycle hooks and
 * `defineComponent()` return values.
 */
export type ComponentElement<TState extends Record<string, unknown> | undefined = undefined> =
  HTMLElement & {
    /**
     * Updates a state property and triggers a re-render.
     *
     * @param key - The state property key
     * @param value - The new value
     */
    setState<TKey extends ComponentStateKey<TState>>(
      key: TKey,
      value: ComponentStateShape<TState>[TKey]
    ): void;
    /**
     * Gets a state property value.
     *
     * @param key - The state property key
     * @returns The current value
     */
    getState<TKey extends ComponentStateKey<TState>>(key: TKey): ComponentStateShape<TState>[TKey];
    /**
     * Gets a state property value with an explicit cast for backwards
     * compatibility with the pre-typed-state API.
     *
     * @param key - The state property key
     * @returns The current value cast to `TResult`
     */
    getState<TResult = unknown>(key: string): TResult;
  };

/**
 * Constructor returned by `defineComponent()`.
 */
export type ComponentClass<TState extends Record<string, unknown> | undefined = undefined> =
  CustomElementConstructor & {
    new (): ComponentElement<TState>;
    prototype: ComponentElement<TState>;
    readonly observedAttributes: string[];
  };

/**
 * Minimal reactive source shape supported by component `signals`.
 *
 * @template T - Value exposed by the signal-like source
 */
export type ComponentSignalLike<T = unknown> = {
  /** Gets the current reactive value */
  readonly value: T;
  /** Gets the current value without dependency tracking */
  peek(): T;
};

/**
 * Named reactive sources that can drive component re-renders.
 */
export type ComponentSignals = Record<string, ComponentSignalLike<unknown>>;

/**
 * Render context passed into a component render function.
 *
 * @template TProps - Type of the component's props
 * @template TState - Type of the component's internal state
 * @template TSignals - Declared reactive sources available during render
 */
export type ComponentRenderContext<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown> | undefined = undefined,
  TSignals extends ComponentSignals = Record<string, never>,
> = {
  /** Typed props object populated from attributes */
  props: TProps;
  /** Internal mutable state object */
  state: ComponentStateShape<TState>;
  /** External reactive sources subscribed for re-rendering */
  signals: TSignals;
  /** Emit a custom event from the component */
  emit: (event: string, detail?: unknown) => void;
};

/**
 * Describes an observed attribute change that triggered a component update.
 */
export type AttributeChange = {
  /** The observed attribute name */
  name: string;
  /** The previous serialized attribute value */
  oldValue: string | null;
  /** The next serialized attribute value */
  newValue: string | null;
};

/**
 * Complete component definition including props, state, styles, and lifecycle.
 *
 * @template TProps - Type of the component's props
 * @template TState - Type of the component's internal state
 */
/*
 * Lifecycle hooks use dynamic `this` when declared with method/function syntax.
 * Arrow functions capture outer scope, so component APIs like `this.getState()`
 * are only available from method/function syntax.
 */
type ComponentSanitizeOptions = Pick<SanitizeOptions, 'allowTags' | 'allowAttributes'>;
type ComponentHook<
  TState extends Record<string, unknown> | undefined = undefined,
  TResult = void,
> = {
  (this: ComponentElement<TState>): TResult;
  (): TResult;
};
type ComponentHookWithProps<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown> | undefined = undefined,
  TResult = void,
> = {
  (this: ComponentElement<TState>, newProps: TProps, oldProps: TProps): TResult;
  (newProps: TProps, oldProps: TProps): TResult;
};
type ComponentUpdatedHook<
  TState extends Record<string, unknown> | undefined = undefined,
  TResult = void,
> = {
  (this: ComponentElement<TState>, change?: AttributeChange): TResult;
  (change?: AttributeChange): TResult;
};
type ComponentErrorHook<TState extends Record<string, unknown> | undefined = undefined> = {
  (this: ComponentElement<TState>, error: Error): void;
  (error: Error): void;
};

type ComponentAttributeChangedHook<TState extends Record<string, unknown> | undefined = undefined> =
  {
    (
      this: ComponentElement<TState>,
      name: string,
      oldValue: string | null,
      newValue: string | null
    ): void;
    (name: string, oldValue: string | null, newValue: string | null): void;
  };

type ComponentStateDefinition<TState extends Record<string, unknown> | undefined = undefined> =
  TState extends Record<string, unknown>
    ? {
        /** Initial internal state */
        state: TState;
      }
    : {
        /** Initial internal state */
        state?: Record<string, unknown>;
      };

type ComponentSignalsDefinition<TSignals extends ComponentSignals = Record<string, never>> =
  TSignals extends Record<string, never>
    ? {
        /** External signals/computed values that should trigger re-renders */
        signals?: TSignals;
      }
    : {
        /** External signals/computed values that should trigger re-renders */
        signals: TSignals;
      };

/**
 * Controls Shadow DOM mode for the component.
 *
 * - `true` or `'open'` — attach an open shadow root (default)
 * - `'closed'` — attach a closed shadow root
 * - `false` — no shadow root; render directly into the host element
 */
export type ShadowMode = boolean | 'open' | 'closed';

export type ComponentDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TState extends Record<string, unknown> | undefined = undefined,
  TSignals extends ComponentSignals = Record<string, never>,
> = ComponentStateDefinition<TState> &
  ComponentSignalsDefinition<TSignals> & {
    /** Prop definitions with types and defaults */
    props?: Record<keyof TProps, PropDefinition>;
    /**
     * CSS styles injected for the component.
     *
     * When `shadow` uses a shadow root (`true`, `'open'`, or `'closed'`), these
     * styles are scoped to that shadow tree. When `shadow` is `false`, the
     * generated `<style>` element is rendered into the host's light DOM and may
     * therefore affect surrounding markup according to normal CSS cascade rules.
     */
    styles?: string;
    /**
     * Controls Shadow DOM mode.
     *
     * - `true` or `'open'` — open shadow root (default)
     * - `'closed'` — closed shadow root
     * - `false` — no shadow root; render into the host element
     *
     * @default true
     */
    shadow?: ShadowMode;
    /**
     * Extra sanitizer options merged with the framework base allowlist during render.
     * Only opt in attributes/tags whose values you control or validate. Sensitive
     * attributes such as `style` are not value-sanitized and can reintroduce XSS
     * or UI-redressing risks if used with untrusted input.
     */
    sanitize?: ComponentSanitizeOptions;
    /**
     * Additional attributes to observe beyond those declared in `props`.
     *
     * Useful when you want `onAttributeChanged` to fire for attributes
     * that are not part of the typed props system.
     */
    observeAttributes?: string[];
    /** Lifecycle hook called before the component mounts (before first render) */
    beforeMount?: ComponentHook<TState>;
    /** Lifecycle hook called when component is added to DOM */
    connected?: ComponentHook<TState>;
    /** Lifecycle hook called when component is removed from DOM */
    disconnected?: ComponentHook<TState>;
    /**
     * Lifecycle hook called when the component is moved to a new document
     * (e.g. via `document.adoptNode`).
     */
    onAdopted?: ComponentHook<TState>;
    /**
     * Lifecycle hook called when any observed attribute changes.
     *
     * Observed attributes are automatically derived from `props` keys
     * plus any additional names in `observeAttributes`.
     *
     * @param name - The attribute name that changed
     * @param oldValue - The previous attribute value (null if added)
     * @param newValue - The new attribute value (null if removed)
     */
    onAttributeChanged?: ComponentAttributeChangedHook<TState>;
    /** Lifecycle hook called before an update render; return false to prevent */
    beforeUpdate?: ComponentHookWithProps<TProps, TState, boolean | void>;
    /** Lifecycle hook called after update renders; receives attribute change info when applicable */
    updated?: ComponentUpdatedHook<TState>;
    /** Error handler for errors during rendering or lifecycle */
    onError?: ComponentErrorHook<TState>;
    /** Render function returning HTML string */
    render: (context: ComponentRenderContext<TProps, TState, TSignals>) => string;
  };

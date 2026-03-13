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
export type ComponentStateShape<
  TState extends Record<string, unknown> | undefined = undefined,
> = TState extends Record<string, unknown> ? TState : Record<string, unknown>;

/**
 * Public component element instance shape exposed by lifecycle hooks and
 * `defineComponent()` return values.
 */
export type ComponentElement<
  TState extends Record<string, unknown> | undefined = undefined,
> = HTMLElement & {
  /**
   * Updates a state property and triggers a re-render.
   *
   * @param key - The state property key
   * @param value - The new value
   */
  setState<TKey extends keyof ComponentStateShape<TState>>(
    key: TKey,
    value: ComponentStateShape<TState>[TKey]
  ): void;
  /**
   * Gets a state property value.
   *
   * @param key - The state property key
   * @returns The current value
   */
  getState<TKey extends keyof ComponentStateShape<TState>>(
    key: TKey
  ): ComponentStateShape<TState>[TKey];
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
 * Render context passed into a component render function.
 *
 * @template TProps - Type of the component's props
 * @template TState - Type of the component's internal state
 */
export type ComponentRenderContext<
  TProps extends Record<string, unknown>,
  TState extends Record<string, unknown> | undefined = undefined,
> = {
  /** Typed props object populated from attributes */
  props: TProps;
  /** Internal mutable state object */
  state: ComponentStateShape<TState>;
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
  (this: ComponentElement<TState>, props: TProps): TResult;
  (props: TProps): TResult;
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

export type ComponentDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TState extends Record<string, unknown> | undefined = undefined,
> = ComponentStateDefinition<TState> & {
    /** Prop definitions with types and defaults */
    props?: Record<keyof TProps, PropDefinition>;
    /** CSS styles scoped to the component's shadow DOM */
    styles?: string;
    /**
     * Extra sanitizer options merged with the framework base allowlist during render.
     * Only opt in attributes/tags whose values you control or validate. Sensitive
     * attributes such as `style` are not value-sanitized and can reintroduce XSS
     * or UI-redressing risks if used with untrusted input.
     */
    sanitize?: ComponentSanitizeOptions;
    /** Lifecycle hook called before the component mounts (before first render) */
    beforeMount?: ComponentHook<TState>;
    /** Lifecycle hook called when component is added to DOM */
    connected?: ComponentHook<TState>;
    /** Lifecycle hook called when component is removed from DOM */
    disconnected?: ComponentHook<TState>;
    /** Lifecycle hook called before an update render; return false to prevent */
    beforeUpdate?: ComponentHookWithProps<TProps, TState, boolean | void>;
    /** Lifecycle hook called after update renders; receives attribute change info when applicable */
    updated?: ComponentUpdatedHook<TState>;
    /** Error handler for errors during rendering or lifecycle */
    onError?: ComponentErrorHook<TState>;
    /** Render function returning HTML string */
    render: (context: ComponentRenderContext<TProps, TState>) => string;
  };

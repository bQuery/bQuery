/**
 * Component types and render context definitions.
 *
 * @module bquery/component
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
 * Render context passed into a component render function.
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
 */
export type ComponentRenderContext<
  TProps extends Record<string, unknown>,
  TSignals extends ComponentSignals = Record<string, never>,
> = {
  /** Typed props object populated from attributes */
  props: TProps;
  /** Internal mutable state object */
  state: Record<string, unknown>;
  /** External reactive sources subscribed for re-rendering */
  signals: TSignals;
  /** Emit a custom event from the component */
  emit: (event: string, detail?: unknown) => void;
};

/**
 * Complete component definition including props, state, styles, and lifecycle.
 *
 * @template TProps - Type of the component's props
 */
type ComponentHook<TResult = void> = ((this: HTMLElement) => TResult) | (() => TResult);
type ComponentHookWithProps<TProps extends Record<string, unknown>, TResult = void> =
  | ((this: HTMLElement, props: TProps) => TResult)
  | ((props: TProps) => TResult);
type ComponentErrorHook = ((this: HTMLElement, error: Error) => void) | ((error: Error) => void);

export type ComponentDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TSignals extends ComponentSignals = Record<string, never>,
> = {
    /** Prop definitions with types and defaults */
    props?: Record<keyof TProps, PropDefinition>;
    /** Initial internal state */
    state?: Record<string, unknown>;
    /** External signals/computed values that should trigger re-renders */
    signals?: TSignals;
    /** CSS styles scoped to the component's shadow DOM */
    styles?: string;
    /** Lifecycle hook called before the component mounts (before first render) */
    beforeMount?: ComponentHook;
    /** Lifecycle hook called when component is added to DOM */
    connected?: ComponentHook;
    /** Lifecycle hook called when component is removed from DOM */
    disconnected?: ComponentHook;
    /** Lifecycle hook called before an update render; return false to prevent */
    beforeUpdate?: ComponentHookWithProps<TProps, boolean | void>;
    /** Lifecycle hook called after reactive updates trigger a render */
    updated?: ComponentHook;
    /** Error handler for errors during rendering or lifecycle */
    onError?: ComponentErrorHook;
    /** Render function returning HTML string */
    render: (context: ComponentRenderContext<TProps, TSignals>) => string;
  };

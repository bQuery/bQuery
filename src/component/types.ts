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
};

/**
 * Render context passed into a component render function.
 */
export type ComponentRenderContext<TProps extends Record<string, unknown>> = {
  /** Typed props object populated from attributes */
  props: TProps;
  /** Internal mutable state object */
  state: Record<string, unknown>;
  /** Emit a custom event from the component */
  emit: (event: string, detail?: unknown) => void;
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
    /** Lifecycle hook called before the component mounts (before first render) */
    beforeMount?: () => void;
    /** Lifecycle hook called when component is added to DOM */
    connected?: () => void;
    /** Lifecycle hook called when component is removed from DOM */
    disconnected?: () => void;
    /** Lifecycle hook called before an update render; return false to prevent */
    beforeUpdate?: (props: TProps) => boolean | void;
    /** Lifecycle hook called after reactive updates trigger a render */
    updated?: () => void;
    /** Error handler for errors during rendering or lifecycle */
    onError?: (error: Error) => void;
    /** Render function returning HTML string */
    render: (context: ComponentRenderContext<TProps>) => string;
  };

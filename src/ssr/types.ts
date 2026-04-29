import type { HydrateMountOptions } from './hydrate';

/**
 * Public types for the SSR / Pre-rendering module.
 */

/**
 * Options for server-side rendering a template to an HTML string.
 */
export type RenderOptions = {
  /**
   * Prefix for directive attributes.
   * @default 'bq'
   */
  prefix?: string;

  /**
   * Whether to strip directive attributes from the output HTML.
   * When `true`, attributes like `bq-text`, `bq-if`, etc. are removed
   * from the rendered output for cleaner HTML.
   * @default false
   */
  stripDirectives?: boolean;

  /**
   * Whether to include a serialized store state `<script>` tag in the output.
   * When `true`, all registered store states are serialized and appended.
   * You can also pass an array of store IDs to serialize only specific stores.
   * @default false
   */
  includeStoreState?: boolean | string[];

  /**
   * Whether to add a `data-bq-h` mismatch hash to every element that carries
   * a `bq-*` directive. Used by `verifyHydration()` on the client to flag
   * Server↔Client divergence in development. Adds ≈ 6–8 bytes per directive
   * element; safe to leave on in production but only useful in dev builds.
   *
   * Do not combine this with `stripDirectives: true` if you plan to call
   * `verifyHydration()` later: once the `bq-*` / `:` directives are stripped
   * from the HTML, the client can no longer recompute the original signature,
   * so verification will deterministically report mismatches.
   *
   * Currently honoured by the DOM-free renderer; the legacy DOM backend
   * applies the same annotation when `DOMParser` is available.
   *
   * @default false
   */
  annotateHydration?: boolean;
};

/**
 * Result of a `renderToString` call.
 */
export type SSRResult = {
  /** The rendered HTML string */
  html: string;

  /**
   * Serialized store state string, typically the `<script>` tag payload
   * produced when `includeStoreState` is enabled.
   */
  storeState?: string;
};

/** @deprecated Use `HydrateMountOptions` instead. */
export type HydrationOptions = HydrateMountOptions;

/**
 * Options for serializing store state.
 */
export type SerializeOptions = {
  /**
   * The ID attribute for the generated `<script>` tag.
   * @default '__BQUERY_STORE_STATE__'
   */
  scriptId?: string;

  /**
   * The global variable name where state will be assigned.
   * @default '__BQUERY_INITIAL_STATE__'
   */
  globalKey?: string;

  /**
   * Store IDs to serialize. If omitted, all registered stores are serialized.
   */
  storeIds?: string[];

  /**
   * Custom serializer function. Defaults to `JSON.stringify`.
   */
  serialize?: (data: unknown) => string;
};

/**
 * Deserialized store state map: store ID → plain state object.
 */
export type DeserializedStoreState = Record<string, Record<string, unknown>>;

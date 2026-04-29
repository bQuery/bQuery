/**
 * Versioned store snapshots and strict drift-checking hydration.
 *
 * Sits *on top of* the simple `serializeStoreState()` / `hydrateStore()` pair
 * to give applications a way to:
 * - tag the snapshot with a schema version so a stale client can refuse to
 *   apply server data that no longer matches its store shape;
 * - opt into strict mode where unknown keys cause a warning;
 * - selectively serialize / hydrate a subset of stores.
 *
 * Backwards compatible: the existing helpers stay untouched and remain the
 * primary entry-point for simple use cases.
 *
 * @module bquery/ssr
 */

import { getStore, listStores } from '../store/index';
import { isPrototypePollutionKey } from '../core/utils/object';
import { escapeForHtmlAttribute, escapeForScript } from './escape';

const isStateObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitize = (value: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (isPrototypePollutionKey(k)) continue;
    out[k] = v;
  }
  return out;
};

/** Versioned store snapshot. */
export interface SSRStoreSnapshot {
  /** Application-defined version string. Stable per schema. */
  version: string;
  /** Map of store ID → sanitized state. */
  state: Record<string, Record<string, unknown>>;
}

/** Result of `serializeStoreSnapshot()`. */
export interface SerializeSnapshotResult {
  snapshot: SSRStoreSnapshot;
  /** JSON-serialized snapshot. */
  json: string;
  /** `<script>` tag ready to embed (CSP-nonce-aware via `options.nonce`). */
  scriptTag: string;
}

/** Options for `serializeStoreSnapshot()`. */
export interface SerializeSnapshotOptions {
  /** Schema version. Required: hydration only succeeds when versions match. */
  version: string;
  /** Subset of store IDs to serialize. Defaults to all registered stores. */
  storeIds?: string[];
  /** Element ID for the generated `<script>` tag. */
  scriptId?: string;
  /** Global window key where the snapshot is assigned. */
  globalKey?: string;
  /** CSP nonce applied to the generated `<script>`. */
  nonce?: string;
}

/**
 * Captures every registered store's state into a versioned snapshot and
 * returns both the JSON payload and a ready-to-embed `<script>` tag.
 */
export const serializeStoreSnapshot = (
  options: SerializeSnapshotOptions
): SerializeSnapshotResult => {
  const {
    version,
    storeIds,
    scriptId = '__BQUERY_STORE_SNAPSHOT__',
    globalKey = '__BQUERY_STORE_SNAPSHOT__',
    nonce,
  } = options;

  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(
      'serializeStoreSnapshot: `version` is required and must be a non-empty string.'
    );
  }
  if (isPrototypePollutionKey(scriptId) || isPrototypePollutionKey(globalKey)) {
    throw new Error('serializeStoreSnapshot: invalid scriptId/globalKey.');
  }

  const ids = storeIds ?? listStores();
  const state = Object.create(null) as Record<string, Record<string, unknown>>;
  for (const id of ids) {
    if (isPrototypePollutionKey(id)) continue;
    const store = getStore<{ $state: Record<string, unknown> }>(id);
    if (store) state[id] = sanitize(store.$state);
  }
  const snapshot: SSRStoreSnapshot = { version, state };
  const json = JSON.stringify(snapshot);

  const escapedJson = escapeForScript(json);
  const escapedKey = escapeForScript(JSON.stringify(globalKey));
  const escapedId = escapeForHtmlAttribute(scriptId);
  const nonceAttr = nonce ? ` nonce="${escapeForHtmlAttribute(nonce)}"` : '';
  const scriptTag = `<script id="${escapedId}"${nonceAttr}>window[${escapedKey}]=${escapedJson}</script>`;
  return { snapshot, json, scriptTag };
};

/** Options for `hydrateStoreSnapshot()`. */
export interface HydrateSnapshotOptions {
  /**
   * If set, the snapshot's `version` must match this value. Otherwise the
   * function returns early (and warns when `strict` is true).
   */
  expectedVersion?: string;
  /**
   * Strict mode: warn on version mismatch + warn on unknown store IDs (i.e.
   * the snapshot has IDs that aren't currently registered). Default: `false`.
   */
  strict?: boolean;
}

/** Result of `hydrateStoreSnapshot()`. */
export interface HydrateSnapshotResult {
  /** Whether the snapshot was applied. */
  applied: boolean;
  /** Reason when not applied (`'version-mismatch' | 'invalid-shape'`). */
  reason?: 'version-mismatch' | 'invalid-shape';
  /** IDs that were applied. */
  appliedIds: string[];
  /** IDs in the snapshot that no store exists for. */
  unknownIds: string[];
}

const isStoreSnapshot = (value: unknown): value is SSRStoreSnapshot => {
  if (!isStateObject(value)) return false;
  const v = (value as { version: unknown }).version;
  const s = (value as { state: unknown }).state;
  return typeof v === 'string' && isStateObject(s);
};

/**
 * Applies a previously-serialized `SSRStoreSnapshot` to the registered stores.
 *
 * Returns a structured result; never throws on drift unless an explicit error
 * is thrown by a store's `$patch()` implementation.
 */
export const hydrateStoreSnapshot = (
  snapshot: unknown,
  options: HydrateSnapshotOptions = {}
): HydrateSnapshotResult => {
  if (!isStoreSnapshot(snapshot)) {
    if (options.strict) {
      console.warn('[bQuery SSR] hydrateStoreSnapshot: snapshot has invalid shape.');
    }
    return { applied: false, reason: 'invalid-shape', appliedIds: [], unknownIds: [] };
  }

  if (typeof options.expectedVersion === 'string' && options.expectedVersion !== snapshot.version) {
    if (options.strict) {
      console.warn(
        `[bQuery SSR] hydrateStoreSnapshot: version mismatch — server="${snapshot.version}" client="${options.expectedVersion}". Skipping.`
      );
    }
    return { applied: false, reason: 'version-mismatch', appliedIds: [], unknownIds: [] };
  }

  const appliedIds: string[] = [];
  const unknownIds: string[] = [];
  for (const [id, state] of Object.entries(snapshot.state)) {
    if (isPrototypePollutionKey(id) || !isStateObject(state)) continue;
    const store = getStore<{ $patch?: (partial: Record<string, unknown>) => void }>(id);
    if (!store || typeof store.$patch !== 'function') {
      unknownIds.push(id);
      if (options.strict) {
        console.warn(
          `[bQuery SSR] hydrateStoreSnapshot: store "${id}" is not registered; skipping.`
        );
      }
      continue;
    }
    store.$patch(sanitize(state));
    appliedIds.push(id);
  }
  return { applied: appliedIds.length > 0, appliedIds, unknownIds };
};

/**
 * Reads the snapshot emitted by `serializeStoreSnapshot()` from `window`,
 * cleans up the global, and returns the parsed `SSRStoreSnapshot`.
 *
 * Returns `null` when no snapshot was found or when it has the wrong shape.
 */
export const readStoreSnapshot = (
  globalKey = '__BQUERY_STORE_SNAPSHOT__',
  scriptId = '__BQUERY_STORE_SNAPSHOT__'
): SSRStoreSnapshot | null => {
  if (isPrototypePollutionKey(globalKey) || isPrototypePollutionKey(scriptId)) return null;
  if (typeof window === 'undefined') return null;
  const raw = (window as unknown as Record<string, unknown>)[globalKey];
  try {
    delete (window as unknown as Record<string, unknown>)[globalKey];
  } catch {
    (window as unknown as Record<string, unknown>)[globalKey] = undefined;
  }
  if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
    const el = document.getElementById(scriptId);
    if (el) el.remove();
  }
  if (!isStoreSnapshot(raw)) return null;
  return raw;
};

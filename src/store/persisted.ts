/**
 * Store persistence helpers.
 */

import { createStore } from './create-store';
import type { PersistedStoreOptions, Store, StoreDefinition } from './types';

/** @internal Version key suffix */
const VERSION_SUFFIX = '__version';

/** @internal Default JSON serializer */
const defaultSerializer = {
  serialize: (state: unknown) => JSON.stringify(state),
  deserialize: (raw: string) => JSON.parse(raw) as unknown,
};

/**
 * Creates a store with automatic persistence.
 *
 * Supports configurable storage backends, custom serializers, and schema
 * versioning with migration functions. All options are optional and
 * backward-compatible with the simple `(definition, storageKey?)` signature.
 *
 * @param definition - Store definition
 * @param options - Persistence options or a plain string storage key for backward compatibility
 * @returns The reactive store instance
 *
 * @example Basic usage (localStorage + JSON)
 * ```ts
 * const store = createPersistedStore({
 *   id: 'settings',
 *   state: () => ({ theme: 'dark' }),
 * });
 * ```
 *
 * @example With sessionStorage and custom key
 * ```ts
 * const store = createPersistedStore(
 *   { id: 'session', state: () => ({ token: '' }) },
 *   { key: 'my-session', storage: sessionStorage },
 * );
 * ```
 *
 * @example With versioning and migration
 * ```ts
 * const store = createPersistedStore(
 *   { id: 'app', state: () => ({ name: '', theme: 'auto' }) },
 *   {
 *     version: 2,
 *     migrate: (old, v) => {
 *       if (v < 2) return { ...old, theme: 'auto' };
 *       return old;
 *     },
 *   },
 * );
 * ```
 */
export const createPersistedStore = <
  S extends Record<string, unknown>,
  G extends Record<string, unknown> = Record<string, never>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- actions may declare specific parameter types
  A extends Record<string, (...args: any[]) => any> = Record<string, never>,
>(
  definition: StoreDefinition<S, G, A>,
  options?: PersistedStoreOptions | string
): Store<S, G, A> => {
  // Normalize options — a plain string is treated as the storage key for backward compatibility
  const opts: PersistedStoreOptions =
    typeof options === 'string' ? { key: options } : (options ?? {});

  const key = opts.key ?? `bquery-store-${definition.id}`;
  const storage = opts.storage ?? (typeof window !== 'undefined' ? localStorage : undefined);
  const serializer = opts.serializer ?? defaultSerializer;
  const version = opts.version;
  const migrate = opts.migrate;

  const originalStateFactory = definition.state;

  const wrappedDefinition: StoreDefinition<S, G, A> = {
    ...definition,
    state: () => {
      const defaultState = originalStateFactory();

      if (!storage) return defaultState;

      try {
        const saved = storage.getItem(key);
        if (!saved) return defaultState;

        let persisted = serializer.deserialize(saved) as Record<string, unknown>;

        // Handle versioning & migration
        if (version !== undefined && migrate) {
          const versionKey = key + VERSION_SUFFIX;
          const rawVersion = storage.getItem(versionKey);
          const oldVersion = rawVersion !== null ? Number(rawVersion) : 0;

          if (oldVersion !== version) {
            persisted = migrate(persisted, oldVersion);
            // Save the migrated state and the new version immediately
            try {
              storage.setItem(key, serializer.serialize(persisted));
              storage.setItem(versionKey, String(version));
            } catch (e) {
              // Migration will re-run on next load, but state is still usable
              console.warn(
                `[bQuery store "${definition.id}"] Failed to persist migrated state:`,
                e
              );
            }
          }
        }

        return { ...defaultState, ...persisted } as S;
      } catch {
        // Ignore parse errors
        return defaultState;
      }
    },
  };

  const store = createStore(wrappedDefinition);

  // Persist the version number on first creation
  if (storage && version !== undefined) {
    try {
      storage.setItem(key + VERSION_SUFFIX, String(version));
    } catch {
      // Ignore quota errors
    }
  }

  // Subscribe to save changes
  store.$subscribe((state) => {
    if (!storage) return;
    try {
      storage.setItem(key, serializer.serialize(state));
    } catch {
      // Ignore quota errors
    }
  });

  return store;
};

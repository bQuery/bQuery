/**
 * Store persistence helpers.
 */

import { isPrototypePollutionKey } from '../core/utils/object';
import { createStore } from './create-store';
import type { PersistedStoreOptions, Store, StoreDefinition } from './types';

/** @internal Version key suffix */
const VERSION_SUFFIX = '__version';

/** @internal Default JSON serializer */
const defaultSerializer = {
  serialize: (state: unknown) => JSON.stringify(state),
  deserialize: (raw: string) => JSON.parse(raw) as unknown,
};

/** @internal Check whether a value can be merged into store state. */
const isPersistedStateObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Applies persisted state onto the default state while ignoring dangerous
 * prototype-pollution keys such as `__proto__`, `constructor`, and `prototype`.
 *
 * @internal
 */
const mergePersistedState = <S extends Record<string, unknown>>(
  defaultState: S,
  persisted: Record<string, unknown>
): S => {
  const merged = { ...defaultState };
  for (const [key, value] of Object.entries(persisted)) {
    if (isPrototypePollutionKey(key)) continue;
    merged[key as keyof S] = value as S[keyof S];
  }
  return merged;
};

/** @internal Resolve the default storage backend safely. */
const getDefaultStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
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
  const storage = opts.storage ?? getDefaultStorage();
  const serializer = opts.serializer ?? defaultSerializer;
  const version = opts.version;
  const migrate = opts.migrate;
  const versionKey = key + VERSION_SUFFIX;
  let shouldPersistInitialVersion = storage !== undefined && version !== undefined;
  let pendingVersionWrite = false;
  let canRetryPendingVersionAfterCreate = false;

  const tryPersistVersion = (warningMessage?: string): boolean => {
    if (!storage || version === undefined) return false;

    try {
      storage.setItem(versionKey, String(version));
      return true;
    } catch (error) {
      if (warningMessage) {
        console.warn(warningMessage, error);
      }
      return false;
    }
  };

  const originalStateFactory = definition.state;

  const wrappedDefinition: StoreDefinition<S, G, A> = {
    ...definition,
    state: () => {
      const defaultState = originalStateFactory();

      if (!storage) return defaultState;

      try {
        const saved = storage.getItem(key);
        if (!saved) return defaultState;

        const deserialized = serializer.deserialize(saved);
        if (!isPersistedStateObject(deserialized)) {
          return defaultState;
        }

        let persisted = deserialized;

        // Handle versioning & migration
        if (version !== undefined && migrate) {
          const rawVersion = storage.getItem(versionKey);
          const parsedVersion = rawVersion !== null ? Number(rawVersion) : 0;
          const oldVersion = Number.isFinite(parsedVersion) ? parsedVersion : 0;

          if (oldVersion !== version) {
            shouldPersistInitialVersion = false;
            pendingVersionWrite = true;
            const migrated = migrate(persisted, oldVersion);
            if (!isPersistedStateObject(migrated)) {
              return defaultState;
            }
            persisted = migrated;

            let migratedStatePersisted = false;
            // Save the migrated state and version immediately when possible.
            // If the state write fails, never advance the version key.
            try {
              storage.setItem(key, serializer.serialize(persisted));
              migratedStatePersisted = true;
              canRetryPendingVersionAfterCreate = true;
            } catch (e) {
              // Migration will re-run on next load, but state is still usable
              console.warn(
                `[bQuery store "${definition.id}"] Failed to persist migrated state:`,
                e
              );
            }

            if (
              migratedStatePersisted &&
              tryPersistVersion(
                `[bQuery store "${definition.id}"] Failed to persist migrated version:`
              )
            ) {
              pendingVersionWrite = false;
            }
          } else {
            shouldPersistInitialVersion = false;
          }
        }

        return mergePersistedState(defaultState, persisted);
      } catch {
        // Ignore parse errors
        return defaultState;
      }
    },
  };

  const store = createStore(wrappedDefinition);

  // Persist the version number on first creation
  if (shouldPersistInitialVersion && storage) {
    try {
      storage.setItem(versionKey, String(version));
    } catch {
      // Ignore quota errors
    }
  } else if (
    pendingVersionWrite &&
    canRetryPendingVersionAfterCreate &&
    tryPersistVersion(
      `[bQuery store "${definition.id}"] Failed to persist migrated version after store creation:`
    )
  ) {
    pendingVersionWrite = false;
  }

  // Subscribe to save changes
  store.$subscribe((state) => {
    if (!storage) return;
    try {
      storage.setItem(key, serializer.serialize(state));
      if (
        pendingVersionWrite &&
        tryPersistVersion(
          `[bQuery store "${definition.id}"] Failed to persist migrated version after a successful state write:`
        )
      ) {
        pendingVersionWrite = false;
      }
    } catch {
      // Ignore quota errors
    }
  });

  return store;
};

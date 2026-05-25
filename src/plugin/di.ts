/**
 * Global dependency-injection container for plugins (1.14+).
 *
 * Mirrors the component-level `provide()`/`inject()` pair but operates at
 * application scope so plugins can publish typed singletons consumed by other
 * plugins, stores, or application code.
 *
 * @module bquery/plugin
 */

/**
 * Typed key used to store and retrieve values in the global DI container.
 *
 * The key carries a phantom `T` so that `inject(key)` resolves to the same
 * type that was provided.
 */
export interface InjectionKey<T> {
  readonly description?: string;
  /** Phantom for the value type. */
  readonly __type?: T;
}

interface DiEntry {
  value: unknown;
  owner?: string;
}

const container = new Map<InjectionKey<unknown> | string | symbol, DiEntry>();

/**
 * Create a typed injection key.
 *
 * @example
 * ```ts
 * import { createInjectionKey, provide, inject } from '@bquery/bquery/plugin';
 * const LoggerKey = createInjectionKey<Logger>('logger');
 * provide(LoggerKey, console);
 * const logger = inject(LoggerKey); // typed as Logger | undefined
 * ```
 */
export const createInjectionKey = <T>(description?: string): InjectionKey<T> =>
  Object.freeze({ description });

/**
 * Register a value in the global DI container.
 *
 * @param key - The injection key, string, or symbol.
 * @param value - The value to expose to consumers.
 */
export const provide = <T>(key: InjectionKey<T> | string | symbol, value: T): void => {
  registerProvide(key, value);
};

/** @internal */
export const registerProvide = (
  key: InjectionKey<unknown> | string | symbol,
  value: unknown,
  owner?: string
): void => {
  container.set(key, { value, owner });
};

/**
 * Retrieve a value previously registered via {@link provide}.
 *
 * @returns The value or `undefined` when no value was provided.
 */
export const inject = <T>(key: InjectionKey<T> | string | symbol): T | undefined => {
  const entry = container.get(key);
  return entry ? (entry.value as T) : undefined;
};

/**
 * Returns `true` when a value has been provided for the given key.
 */
export const hasProvided = (key: InjectionKey<unknown> | string | symbol): boolean =>
  container.has(key);

/** Remove every DI binding owned by the given plugin. @internal */
export const removeProvidedByOwner = (owner: string): void => {
  for (const [key, entry] of container) {
    if (entry.owner === owner) container.delete(key);
  }
};

/** Reset the entire DI container. Test-only. @internal */
export const resetDi = (): void => {
  container.clear();
};

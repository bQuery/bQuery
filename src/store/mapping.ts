/**
 * Mapping helpers for store state and actions.
 */

/**
 * Maps store state properties to a reactive object for use in components.
 *
 * @param store - The store instance
 * @param keys - State keys to map
 * @returns Object with mapped properties
 */
export const mapState = <S extends Record<string, unknown>, K extends keyof S>(
  store: S,
  keys: K[]
): Pick<S, K> => {
  const mapped = {} as Pick<S, K>;

  for (const key of keys) {
    Object.defineProperty(mapped, key, {
      get: () => store[key],
      enumerable: true,
    });
  }

  return mapped;
};

/**
 * Maps store getters to a reactive object for use in components.
 *
 * @param store - The store instance
 * @param keys - Getter keys to map
 * @returns Object with mapped getters
 */
export const mapGetters = <G extends Record<string, unknown>, K extends keyof G>(
  store: G,
  keys: K[]
): Pick<G, K> => {
  const mapped = {} as Pick<G, K>;

  for (const key of keys) {
    Object.defineProperty(mapped, key, {
      get: () => store[key],
      enumerable: true,
    });
  }

  return mapped;
};

/**
 * Maps store actions to an object for easier destructuring.
 *
 * @param store - The store instance
 * @param keys - Action keys to map
 * @returns Object with mapped actions
 */
export const mapActions = <
  A extends Record<string, (...args: unknown[]) => unknown>,
  K extends keyof A,
>(
  store: A,
  keys: K[]
): Pick<A, K> => {
  const mapped = {} as Pick<A, K>;

  for (const key of keys) {
    (mapped as Record<string, unknown>)[key as string] = (...args: unknown[]) =>
      (store[key] as (...args: unknown[]) => unknown)(...args);
  }

  return mapped;
};

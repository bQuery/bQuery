/**
 * Shared environment detection helpers.
 *
 * @internal
 */

type BQueryEnvGlobal = typeof globalThis & {
  __BQUERY_DEV__?: boolean;
  process?: {
    env?: {
      NODE_ENV?: string;
    };
    release?: {
      name?: string;
    };
    versions?: {
      node?: string;
    };
  };
};

/**
 * Returns whether development-only diagnostics should be enabled.
 *
 * Priority:
 * 1. Explicit global override via `globalThis.__BQUERY_DEV__`
 * 2. `process.env.NODE_ENV`
 * 3. Actual Node-like runtimes without `NODE_ENV` default to development
 * 4. Production-safe fallback (`false`)
 *
 * @internal
 */
export const detectDevEnvironment = (): boolean => {
  try {
    const globalObject = globalThis as BQueryEnvGlobal;

    if (typeof globalObject.__BQUERY_DEV__ === 'boolean') {
      return globalObject.__BQUERY_DEV__;
    }

    const nodeEnv = globalObject.process?.env?.NODE_ENV;
    if (typeof nodeEnv === 'string') {
      return nodeEnv !== 'production';
    }

    const nodeVersion = globalObject.process?.versions?.node;
    if (typeof nodeVersion === 'string' && nodeVersion.length > 0) {
      return true;
    }

    const releaseName = globalObject.process?.release?.name;
    if (releaseName === 'node' || releaseName === 'io.js') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

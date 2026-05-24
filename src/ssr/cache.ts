/**
 * Small in-memory SSR response cache.
 *
 * @module bquery/ssr
 */

export interface SSRCacheEntry {
  body: string;
  createdAt: number;
  headers: Array<[string, string]>;
  status: number;
}

export interface SSRCacheRequest {
  headers: Headers;
  url: URL;
  vary?: string[];
}

export interface SSRCacheOptions {
  /** Maximum number of cached entries. Default: 100. */
  maxEntries?: number;
  /** Maximum age in milliseconds. Default: 60_000. */
  ttlMs?: number;
  /** Custom cache-key builder. */
  getKey?: (request: SSRCacheRequest) => string;
}

export interface SSRCache {
  clear(): void;
  delete(key: string): void;
  get(key: string): SSRCacheEntry | null;
  getKey(request: SSRCacheRequest): string;
  set(key: string, entry: SSRCacheEntry): void;
}

const defaultCacheKey = ({ headers, url, vary = [] }: SSRCacheRequest): string => {
  const parts = [`${url.origin}${url.pathname}${url.search}`];
  for (const name of vary) {
    parts.push(`${name.toLowerCase()}:${headers.get(name) ?? ''}`);
  }
  return parts.join('|');
};

export const createSSRCache = (options: SSRCacheOptions = {}): SSRCache => {
  const maxEntries = options.maxEntries ?? 100;
  const ttlMs = options.ttlMs ?? 60_000;
  const entries = new Map<string, SSRCacheEntry>();

  const prune = (): void => {
    const now = Date.now();
    for (const [key, value] of entries) {
      if (now - value.createdAt > ttlMs) {
        entries.delete(key);
      }
    }

    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      entries.delete(oldest);
    }
  };

  return {
    clear() {
      entries.clear();
    },
    delete(key) {
      entries.delete(key);
    },
    get(key) {
      prune();
      const value = entries.get(key);
      if (!value) {
        return null;
      }
      entries.delete(key);
      entries.set(key, value);
      return {
        ...value,
        headers: [...value.headers],
      };
    },
    getKey(request) {
      return (options.getKey ?? defaultCacheKey)(request);
    },
    set(key, entry) {
      entries.delete(key);
      entries.set(key, {
        ...entry,
        headers: [...entry.headers],
      });
      prune();
    },
  };
};

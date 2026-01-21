/**
 * Cache Storage API wrapper.
 * Provides a simplified interface for caching responses and assets.
 */

/**
 * Cache handle interface for managing cached resources.
 */
export interface CacheHandle {
  /**
   * Add a resource to the cache by URL.
   * Fetches the resource and stores the response.
   * @param url - URL to fetch and cache
   */
  add(url: string): Promise<void>;

  /**
   * Add multiple resources to the cache.
   * @param urls - Array of URLs to fetch and cache
   */
  addAll(urls: string[]): Promise<void>;

  /**
   * Store a custom response in the cache.
   * @param url - URL key for the cached response
   * @param response - Response object to cache
   */
  put(url: string, response: Response): Promise<void>;

  /**
   * Retrieve a cached response.
   * @param url - URL to look up
   * @returns Cached Response or undefined if not found
   */
  match(url: string): Promise<Response | undefined>;

  /**
   * Remove a cached response.
   * @param url - URL to remove from cache
   * @returns True if the entry was deleted
   */
  remove(url: string): Promise<boolean>;

  /**
   * Get all cached request URLs.
   * @returns Array of cached URLs
   */
  keys(): Promise<string[]>;
}

/**
 * Internal cache handle implementation.
 */
class CacheHandleImpl implements CacheHandle {
  constructor(private readonly cache: Cache) {}

  async add(url: string): Promise<void> {
    await this.cache.add(url);
  }

  async addAll(urls: string[]): Promise<void> {
    await this.cache.addAll(urls);
  }

  async put(url: string, response: Response): Promise<void> {
    await this.cache.put(url, response);
  }

  async match(url: string): Promise<Response | undefined> {
    return this.cache.match(url);
  }

  async remove(url: string): Promise<boolean> {
    return this.cache.delete(url);
  }

  async keys(): Promise<string[]> {
    const requests = await this.cache.keys();
    return requests.map((req) => req.url);
  }
}

/**
 * Cache manager for accessing the Cache Storage API.
 */
export const cache = {
  /**
   * Check if Cache Storage API is supported.
   * @returns True if caches API is available
   */
  isSupported(): boolean {
    return 'caches' in window;
  },

  /**
   * Open or create a named cache.
   * @param name - Cache name
   * @returns CacheHandle for cache operations
   */
  async open(name: string): Promise<CacheHandle> {
    if (!this.isSupported()) {
      throw new Error('bQuery: Cache Storage API not supported');
    }
    const c = await caches.open(name);
    return new CacheHandleImpl(c);
  },

  /**
   * Delete a named cache.
   * @param name - Cache name to delete
   * @returns True if the cache was deleted
   */
  async delete(name: string): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }
    return caches.delete(name);
  },

  /**
   * List all cache names.
   * @returns Array of cache names
   */
  async keys(): Promise<string[]> {
    if (!this.isSupported()) {
      return [];
    }
    return caches.keys();
  },
};

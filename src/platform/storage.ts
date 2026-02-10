/**
 * Unified storage adapters for web platform storage APIs.
 * Provides a consistent, promise-based interface with predictable errors.
 */

/**
 * Common interface for all storage adapters.
 * All methods return promises for a unified async API.
 */
export interface StorageAdapter {
  /**
   * Retrieve a value by key.
   * @param key - The storage key
   * @returns The stored value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value by key.
   * @param key - The storage key
   * @param value - The value to store
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Remove a value by key.
   * @param key - The storage key
   */
  remove(key: string): Promise<void>;

  /**
   * Clear all stored values.
   */
  clear(): Promise<void>;

  /**
   * Get all storage keys.
   * @returns Array of all keys
   */
  keys(): Promise<string[]>;
}

/**
 * Abstract base class for web storage adapters (localStorage/sessionStorage).
 * Implements DRY principle by sharing common logic.
 */
abstract class WebStorageAdapter implements StorageAdapter {
  constructor(protected readonly storage: Storage) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = this.storage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    this.storage.setItem(key, serialized);
  }

  async remove(key: string): Promise<void> {
    this.storage.removeItem(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async keys(): Promise<string[]> {
    const result: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key !== null) {
        result.push(key);
      }
    }
    return result;
  }
}

/**
 * localStorage adapter with async interface.
 */
class LocalStorageAdapter extends WebStorageAdapter {
  constructor() {
    super(localStorage);
  }
}

/**
 * sessionStorage adapter with async interface.
 */
class SessionStorageAdapter extends WebStorageAdapter {
  constructor() {
    super(sessionStorage);
  }
}

/**
 * IndexedDB configuration options.
 */
export interface IndexedDBOptions {
  /** Database name */
  name: string;
  /** Object store name */
  store: string;
  /** Database version (optional) */
  version?: number;
}

/**
 * IndexedDB key-value adapter.
 * Wraps IndexedDB with a simple key-value interface.
 */
class IndexedDBAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly options: IndexedDBOptions) {}

  /**
   * Opens or creates the IndexedDB database.
   */
  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.options.name, this.options.version ?? 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.options.store)) {
          db.createObjectStore(this.options.store);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Executes a transaction on the object store.
   */
  private async withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.options.store, mode);
      const store = tx.objectStore(this.options.store);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const result = await this.withStore<T | undefined>('readonly', (store) => store.get(key));
    return result ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.withStore('readwrite', (store) => store.put(value, key));
  }

  async remove(key: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(key));
  }

  async clear(): Promise<void> {
    await this.withStore('readwrite', (store) => store.clear());
  }

  async keys(): Promise<string[]> {
    const result = await this.withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    return result.map((key) => String(key));
  }
}

/**
 * Storage factory providing access to different storage adapters.
 */
export const storage = {
  /**
   * Create a localStorage adapter.
   * @returns StorageAdapter wrapping localStorage
   */
  local(): StorageAdapter {
    return new LocalStorageAdapter();
  },

  /**
   * Create a sessionStorage adapter.
   * @returns StorageAdapter wrapping sessionStorage
   */
  session(): StorageAdapter {
    return new SessionStorageAdapter();
  },

  /**
   * Create an IndexedDB adapter with key-value interface.
   * @param options - Database and store configuration
   * @returns StorageAdapter wrapping IndexedDB
   */
  indexedDB(options: IndexedDBOptions): StorageAdapter {
    return new IndexedDBAdapter(options);
  },
};

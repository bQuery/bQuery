/**
 * Storage Buckets API wrapper.
 * Provides a simplified interface for storing blobs and binary data.
 * Falls back to IndexedDB when Storage Buckets API is not available.
 */

/**
 * Bucket interface for blob storage operations.
 */
export interface Bucket {
  /**
   * Store a blob in the bucket.
   * @param key - Unique identifier for the blob
   * @param data - Blob data to store
   */
  put(key: string, data: Blob): Promise<void>;

  /**
   * Retrieve a blob from the bucket.
   * @param key - Blob identifier
   * @returns The stored blob or null if not found
   */
  get(key: string): Promise<Blob | null>;

  /**
   * Remove a blob from the bucket.
   * @param key - Blob identifier
   */
  remove(key: string): Promise<void>;

  /**
   * List all keys in the bucket.
   * @returns Array of blob keys
   */
  keys(): Promise<string[]>;
}

/**
 * IndexedDB-based bucket implementation.
 * Used as fallback when Storage Buckets API is unavailable.
 */
class IndexedDBBucket implements Bucket {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly storeName = 'blobs';

  constructor(private readonly bucketName: string) {}

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    const dbName = `bquery-bucket-${this.bucketName}`;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  private async withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(key: string, data: Blob): Promise<void> {
    await this.withStore('readwrite', (store) => store.put(data, key));
  }

  async get(key: string): Promise<Blob | null> {
    const result = await this.withStore<Blob | undefined>('readonly', (store) => store.get(key));
    return result ?? null;
  }

  async remove(key: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(key));
  }

  async keys(): Promise<string[]> {
    const result = await this.withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    return result.map((key) => String(key));
  }
}

/**
 * Bucket manager for creating and accessing storage buckets.
 */
export const buckets = {
  /**
   * Open or create a storage bucket.
   * @param name - Bucket name
   * @returns Bucket instance for blob operations
   */
  async open(name: string): Promise<Bucket> {
    // Storage Buckets API is experimental; use IndexedDB fallback
    return new IndexedDBBucket(name);
  },
};

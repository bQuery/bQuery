/**
 * Devtools integration for stores.
 * @internal
 */

declare global {
  interface Window {
    __BQUERY_DEVTOOLS__?: {
      stores: Map<string, unknown>;
      onStoreCreated?: (id: string, store: unknown) => void;
      onStateChange?: (id: string, state: unknown) => void;
    };
  }
}

export type DevtoolsHook = {
  stores: Map<string, unknown>;
  onStoreCreated?: (id: string, store: unknown) => void;
  onStateChange?: (id: string, state: unknown) => void;
};

const ensureDevtools = (): DevtoolsHook | undefined => {
  if (typeof window === 'undefined') return undefined;
  if (!window.__BQUERY_DEVTOOLS__) {
    window.__BQUERY_DEVTOOLS__ = { stores: new Map() };
  }
  return window.__BQUERY_DEVTOOLS__;
};

export const registerDevtoolsStore = (id: string, store: unknown): void => {
  const devtools = ensureDevtools();
  if (!devtools) return;
  devtools.stores.set(id, store);
  devtools.onStoreCreated?.(id, store);
};

export const unregisterDevtoolsStore = (id: string): void => {
  if (typeof window === 'undefined' || !window.__BQUERY_DEVTOOLS__) return;
  window.__BQUERY_DEVTOOLS__.stores.delete(id);
};

export const notifyDevtoolsStateChange = (id: string, state: unknown): void => {
  if (typeof window === 'undefined') return;
  window.__BQUERY_DEVTOOLS__?.onStateChange?.(id, state);
};

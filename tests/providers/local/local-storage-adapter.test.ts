import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Tenant } from 'strata-data-sync';
import { LocalStorageAdapter } from '@strata-adapters/providers/local/local-storage-adapter';
import { QuotaExceededError } from '@strata-adapters/errors/strata-error';

// Minimal localStorage polyfill for Node
function createLocalStoragePolyfill(): Storage {
  const store = new Map<string, string>();
  return {
    getItem(key: string) { return store.get(key) ?? null; },
    setItem(key: string, value: string) { store.set(key, value); },
    removeItem(key: string) { store.delete(key); },
    key(index: number) { return [...store.keys()][index] ?? null; },
    get length() { return store.size; },
    clear() { store.clear(); },
  } as Storage;
}

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let originalLS: Storage;

  const tenant: Tenant = {
    id: 'tenant-1',
    name: 'Test Tenant',
    encrypted: false,
    meta: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    originalLS = globalThis.localStorage;
    (globalThis as Record<string, unknown>).localStorage = createLocalStoragePolyfill();
    adapter = new LocalStorageAdapter('test');
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).localStorage = originalLS;
  });

  it('creates with default prefix', () => {
    const defaultAdapter = new LocalStorageAdapter();
    expect(defaultAdapter).toBeDefined();
  });

  describe('read', () => {
    it('returns null for missing key', async () => {
      const result = await adapter.read(tenant, 'missing');
      expect(result).toBeNull();
    });

    it('returns data for existing key', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await adapter.write(tenant, 'myKey', data);
      const result = await adapter.read(tenant, 'myKey');
      expect(result).toEqual(data);
    });

    it('reads without tenant', async () => {
      const data = new Uint8Array([10, 20]);
      await adapter.write(undefined, 'global', data);
      const result = await adapter.read(undefined, 'global');
      expect(result).toEqual(data);
    });
  });

  describe('write', () => {
    it('stores data with tenant-scoped key', async () => {
      const data = new Uint8Array([65, 66, 67]);
      await adapter.write(tenant, 'file.json', data);
      const result = await adapter.read(tenant, 'file.json');
      expect(result).toEqual(data);
    });

    it('overwrites existing data', async () => {
      await adapter.write(tenant, 'k', new Uint8Array([1]));
      await adapter.write(tenant, 'k', new Uint8Array([2]));
      const result = await adapter.read(tenant, 'k');
      expect(result).toEqual(new Uint8Array([2]));
    });

    it('throws QuotaExceededError on quota errors', async () => {
      const orig = globalThis.localStorage.setItem;
      globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
      try {
        await expect(adapter.write(tenant, 'k', new Uint8Array([1])))
          .rejects.toThrow(QuotaExceededError);
      } finally {
        globalThis.localStorage.setItem = orig;
      }
    });

    it('wraps non-Error thrown values', async () => {
      const orig = globalThis.localStorage.setItem;
      globalThis.localStorage.setItem = () => { throw 'string error'; };
      try {
        await expect(adapter.write(tenant, 'k', new Uint8Array([1])))
          .rejects.toThrow('localStorage write failed for key "k": string error');
      } finally {
        globalThis.localStorage.setItem = orig;
      }
    });
  });

  it('throws when localStorage is unavailable', () => {
    const orig = globalThis.localStorage;
    delete (globalThis as any).localStorage;
    try {
      expect(() => new LocalStorageAdapter()).toThrow('requires a browser environment');
    } finally {
      (globalThis as any).localStorage = orig;
    }
  });

  describe('delete', () => {
    it('returns true when key existed', async () => {
      await adapter.write(tenant, 'k', new Uint8Array([1]));
      const result = await adapter.delete(tenant, 'k');
      expect(result).toBe(true);
    });

    it('returns false when key did not exist', async () => {
      const result = await adapter.delete(tenant, 'nope');
      expect(result).toBe(false);
    });

    it('removes data so read returns null', async () => {
      await adapter.write(tenant, 'k', new Uint8Array([1]));
      await adapter.delete(tenant, 'k');
      const result = await adapter.read(tenant, 'k');
      expect(result).toBeNull();
    });
  });
});

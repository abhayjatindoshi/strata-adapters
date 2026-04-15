import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOrCreateDeviceId } from '@strata-adapters/services/device-id';

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

describe('getOrCreateDeviceId', () => {
  let originalLS: Storage;

  beforeEach(() => {
    originalLS = globalThis.localStorage;
    (globalThis as Record<string, unknown>).localStorage = createLocalStoragePolyfill();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).localStorage = originalLS;
  });

  it('generates a UUID', () => {
    const id = getOrCreateDeviceId('test_device_id');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns the same ID on subsequent calls', () => {
    const id1 = getOrCreateDeviceId('test_device_id');
    const id2 = getOrCreateDeviceId('test_device_id');
    expect(id1).toBe(id2);
  });

  it('generates different IDs for different keys', () => {
    const id1 = getOrCreateDeviceId('device_a');
    const id2 = getOrCreateDeviceId('device_b');
    expect(id1).not.toBe(id2);
  });

  it('persists ID in localStorage', () => {
    const id = getOrCreateDeviceId('test_device_id');
    const stored = globalThis.localStorage.getItem('test_device_id');
    expect(stored).toBe(id);
  });

  it('reads existing ID from localStorage', () => {
    globalThis.localStorage.setItem('test_device_id', 'existing-device-id');
    const id = getOrCreateDeviceId('test_device_id');
    expect(id).toBe('existing-device-id');
  });
});

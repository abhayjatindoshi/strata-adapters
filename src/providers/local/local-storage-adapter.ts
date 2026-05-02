import type { StorageAdapter, Tenant } from '@strata/core';
import { compositeKey, toBase64, fromBase64 } from '@strata/core';
import { QuotaExceededError } from '@/errors/strata-error';
import { log } from '@/log';

export class LocalStorageAdapter implements StorageAdapter {

  constructor(private readonly prefix: string = 'strata') {
    if (typeof globalThis.localStorage === 'undefined') {
      throw new Error('LocalStorageAdapter requires a browser environment with localStorage');
    }
  }

  private prefixedKey(compositeKey: string): string {
    return `${this.prefix}:${compositeKey}`;
  }

  read(tenant: Tenant | undefined, key: string): Promise<Uint8Array | null> {
    const stored = globalThis.localStorage.getItem(
      this.prefixedKey(compositeKey(tenant, key)),
    );
    if (stored === null) return Promise.resolve(null);
    log.storage.local('read %s', compositeKey(tenant, key));
    return Promise.resolve(fromBase64(stored));
  }

  write(tenant: Tenant | undefined, key: string, data: Uint8Array): Promise<void> {
    try {
      globalThis.localStorage.setItem(
        this.prefixedKey(compositeKey(tenant, key)),
        toBase64(data),
      );
      log.storage.local('write %s (%d bytes)', compositeKey(tenant, key), data.length);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        throw new QuotaExceededError('write', e);
      }
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`localStorage write failed for key "${key}": ${message}`, { cause: e });
    }
    return Promise.resolve();
  }

  delete(tenant: Tenant | undefined, key: string): Promise<boolean> {
    const pk = this.prefixedKey(compositeKey(tenant, key));
    const existed = globalThis.localStorage.getItem(pk) !== null;
    globalThis.localStorage.removeItem(pk);
    if (existed) log.storage.local('deleted %s', pk);
    return Promise.resolve(existed);
  }
}

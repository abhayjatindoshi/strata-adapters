import type { StorageAdapter, Tenant } from '@strata/core';
import { StrataError } from '@strata/core';
import { RateLimitedError } from '../errors/strata-error';
import { log } from '@/log';

export type RetryOptions = {
  readonly maxRetries?: number;
  readonly delayMs?: number;
  readonly onRetry?: (attempt: number, error: Error) => void;
};

async function withRetries<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const delayMs = options.delayMs ?? 1000;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(2, attempt) * (0.5 + Math.random());
        log.transform('retry attempt %d/%d (delay=%dms): %s', attempt + 1, maxRetries, Math.round(delay), lastError.message);
        options.onRetry?.(attempt + 1, lastError);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  log.transform.error('giving up after %d attempts', maxRetries + 1);
  throw lastError ?? new Error('retry failed');
}

export function withRetry(adapter: StorageAdapter, options: RetryOptions = {}): StorageAdapter {
  return {
    ...adapter,
    async read(tenant: Tenant | undefined, key: string): Promise<Uint8Array | null> {
      return withRetries(() => adapter.read(tenant, key), options);
    },
    async write(tenant: Tenant | undefined, key: string, data: Uint8Array): Promise<void> {
      return withRetries(() => adapter.write(tenant, key, data), options);
    },
    async delete(tenant: Tenant | undefined, key: string): Promise<boolean> {
      return withRetries(() => adapter.delete(tenant, key), options);
    },
  };
}

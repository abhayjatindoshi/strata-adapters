import type { StorageAdapter, Tenant } from 'strata-data-sync';
import { StrataError } from '@strata-adapters/errors/strata-error';
import type { ErrorBus } from '@strata-adapters/errors/error-bus';

export function withErrorBroadcast(adapter: StorageAdapter, bus: ErrorBus): StorageAdapter {
  function intercept<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof StrataError) {
        bus.emit(err);
      }
      throw err;
    });
  }

  return {
    async read(tenant: Tenant | undefined, key: string): Promise<Uint8Array | null> {
      return intercept(() => adapter.read(tenant, key));
    },
    async write(tenant: Tenant | undefined, key: string, data: Uint8Array): Promise<void> {
      return intercept(() => adapter.write(tenant, key, data));
    },
    async delete(tenant: Tenant | undefined, key: string): Promise<boolean> {
      return intercept(() => adapter.delete(tenant, key));
    },
    ...(adapter.deriveTenantId ? { deriveTenantId: (meta: Record<string, unknown>) => adapter.deriveTenantId!(meta) } : {}),
  };
}

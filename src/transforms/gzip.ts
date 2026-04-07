import type { StorageAdapter, Tenant } from 'strata-data-sync';
import { toArrayBuffer, streamToUint8Array } from 'strata-data-sync';

export function withGzip(adapter: StorageAdapter): StorageAdapter {
  return {
    async read(tenant: Tenant | undefined, key: string): Promise<Uint8Array | null> {
      const data = await adapter.read(tenant, key);
      if (!data) return null;
      const stream = new Blob([toArrayBuffer(data)])
        .stream()
        .pipeThrough(new DecompressionStream('gzip'));
      return streamToUint8Array(stream);
    },
    async write(tenant: Tenant | undefined, key: string, data: Uint8Array): Promise<void> {
      const stream = new Blob([toArrayBuffer(data)])
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
      const compressed = await streamToUint8Array(stream);
      return adapter.write(tenant, key, compressed);
    },
    delete: (t, k) => adapter.delete(t, k),
  };
}

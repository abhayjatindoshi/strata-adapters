import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryStorageAdapter } from 'strata-data-sync';
import { withErrorBroadcast } from '@strata-adapters/transforms/error-broadcast';
import { ErrorBus } from '@strata-adapters/errors/error-bus';
import { StrataError, AuthExpiredError } from '@strata-adapters/errors/strata-error';
import type { StorageAdapter } from 'strata-data-sync';

describe('withErrorBroadcast', () => {
  let bus: ErrorBus;

  beforeEach(() => {
    bus = new ErrorBus();
  });

  it('passes through successful read', async () => {
    const inner = new MemoryStorageAdapter();
    await inner.write(undefined, 'k', new Uint8Array([1]));
    const adapter = withErrorBroadcast(inner, bus);

    const result = await adapter.read(undefined, 'k');
    expect(result).toEqual(new Uint8Array([1]));
  });

  it('passes through successful write', async () => {
    const inner = new MemoryStorageAdapter();
    const adapter = withErrorBroadcast(inner, bus);
    await adapter.write(undefined, 'k', new Uint8Array([2]));

    const result = await inner.read(undefined, 'k');
    expect(result).toEqual(new Uint8Array([2]));
  });

  it('passes through successful delete', async () => {
    const inner = new MemoryStorageAdapter();
    await inner.write(undefined, 'k', new Uint8Array([1]));
    const adapter = withErrorBroadcast(inner, bus);

    expect(await adapter.delete(undefined, 'k')).toBe(true);
  });

  it('emits StrataError on read failure and re-throws', async () => {
    const error = new AuthExpiredError('read');
    const inner: StorageAdapter = {
      read: () => Promise.reject(error),
      write: () => Promise.resolve(),
      delete: () => Promise.resolve(false),
    };
    const adapter = withErrorBroadcast(inner, bus);
    const received: StrataError[] = [];
    bus.errors$.subscribe((e) => received.push(e));

    await expect(adapter.read(undefined, 'k')).rejects.toThrow(error);
    expect(received).toEqual([error]);
  });

  it('emits StrataError on write failure and re-throws', async () => {
    const error = new AuthExpiredError('write');
    const inner: StorageAdapter = {
      read: () => Promise.resolve(null),
      write: () => Promise.reject(error),
      delete: () => Promise.resolve(false),
    };
    const adapter = withErrorBroadcast(inner, bus);
    const received: StrataError[] = [];
    bus.errors$.subscribe((e) => received.push(e));

    await expect(adapter.write(undefined, 'k', new Uint8Array([1]))).rejects.toThrow(error);
    expect(received).toEqual([error]);
  });

  it('emits StrataError on delete failure and re-throws', async () => {
    const error = new AuthExpiredError('delete');
    const inner: StorageAdapter = {
      read: () => Promise.resolve(null),
      write: () => Promise.resolve(),
      delete: () => Promise.reject(error),
    };
    const adapter = withErrorBroadcast(inner, bus);
    const received: StrataError[] = [];
    bus.errors$.subscribe((e) => received.push(e));

    await expect(adapter.delete(undefined, 'k')).rejects.toThrow(error);
    expect(received).toEqual([error]);
  });

  it('does not emit non-StrataError errors', async () => {
    const error = new Error('plain error');
    const inner: StorageAdapter = {
      read: () => Promise.reject(error),
      write: () => Promise.resolve(),
      delete: () => Promise.resolve(false),
    };
    const adapter = withErrorBroadcast(inner, bus);
    const received: StrataError[] = [];
    bus.errors$.subscribe((e) => received.push(e));

    await expect(adapter.read(undefined, 'k')).rejects.toThrow(error);
    expect(received).toHaveLength(0);
  });

  it('preserves deriveTenantId when present', () => {
    const inner: StorageAdapter = {
      read: () => Promise.resolve(null),
      write: () => Promise.resolve(),
      delete: () => Promise.resolve(false),
      deriveTenantId: (meta) => meta.id as string,
    };
    const adapter = withErrorBroadcast(inner, bus);
    expect(adapter.deriveTenantId).toBeDefined();
    expect(adapter.deriveTenantId!({ id: 'test' })).toBe('test');
  });

  it('does not add deriveTenantId when absent', () => {
    const inner = new MemoryStorageAdapter();
    const adapter = withErrorBroadcast(inner, bus);
    expect(adapter.deriveTenantId).toBeUndefined();
  });
});

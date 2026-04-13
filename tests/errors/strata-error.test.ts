import { describe, it, expect } from 'vitest';
import {
  StrataError,
  AuthExpiredError,
  QuotaExceededError,
  NotFoundError,
  PermissionDeniedError,
  OfflineError,
  RateLimitedError,
  DataCorruptedError,
} from '@strata-adapters/errors/strata-error';

describe('StrataError hierarchy', () => {
  it('StrataError has correct properties', () => {
    const original = new Error('raw');
    const err = new StrataError('something broke', {
      kind: 'unknown',
      operation: 'read',
      retryable: false,
      originalError: original,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StrataError);
    expect(err.name).toBe('StrataError');
    expect(err.kind).toBe('unknown');
    expect(err.operation).toBe('read');
    expect(err.retryable).toBe(false);
    expect(err.originalError).toBe(original);
    expect(err.message).toBe('something broke');
  });

  it('StrataError defaults retryable to false', () => {
    const err = new StrataError('msg', { kind: 'unknown', operation: 'write' });
    expect(err.retryable).toBe(false);
  });

  it('AuthExpiredError', () => {
    const err = new AuthExpiredError('read');
    expect(err).toBeInstanceOf(StrataError);
    expect(err).toBeInstanceOf(AuthExpiredError);
    expect(err.name).toBe('AuthExpiredError');
    expect(err.kind).toBe('auth-expired');
    expect(err.retryable).toBe(false);
  });

  it('QuotaExceededError', () => {
    const err = new QuotaExceededError('write');
    expect(err).toBeInstanceOf(StrataError);
    expect(err.kind).toBe('quota-exceeded');
    expect(err.retryable).toBe(false);
  });

  it('NotFoundError', () => {
    const err = new NotFoundError('read');
    expect(err).toBeInstanceOf(StrataError);
    expect(err.kind).toBe('not-found');
    expect(err.retryable).toBe(false);
  });

  it('PermissionDeniedError', () => {
    const err = new PermissionDeniedError('write');
    expect(err).toBeInstanceOf(StrataError);
    expect(err.kind).toBe('permission-denied');
    expect(err.retryable).toBe(false);
  });

  it('OfflineError', () => {
    const err = new OfflineError('sync');
    expect(err).toBeInstanceOf(StrataError);
    expect(err.kind).toBe('offline');
    expect(err.retryable).toBe(true);
  });

  it('RateLimitedError', () => {
    const err = new RateLimitedError('read', 5000);
    expect(err).toBeInstanceOf(StrataError);
    expect(err.kind).toBe('rate-limited');
    expect(err.retryable).toBe(true);
    expect(err.retryAfterMs).toBe(5000);
  });

  it('RateLimitedError without retryAfterMs', () => {
    const err = new RateLimitedError('write');
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('DataCorruptedError', () => {
    const err = new DataCorruptedError('read');
    expect(err).toBeInstanceOf(StrataError);
    expect(err.kind).toBe('data-corrupted');
    expect(err.retryable).toBe(false);
  });

  it('all subclasses preserve originalError', () => {
    const original = new Error('root cause');
    const errors = [
      new AuthExpiredError('read', original),
      new QuotaExceededError('write', original),
      new NotFoundError('read', original),
      new PermissionDeniedError('delete', original),
      new OfflineError('sync', original),
      new RateLimitedError('read', undefined, original),
      new DataCorruptedError('read', original),
    ];
    for (const err of errors) {
      expect(err.originalError).toBe(original);
    }
  });

  it('can be caught by kind in a switch', () => {
    const err: StrataError = new AuthExpiredError('read');
    let matched = false;
    switch (err.kind) {
      case 'auth-expired':
        matched = true;
        break;
    }
    expect(matched).toBe(true);
  });

  it('can be caught by instanceof', () => {
    const err: Error = new RateLimitedError('read', 1000);
    expect(err instanceof StrataError).toBe(true);
    expect(err instanceof RateLimitedError).toBe(true);
    expect(err instanceof AuthExpiredError).toBe(false);
  });
});

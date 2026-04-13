import { describe, it, expect } from 'vitest';
import { ErrorBus } from '@strata-adapters/errors/error-bus';
import { AuthExpiredError, OfflineError } from '@strata-adapters/errors/strata-error';

describe('ErrorBus', () => {
  it('emits errors to subscribers', () => {
    const bus = new ErrorBus();
    const received: unknown[] = [];
    bus.errors$.subscribe((err) => received.push(err));

    const error = new AuthExpiredError('read');
    bus.emit(error);

    expect(received).toEqual([error]);
    bus.dispose();
  });

  it('supports multiple subscribers', () => {
    const bus = new ErrorBus();
    const a: unknown[] = [];
    const b: unknown[] = [];
    bus.errors$.subscribe((err) => a.push(err));
    bus.errors$.subscribe((err) => b.push(err));

    const error = new OfflineError('sync');
    bus.emit(error);

    expect(a).toEqual([error]);
    expect(b).toEqual([error]);
    bus.dispose();
  });

  it('stops emitting after dispose', () => {
    const bus = new ErrorBus();
    const received: unknown[] = [];
    bus.errors$.subscribe((err) => received.push(err));

    bus.emit(new AuthExpiredError('read'));
    bus.dispose();
    bus.emit(new OfflineError('sync')); // should not arrive

    expect(received).toHaveLength(1);
  });

  it('late subscribers do not receive past errors', () => {
    const bus = new ErrorBus();
    bus.emit(new AuthExpiredError('read'));

    const received: unknown[] = [];
    bus.errors$.subscribe((err) => received.push(err));

    expect(received).toHaveLength(0);
    bus.dispose();
  });
});

import { describe, it, expect } from 'vitest';
import { Subject } from 'rxjs';
import { createSyncStatus$ } from '@strata-adapters/services/sync-status';
import type { SyncStatus } from '@strata-adapters/services/sync-status';

describe('createSyncStatus$', () => {
  function createMockStrata() {
    const syncSubject = new Subject<{ type: string; source: string; target: string }>();
    return {
      strata: {
        observe: (channel: string) => {
          if (channel === 'sync') return syncSubject.asObservable();
          throw new Error(`Unexpected channel: ${channel}`);
        },
      } as any,
      syncSubject,
    };
  }

  it('starts with idle', async () => {
    const { strata } = createMockStrata();
    const values: SyncStatus[] = [];
    const sub = createSyncStatus$(strata).subscribe((v) => values.push(v));
    expect(values).toEqual(['idle']);
    sub.unsubscribe();
  });

  it('maps sync-started to syncing', () => {
    const { strata, syncSubject } = createMockStrata();
    const values: SyncStatus[] = [];
    const sub = createSyncStatus$(strata).subscribe((v) => values.push(v));

    syncSubject.next({ type: 'sync-started', source: 'memory', target: 'local' });
    expect(values).toEqual(['idle', 'syncing']);
    sub.unsubscribe();
  });

  it('maps sync-completed to synced', () => {
    const { strata, syncSubject } = createMockStrata();
    const values: SyncStatus[] = [];
    const sub = createSyncStatus$(strata).subscribe((v) => values.push(v));

    syncSubject.next({ type: 'sync-completed', source: 'memory', target: 'local' });
    expect(values).toEqual(['idle', 'synced']);
    sub.unsubscribe();
  });

  it('maps sync-failed to failed', () => {
    const { strata, syncSubject } = createMockStrata();
    const values: SyncStatus[] = [];
    const sub = createSyncStatus$(strata).subscribe((v) => values.push(v));

    syncSubject.next({ type: 'sync-failed', source: 'local', target: 'cloud' });
    expect(values).toEqual(['idle', 'failed']);
    sub.unsubscribe();
  });

  it('deduplicates consecutive identical values', () => {
    const { strata, syncSubject } = createMockStrata();
    const values: SyncStatus[] = [];
    const sub = createSyncStatus$(strata).subscribe((v) => values.push(v));

    syncSubject.next({ type: 'sync-started', source: 'memory', target: 'local' });
    syncSubject.next({ type: 'sync-started', source: 'local', target: 'cloud' });
    expect(values).toEqual(['idle', 'syncing']); // second 'syncing' deduplicated
    sub.unsubscribe();
  });

  it('tracks transitions', () => {
    const { strata, syncSubject } = createMockStrata();
    const values: SyncStatus[] = [];
    const sub = createSyncStatus$(strata).subscribe((v) => values.push(v));

    syncSubject.next({ type: 'sync-started', source: 'memory', target: 'local' });
    syncSubject.next({ type: 'sync-completed', source: 'memory', target: 'local' });
    syncSubject.next({ type: 'sync-started', source: 'local', target: 'cloud' });
    syncSubject.next({ type: 'sync-failed', source: 'local', target: 'cloud' });

    expect(values).toEqual(['idle', 'syncing', 'synced', 'syncing', 'failed']);
    sub.unsubscribe();
  });
});

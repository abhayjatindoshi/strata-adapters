import { Observable, map, startWith, distinctUntilChanged } from 'rxjs';
import type { Strata } from 'strata-data-sync';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'failed' | 'offline';

export function createSyncStatus$(strata: Strata): Observable<SyncStatus> {
  return strata.observe('sync').pipe(
    map((event): SyncStatus => {
      switch (event.type) {
        case 'sync-started':
          return 'syncing';
        case 'sync-completed':
          return 'synced';
        case 'sync-failed':
          return 'failed';
        default:
          return 'idle';
      }
    }),
    startWith('idle' as SyncStatus),
    distinctUntilChanged(),
  );
}

export function createDirtyState$(strata: Strata): Observable<boolean> {
  return strata.observe('dirty');
}

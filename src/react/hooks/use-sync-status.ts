import { useMemo } from 'react';
import { createSyncStatus$, createDirtyState$, type SyncStatus } from '@strata-adapters/services/sync-status';
import { useStrata } from './use-strata';
import { useObservable } from './use-observable';

export function useSyncStatus(): SyncStatus {
  const { strata } = useStrata();
  const syncStatus$ = useMemo(
    () => (strata ? createSyncStatus$(strata) : undefined),
    [strata],
  );
  return useObservable(syncStatus$, 'idle');
}

export function useDirtyState(): boolean {
  const { strata } = useStrata();
  const dirty$ = useMemo(
    () => (strata ? createDirtyState$(strata) : undefined),
    [strata],
  );
  return useObservable(dirty$, false);
}

import { useMemo } from 'react';
import type { EntityDefinition, BaseEntity, Repository } from 'strata-data-sync';
import type { Observable } from 'rxjs';
import { useStrata } from './use-strata';
import { useObservable } from './use-observable';

export function useRepo<T>(def: EntityDefinition<T>) {
  const { strata } = useStrata();
  return useMemo(() => {
    if (!strata) return null;
    return strata.repo(def);
  }, [strata, def]);
}

export function useEntity<T>(
  def: EntityDefinition<T>,
  id: string,
): (T & BaseEntity) | undefined {
  const repo = useRepo(def);
  const observable = useMemo(
    () => (repo ? repo.observe(id) as Observable<(T & BaseEntity) | undefined> : undefined),
    [repo, id],
  );
  return useObservable(observable, repo?.get(id) as (T & BaseEntity) | undefined);
}

function isCollectionRepo<T>(repo: unknown): repo is Repository<T> {
  return repo !== null && typeof repo === 'object' && 'observeQuery' in (repo as object);
}

export function useQuery<T>(
  def: EntityDefinition<T>,
  opts?: { readonly where?: Partial<T> },
): ReadonlyArray<T & BaseEntity> {
  const repo = useRepo(def);
  const collectionRepo = isCollectionRepo<T>(repo) ? repo : null;
  const observable = useMemo(
    () => (collectionRepo ? collectionRepo.observeQuery(opts) as Observable<ReadonlyArray<T & BaseEntity>> : undefined),
    [collectionRepo, opts],
  );
  return useObservable(observable, collectionRepo?.query(opts) as ReadonlyArray<T & BaseEntity> ?? []);
}

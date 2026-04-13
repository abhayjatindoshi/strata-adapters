import { useContext, useState, useEffect, useCallback } from 'react';
import type { Tenant } from 'strata-data-sync';
import { TenantContext, type TenantContextValue } from '../context';
import { useStrata } from './use-strata';

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}

export function useTenantList(): {
  readonly tenants: ReadonlyArray<Tenant>;
  readonly loading: boolean;
  readonly refresh: () => void;
} {
  const { strata } = useStrata();
  const [tenants, setTenants] = useState<ReadonlyArray<Tenant>>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!strata) return;
    setLoading(true);
    strata.tenants.list().then((list) => {
      setTenants(list);
      setLoading(false);
    });
  }, [strata]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tenants, loading, refresh };
}

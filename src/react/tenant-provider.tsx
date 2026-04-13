import { useState, useEffect, useRef, type ReactNode } from 'react';
import type { Tenant } from 'strata-data-sync';
import { TenantContext } from './context';
import { useStrata } from './hooks/use-strata';

export type TenantProviderProps = {
  readonly tenantId: string | undefined;
  readonly children: ReactNode;
};

export function TenantProvider({ tenantId, children }: TenantProviderProps) {
  const { strata } = useStrata();
  const [tenant, setTenant] = useState<Tenant | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const currentTenantId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!strata || !tenantId) {
      if (currentTenantId.current) {
        strata?.tenants.close();
        currentTenantId.current = undefined;
        setTenant(undefined);
      }
      return;
    }

    if (tenantId === currentTenantId.current) return;

    let cancelled = false;

    const loadTenant = async () => {
      setLoading(true);
      setError(null);

      try {
        if (currentTenantId.current) {
          await strata.tenants.close();
        }
        await strata.tenants.open(tenantId);
        if (!cancelled) {
          currentTenantId.current = tenantId;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          currentTenantId.current = undefined;
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTenant();

    return () => {
      cancelled = true;
    };
  }, [strata, tenantId]);

  useEffect(() => {
    if (!strata) return;
    const sub = strata.tenants.activeTenant$.subscribe(setTenant);
    return () => sub.unsubscribe();
  }, [strata]);

  return (
    <TenantContext.Provider value={{ tenant, loading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

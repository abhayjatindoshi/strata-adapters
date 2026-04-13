import { type ReactNode } from 'react';
import { useTenant } from '../hooks/use-tenant';

export type RequireTenantProps = {
  readonly children: ReactNode;
  readonly loading?: ReactNode;
  readonly fallback?: ReactNode;
};

export function RequireTenant({ children, loading, fallback }: RequireTenantProps) {
  const { tenant, loading: tenantLoading } = useTenant();

  if (tenantLoading) return <>{loading ?? null}</>;
  if (!tenant) return <>{fallback ?? null}</>;
  return <>{children}</>;
}

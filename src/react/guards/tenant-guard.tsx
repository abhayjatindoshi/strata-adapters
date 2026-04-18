import { type ReactNode } from 'react';
import { Navigate, Outlet, useParams } from 'react-router';
import { TenantProvider } from '../tenant-provider';
import { useTenant } from '../hooks/use-tenant';

export type TenantGuardProps = {
  readonly paramId: string;
  readonly redirect: string;
  readonly loading?: ReactNode;
};

export function TenantGuard({ paramId, redirect, loading = null }: TenantGuardProps) {
  const params = useParams();
  const tenantId = params[paramId];

  return (
    <TenantProvider tenantId={tenantId}>
      <TenantGate redirect={redirect} loading={loading} />
    </TenantProvider>
  );
}

function TenantGate({ redirect, loading }: { redirect: string; loading: ReactNode }) {
  const { tenant, loading: tenantLoading, error } = useTenant();

  if (tenantLoading || (!tenant && !error)) return <>{loading}</>;
  if (!tenant) return <Navigate to={redirect} replace />;
  return <Outlet />;
}

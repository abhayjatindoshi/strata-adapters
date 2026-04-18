import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useStrata } from '../hooks/use-strata';

export type AuthGuardProps = {
  readonly redirect: string;
  readonly loading?: ReactNode;
  readonly returnUrlKey?: string;
};

export function AuthGuard({ redirect, loading = null, returnUrlKey }: AuthGuardProps) {
  const { authState } = useStrata();
  const location = useLocation();

  useEffect(() => {
    if (authState.status === 'unauthenticated' && returnUrlKey) {
      sessionStorage.setItem(returnUrlKey, location.pathname + location.search);
    }
  }, [authState.status, location, returnUrlKey]);

  if (authState.status === 'loading') return <>{loading}</>;
  if (authState.status === 'unauthenticated') return <Navigate to={redirect} replace />;
  return <Outlet />;
}

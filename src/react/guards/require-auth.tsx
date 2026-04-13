import { type ReactNode } from 'react';
import { useStrata } from '../hooks/use-strata';

export type RequireAuthProps = {
  readonly children: ReactNode;
  readonly loading?: ReactNode;
  readonly unauthenticated?: ReactNode;
};

export function RequireAuth({ children, loading, unauthenticated }: RequireAuthProps) {
  const { authState } = useStrata();

  if (authState === 'loading') return <>{loading ?? null}</>;
  if (authState === 'unauthenticated') return <>{unauthenticated ?? null}</>;
  return <>{children}</>;
}

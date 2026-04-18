import { useCallback } from 'react';
import { useStrata } from './use-strata';

export function useAuth() {
  const { authState, authService } = useStrata();

  const login = useCallback(
    (provider?: string) => {
      if (!authService) throw new Error('AuthService not initialised');
      const target = provider ?? authService.providers[0]?.name;
      if (!target) throw new Error('No providers registered');
      authService.start(target);
    },
    [authService],
  );

  const logout = useCallback(async () => {
    if (!authService) return;
    await authService.logout();
  }, [authService]);

  return { state: authState, login, logout };
}

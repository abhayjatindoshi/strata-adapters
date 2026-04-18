import { useCallback } from 'react';
import { useStrata } from './use-strata';

export function useAuth() {
  const { authState, auth, providers } = useStrata();

  const login = useCallback(
    (provider?: string) => {
      const target = provider ?? providers[0];
      if (!target) throw new Error('No providers registered');
      const adapter = auth ?? null;
      if (adapter) {
        adapter.login(target);
        return;
      }
      // Pre-auth: any registered adapter can drive login since they all share the OAuth redirect
      window.location.href = `/api/auth/login?provider=${target}`;
    },
    [auth, providers],
  );

  const logout = useCallback(async () => {
    if (!auth) return;
    await auth.logout();
  }, [auth]);

  return { state: authState, login, logout };
}

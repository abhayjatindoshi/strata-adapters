import { useCallback } from 'react';
import { useTenant } from './use-tenant';
import { useStrata } from './use-strata';

export function useEncryption(): {
  readonly isEncrypted: boolean;
  readonly changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
} {
  const { strata } = useStrata();
  const { tenant } = useTenant();

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      if (!strata) throw new Error('Strata not initialized');
      await strata.tenants.changeCredential(oldPassword, newPassword);
    },
    [strata],
  );

  return {
    isEncrypted: tenant?.encrypted ?? false,
    changePassword,
  };
}

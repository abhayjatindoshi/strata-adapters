import type { ProviderModule } from '@strata-adapters/auth/provider-module';
import { useStrata } from './use-strata';

export function useProviders(): readonly ProviderModule[] {
  return useStrata().authService?.providers ?? [];
}

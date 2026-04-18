import { useMemo } from 'react';
import type { FeatureHandle } from '@strata-adapters/auth/feature-handle';
import { useStrata } from './use-strata';

/**
 * Get a `FeatureHandle` for a non-login OAuth grant on a provider.
 * Throws if the provider isn't registered or doesn't expose the feature.
 */
export function useFeature(provider: string, feature: string): FeatureHandle {
  const { authService } = useStrata();
  return useMemo(() => {
    if (!authService) throw new Error('AuthService not initialised');
    return authService.feature(provider, feature);
  }, [authService, provider, feature]);
}

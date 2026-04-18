import { useStrata } from './use-strata';

export function useProviders(): readonly string[] {
  return useStrata().providers;
}

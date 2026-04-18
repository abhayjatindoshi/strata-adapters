import { useAuth } from './use-auth';
import { useProviders } from './use-providers';

export function useLogin() {
  const providers = useProviders();
  const { login } = useAuth();
  return { providers, login };
}

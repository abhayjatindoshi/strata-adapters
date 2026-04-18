import { AuthService, type AuthServiceConfig } from './auth-service';

export type CreateOAuthServiceConfig = AuthServiceConfig;

export function createOAuthService(config: CreateOAuthServiceConfig): AuthService {
  return new AuthService(config);
}

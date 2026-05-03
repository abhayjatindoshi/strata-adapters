import type { AccessToken, ClientAuthAdapter } from './types';
import { StrataPluginConfigError } from '@/errors/strata-error';

const NOT_IMPLEMENTED = 'PkceClientAdapter is not implemented yet.';

/**
 * Stub for the PKCE (client-only) flow. Lives so the adapter contract has
 * a second implementation type for now; every method throws or returns
 * null.
 */
export class PkceClientAdapter implements ClientAuthAdapter {
  readonly name: string;

  constructor(config: { readonly name: string }) {
    this.name = config.name;
  }

  login(): Promise<void> {
    return Promise.reject(new StrataPluginConfigError(NOT_IMPLEMENTED));
  }

  logout(): Promise<void> {
    return Promise.reject(new StrataPluginConfigError(NOT_IMPLEMENTED));
  }

  refresh(): Promise<AccessToken | null> {
    return Promise.resolve(null);
  }
}

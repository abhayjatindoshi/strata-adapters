/**
 * Pluggable secret store for PKCE refresh tokens. Apps choose the threat
 * model: sessionStorage (dev), encrypted IndexedDB, WebAuthn-PRF, native
 * keychain, etc. Required only when `defineStrata().auth.pkce(...)` is used.
 */
export type SecretStore = {
  readonly get: (key: string) => Promise<string | null>;
  readonly set: (key: string, value: string) => Promise<void>;
  readonly delete: (key: string) => Promise<void>;
};

import type { CloudFactory } from '@strata-adapters/auth/provider-module';
import type { FeatureSpec, FeatureMap } from '@strata-adapters/auth/feature-spec';
import { GoogleDriveAdapter } from './google-drive-adapter';

/** Pre-filled OAuth endpoints for Google. */
export const GOOGLE_OAUTH_ENDPOINTS = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
} as const;

/**
 * Default `login` scopes for Google — the complete set the bundled
 * GoogleDriveAdapter requires (user folder + shared + appdata + profile/email).
 * Apps can narrow via `.login({ scopes })` in the provider builder.
 */
export const GOOGLE_DEFAULT_LOGIN_SCOPES: FeatureSpec = {
  scopes: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.appdata',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

export const GOOGLE_DEFAULT_FEATURES: FeatureMap = {
  login: GOOGLE_DEFAULT_LOGIN_SCOPES,
};

export const GOOGLE_CLOUD_FACTORY: CloudFactory = (auth) =>
  new GoogleDriveAdapter(async () => {
    const token = await auth.getAccessToken();
    if (!token) throw new Error('No access token available');
    return token;
  });

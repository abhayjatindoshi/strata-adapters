import type { FeatureMap } from './feature-spec';

export type ProviderConfig = {
  readonly name: string;
  readonly authUrl: string;
  readonly tokenUrl: string;
  readonly revokeUrl: string;
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly callbackUrl?: string;
  readonly features: FeatureMap;
};

export type OAuthTokenResponse = {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly token_type: string;
  readonly scope?: string;
};

type TokenRequest = {
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly callbackUrl?: string;
};

export async function exchangeCode(
  code: string,
  config: TokenRequest & { readonly callbackUrl: string },
): Promise<OAuthTokenResponse> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return (await response.json()) as OAuthTokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
  config: TokenRequest,
): Promise<OAuthTokenResponse> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return (await response.json()) as OAuthTokenResponse;
}

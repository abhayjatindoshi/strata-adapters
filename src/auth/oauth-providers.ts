export type OAuthProviderConfig = {
  readonly authUrl: string;
  readonly tokenUrl: string;
  readonly revokeUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly callbackUrl: string;
  readonly scopes: Readonly<Record<string, readonly string[]>>;
};

export type OAuthTokenResponse = {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly token_type: string;
  readonly scope?: string;
};

type GoogleProviderConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly callbackUrl: string;
  readonly scopes: Readonly<Record<string, readonly string[]>>;
};

const GOOGLE_URLS = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
} as const;

export function createGoogleProvider(config: GoogleProviderConfig): OAuthProviderConfig {
  return { ...GOOGLE_URLS, ...config };
}

export async function exchangeCode(
  code: string,
  config: Pick<OAuthProviderConfig, 'tokenUrl' | 'clientId' | 'clientSecret' | 'callbackUrl'>,
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
  config: Pick<OAuthProviderConfig, 'tokenUrl' | 'clientId' | 'clientSecret'>,
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

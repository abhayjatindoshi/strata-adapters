import type { ErrorOperation } from '@strata-adapters/errors/strata-error';
import {
  StrataError,
  AuthExpiredError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitedError,
} from '@strata-adapters/errors/strata-error';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export type DriveFile = {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
};

export type DriveFolder = DriveFile & {
  readonly mimeType: 'application/vnd.google-apps.folder';
};

const FOLDER_MIME = 'application/vnd.google-apps.folder' as const;

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('Retry-After');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

function mapDriveError(operation: ErrorOperation, response: Response): StrataError {
  const message = `Google Drive API error during ${operation}: ${response.status} ${response.statusText}`;
  switch (response.status) {
    case 401:
      return new AuthExpiredError(operation, new Error(message));
    case 403:
      return new PermissionDeniedError(operation, new Error(message));
    case 404:
      return new NotFoundError(operation, new Error(message));
    case 429:
      return new RateLimitedError(operation, parseRetryAfter(response), new Error(message));
    default:
      return new StrataError(message, {
        kind: 'unknown',
        operation,
        retryable: response.status >= 500,
        originalError: new Error(message),
      });
  }
}

export class GoogleDriveBrowser {
  private readonly getAccessToken: () => Promise<string>;

  constructor(getAccessToken: () => Promise<string>) {
    this.getAccessToken = getAccessToken;
  }

  async listFiles(folderId: string, space: 'drive' | 'sharedWithMe' = 'drive'): Promise<DriveFile[]> {
    const token = await this.getAccessToken();
    const safeFolderId = folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = `'${safeFolderId}' in parents and trashed=false`;
    const params = new URLSearchParams({
      q,
      fields: 'files(id,name,mimeType)',
      pageSize: '100',
      orderBy: 'folder,name',
    });
    if (space === 'sharedWithMe') {
      params.set('includeItemsFromAllDrives', 'true');
      params.set('supportsAllDrives', 'true');
    }

    const response = await fetch(`${DRIVE_API}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw mapDriveError('list', response);

    const result = (await response.json()) as { files: DriveFile[] };
    return result.files;
  }

  async createFolder(name: string, parentFolderId: string): Promise<DriveFolder> {
    const token = await this.getAccessToken();
    const metadata = {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentFolderId],
    };

    const response = await fetch(DRIVE_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });
    if (!response.ok) throw mapDriveError('write', response);

    return (await response.json()) as DriveFolder;
  }

  async getFolderInfo(folderId: string): Promise<DriveFile> {
    const token = await this.getAccessToken();
    const params = new URLSearchParams({ fields: 'id,name,mimeType' });

    const response = await fetch(`${DRIVE_API}/${folderId}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw mapDriveError('read', response);

    return (await response.json()) as DriveFile;
  }
}

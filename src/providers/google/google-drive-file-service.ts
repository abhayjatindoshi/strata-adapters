import type {
  CloudFile,
  CloudFileService,
  CloudSpace,
} from '@strata-adapters/cloud/cloud-file-service';
import type { ErrorOperation } from '@strata-adapters/errors/strata-error';
import {
  StrataError,
  AuthExpiredError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitedError,
} from '@strata-adapters/errors/strata-error';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

/**
 * CloudFile extended with Drive-specific fields so brand UIs can key off
 * `mimeType` (e.g. to show a Google-Doc / Sheet / Slides glyph).
 */
export type GoogleDriveFile = CloudFile & {
  readonly mimeType: string;
};

export const GOOGLE_DRIVE_SPACES = {
  myDrive: { id: 'drive', displayName: 'My Drive' },
  sharedWithMe: { id: 'sharedWithMe', displayName: 'Shared with me' },
  appData: { id: 'appDataFolder', displayName: 'App data' },
} as const satisfies Record<string, CloudSpace>;

const DEFAULT_SPACES: ReadonlyArray<CloudSpace> = [
  GOOGLE_DRIVE_SPACES.myDrive,
  GOOGLE_DRIVE_SPACES.sharedWithMe,
  GOOGLE_DRIVE_SPACES.appData,
];

export type GoogleDriveFileServiceOptions = {
  readonly getAccessToken: () => Promise<string>;
  /** Override which spaces are exposed. Default: all three. */
  readonly spaces?: ReadonlyArray<CloudSpace>;
};

/**
 * `CloudFileService` implementation backed by the Google Drive v3 REST API.
 * Supersedes the previous `GoogleDriveBrowser` helper.
 */
export class GoogleDriveFileService implements CloudFileService {
  private readonly getAccessToken: () => Promise<string>;
  private readonly spaces: ReadonlyArray<CloudSpace>;

  constructor(options: GoogleDriveFileServiceOptions) {
    this.getAccessToken = options.getAccessToken;
    this.spaces = options.spaces ?? DEFAULT_SPACES;
  }

  async getSpaces(_signal?: AbortSignal): Promise<ReadonlyArray<CloudSpace>> {
    return this.spaces;
  }

  async getListing(
    space: CloudSpace,
    parentFolderId: string | undefined,
    search: string | undefined,
    signal?: AbortSignal,
  ): Promise<ReadonlyArray<GoogleDriveFile>> {
    const token = await this.getAccessToken();
    const clauses: string[] = ['trashed=false'];

    if (parentFolderId) {
      // Inside a folder — Drive treats this the same across all spaces.
      clauses.push(`'${escape(parentFolderId)}' in parents`);
    } else if (space.id === 'sharedWithMe') {
      // "Shared with me" has no concrete root folder; use the dedicated flag.
      clauses.push('sharedWithMe=true');
    } else {
      clauses.push(`'${escape(rootFolderId(space))}' in parents`);
    }

    if (search && search.trim()) {
      clauses.push(`name contains '${escape(search.trim())}'`);
    }

    const params = new URLSearchParams({
      q: clauses.join(' and '),
      fields: 'files(id,name,mimeType,modifiedTime,size,owners(displayName,me))',
      pageSize: '100',
      orderBy: 'folder,name',
    });
    if (space.id === 'appDataFolder') {
      params.set('spaces', 'appDataFolder');
    } else if (space.id === 'sharedWithMe') {
      params.set('includeItemsFromAllDrives', 'true');
      params.set('supportsAllDrives', 'true');
    }

    const response = await fetch(`${DRIVE_API}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!response.ok) throw mapDriveError('list', response);

    const payload = (await response.json()) as {
      files: ReadonlyArray<DriveFileResponse>;
    };
    return payload.files.map(toGoogleDriveFile);
  }

  async createFolder(
    space: CloudSpace,
    name: string,
    parentFolderId: string | undefined,
    signal?: AbortSignal,
  ): Promise<GoogleDriveFile> {
    const token = await this.getAccessToken();
    const parent = parentFolderId ?? rootFolderId(space);
    const body = {
      name,
      mimeType: FOLDER_MIME,
      parents: [parent],
    };

    const response = await fetch(DRIVE_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw mapDriveError('write', response);

    const created = (await response.json()) as DriveFileResponse;
    return toGoogleDriveFile(created);
  }

  /** Look up a single folder's id/name/mimeType. Useful when you have only an id. */
  async getFolderInfo(folderId: string): Promise<GoogleDriveFile> {
    const token = await this.getAccessToken();
    const params = new URLSearchParams({
      fields: 'id,name,mimeType,modifiedTime,size,owners(displayName,me)',
    });
    const response = await fetch(`${DRIVE_API}/${folderId}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw mapDriveError('read', response);
    const file = (await response.json()) as DriveFileResponse;
    return toGoogleDriveFile(file);
  }
}

type DriveFileResponse = {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedTime?: string;
  readonly size?: string;
  readonly owners?: ReadonlyArray<{ displayName?: string; me?: boolean }>;
};

function toGoogleDriveFile(f: DriveFileResponse): GoogleDriveFile {
  const firstOwner = f.owners?.[0];
  const owner = firstOwner?.me ? 'me' : firstOwner?.displayName;
  const size = f.size ? Number(f.size) : undefined;
  return {
    id: f.id,
    name: f.name,
    isFolder: f.mimeType === FOLDER_MIME,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    owner,
    size: Number.isFinite(size) ? size : undefined,
  };
}

function rootFolderId(space: CloudSpace): string {
  if (space.id === 'appDataFolder') return 'appDataFolder';
  return 'root';
}

function escape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('Retry-After');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

function mapDriveError(operation: ErrorOperation, response: Response): StrataError {
  const message = `Google Drive API error during ${operation}: ${response.status} ${response.statusText}`;
  const cause = new Error(message);
  switch (response.status) {
    case 401:
      return new AuthExpiredError(operation, cause);
    case 403:
      return new PermissionDeniedError(operation, cause);
    case 404:
      return new NotFoundError(operation, cause);
    case 429:
      return new RateLimitedError(operation, parseRetryAfter(response), cause);
    default:
      return new StrataError(message, {
        kind: 'unknown',
        operation,
        retryable: response.status >= 500,
        originalError: cause,
      });
  }
}

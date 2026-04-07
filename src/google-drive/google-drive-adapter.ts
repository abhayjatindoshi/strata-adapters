import type { StorageAdapter, Tenant } from 'strata-data-sync';

export type GoogleDriveSpaceId = 'drive' | 'appDataFolder';

export type GoogleDriveAdapterConfig = {
  readonly getAccessToken: () => Promise<string>;
  readonly defaultSpace?: GoogleDriveSpaceId;
};

type FileListResponse = {
  files: Array<{ id: string; name: string; mimeType: string }>;
};

const API_BASE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';

export const SCOPES: ReadonlyArray<string> = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
];

export class GoogleDriveStorageAdapter implements StorageAdapter {
  static readonly SCOPES = SCOPES;

  private readonly getAccessToken: () => Promise<string>;
  private readonly defaultSpace: GoogleDriveSpaceId;
  // Cache: space → folderId → filename → fileId
  private readonly fileIdCache = new Map<string, Map<string, Map<string, string>>>();

  constructor(config: GoogleDriveAdapterConfig) {
    this.getAccessToken = config.getAccessToken;
    this.defaultSpace = config.defaultSpace ?? 'appDataFolder';
  }

  async read(tenant: Tenant | undefined, key: string): Promise<Uint8Array | null> {
    const token = await this.getAccessToken();
    const { space, folderId } = this.resolveTenant(tenant);
    const fileId = await this.findFileId(token, space, folderId, key);
    if (!fileId) return null;

    const params = new URLSearchParams({ alt: 'media' });
    if (space === 'appDataFolder') params.set('spaces', 'appDataFolder');

    const response = await fetch(`${API_BASE}/${fileId}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Google Drive read failed: ${response.status} ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async write(tenant: Tenant | undefined, key: string, data: Uint8Array): Promise<void> {
    const token = await this.getAccessToken();
    const { space, folderId } = this.resolveTenant(tenant);
    const fileId = await this.findFileId(token, space, folderId, key);

    if (fileId) {
      await this.updateFile(token, fileId, key, data);
    } else {
      const newFile = await this.createFile(token, space, key, data, folderId);
      this.cacheFileId(space, folderId, key, newFile.id);
    }
  }

  async delete(tenant: Tenant | undefined, key: string): Promise<boolean> {
    const token = await this.getAccessToken();
    const { space, folderId } = this.resolveTenant(tenant);
    const fileId = await this.findFileId(token, space, folderId, key);
    if (!fileId) return false;

    const response = await fetch(`${API_BASE}/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Google Drive delete failed: ${response.status} ${response.statusText}`);
    }
    this.evictFileId(space, folderId, key);
    return true;
  }

  // ── Internals ──────────────────────────────────────────

  private resolveTenant(tenant: Tenant | undefined): { space: GoogleDriveSpaceId; folderId: string } {
    if (!tenant) return { space: this.defaultSpace, folderId: 'root' };
    const space = (tenant.meta.spaceId as GoogleDriveSpaceId) ?? this.defaultSpace;
    const folderId = (tenant.meta.folderId as string) ?? 'root';
    return { space, folderId };
  }

  private async findFileId(
    token: string, space: GoogleDriveSpaceId, folderId: string, filename: string,
  ): Promise<string | null> {
    const cached = this.fileIdCache.get(space)?.get(folderId)?.get(filename);
    if (cached) return cached;
    await this.listFolder(token, space, folderId);
    return this.fileIdCache.get(space)?.get(folderId)?.get(filename) ?? null;
  }

  private async listFolder(token: string, space: GoogleDriveSpaceId, folderId: string): Promise<void> {
    const params = new URLSearchParams({
      fields: 'files(id,name,mimeType)',
    });

    const queryParts: string[] = [`trashed=false`];
    if (space === 'appDataFolder') {
      params.set('spaces', 'appDataFolder');
    } else {
      queryParts.push(`'${folderId === 'root' ? 'root' : folderId}' in parents`);
    }
    params.set('q', queryParts.join(' and '));

    const response = await fetch(`${API_BASE}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Google Drive list failed: ${response.status} ${response.statusText}`);
    }
    const data: FileListResponse = await response.json();
    for (const file of data.files) {
      this.cacheFileId(space, folderId, file.name, file.id);
    }
  }

  private async createFile(
    token: string, space: GoogleDriveSpaceId, name: string, data: Uint8Array, folderId: string,
  ): Promise<{ id: string }> {
    const metadata: Record<string, unknown> = {
      name,
      mimeType: 'application/octet-stream',
    };
    if (space === 'appDataFolder') {
      metadata.parents = ['appDataFolder'];
    } else if (folderId !== 'root') {
      metadata.parents = [folderId];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([data], { type: 'application/octet-stream' }));

    const response = await fetch(`${UPLOAD_BASE}?uploadType=multipart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Google Drive create failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<{ id: string }>;
  }

  private async updateFile(token: string, fileId: string, name: string, data: Uint8Array): Promise<void> {
    const metadata = { name, mimeType: 'application/octet-stream' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([data], { type: 'application/octet-stream' }));

    const response = await fetch(`${UPLOAD_BASE}/${fileId}?uploadType=multipart`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Google Drive update failed: ${response.status} ${response.statusText}`);
    }
  }

  // ── File ID cache ──────────────────────────────────────

  private cacheFileId(space: string, folderId: string, name: string, fileId: string): void {
    if (!this.fileIdCache.has(space)) this.fileIdCache.set(space, new Map());
    const spaceMap = this.fileIdCache.get(space)!;
    if (!spaceMap.has(folderId)) spaceMap.set(folderId, new Map());
    spaceMap.get(folderId)!.set(name, fileId);
  }

  private evictFileId(space: string, folderId: string, name: string): void {
    this.fileIdCache.get(space)?.get(folderId)?.delete(name);
  }
}

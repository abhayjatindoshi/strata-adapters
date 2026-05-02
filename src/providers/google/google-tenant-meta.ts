import { StrataPluginConfigError } from '@/errors/strata-error';

export type GoogleDriveSpace = 'appDataFolder' | 'drive' | 'sharedWithMe';

export type GoogleDriveTenantMeta = {
  readonly space: GoogleDriveSpace;
  readonly folderId?: string;
};

export function validateGoogleDriveMeta(
  meta: Record<string, unknown>,
): GoogleDriveTenantMeta {
  const space = meta.space as string | undefined;
  if (!space) {
    throw new StrataPluginConfigError('meta.space is required');
  }
  if (space !== 'appDataFolder' && space !== 'drive' && space !== 'sharedWithMe') {
    throw new StrataPluginConfigError(`Invalid meta.space: "${space}". Must be "appDataFolder", "drive", or "sharedWithMe"`);
  }
  if ((space === 'drive' || space === 'sharedWithMe') && !meta.folderId) {
    throw new StrataPluginConfigError(`meta.folderId is required when space is "${space}"`);
  }
  return { space, folderId: meta.folderId as string | undefined };
}

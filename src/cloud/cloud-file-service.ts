/**
 * Provider-agnostic cloud file service contract. Implementations include
 * `GoogleDriveFileService` (see `providers/google/google-drive-file-service.ts`).
 *
 * `space` is the top-level logical partition (e.g. Google's "My Drive",
 * "Shared with me", "App data"). `getListing` paginates per folder, with
 * optional search.
 */

/** Top-level logical partition within a cloud (e.g. "My Drive"). */
export type CloudSpace = {
  readonly id: string;
  readonly displayName: string;
};

/** File or folder within a `CloudSpace`. */
export type CloudFile = {
  readonly id: string;
  readonly name: string;
  readonly isFolder: boolean;
  /** Raw provider MIME type, if meaningful. Optional. */
  readonly mimeType?: string;
  /** ISO timestamp of last modification, if the provider exposes it. */
  readonly modifiedTime?: string;
  /** Display name of the file's owner. Use the string `"me"` for the current user. */
  readonly owner?: string;
  /** Size in bytes when known. Folders and Google-native docs typically omit this. */
  readonly size?: number;
};

/**
 * Everything `<CloudFileExplorer>` needs to browse a cloud. A provider
 * ships a single implementation (e.g. `GoogleDriveFileService`) and apps
 * construct it with a token-supplier.
 */
export type CloudFileService = {
  /** Top-level partitions the user can switch between. */
  readonly getSpaces: () => Promise<ReadonlyArray<CloudSpace>>;
  /**
   * List children of `parentFolder` within `space`. When `parentFolder` is
   * undefined, list the space root. `search` is a free-text filter applied
   * at the provider API.
   */
  readonly getListing: (
    space: CloudSpace,
    parentFolderId: string | undefined,
    search: string | undefined,
  ) => Promise<ReadonlyArray<CloudFile>>;
  /** Create a new folder under `parentFolder` (or space root when undefined). */
  readonly createFolder: (
    space: CloudSpace,
    name: string,
    parentFolderId: string | undefined,
  ) => Promise<CloudFile>;
};

/**
 * Host-side predicates that gate visibility and enablement in the explorer.
 * Consumers pass an instance to constrain which spaces / files the user can
 * select and where folder creation is allowed. All predicates default to
 * "true" when the validator is omitted.
 */
export type CloudFileExplorerValidator = {
  readonly isSpaceVisible: (space: CloudSpace) => boolean;
  readonly isSpaceEnabled: (space: CloudSpace) => boolean;
  readonly isFileVisible: (file: CloudFile) => boolean;
  readonly isFileEnabled: (file: CloudFile) => boolean;
  readonly folderCreationEnabled: (
    space: CloudSpace,
    parentFolder: CloudFile | undefined,
  ) => boolean;
};

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GoogleDriveBrowser } from '@strata-adapters/providers/google/google-drive-browser';
import {
  AuthExpiredError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitedError,
  StrataError,
} from '@strata-adapters/errors/strata-error';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, statusText = 'Error', headers?: Record<string, string>): Response {
  return new Response(null, { status, statusText, headers });
}

describe('GoogleDriveBrowser', () => {
  let browser: GoogleDriveBrowser;
  let mockFetch: Mock;
  const getToken = vi.fn().mockResolvedValue('test-token');

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    getToken.mockResolvedValue('test-token');
    browser = new GoogleDriveBrowser(getToken);
  });

  describe('listFiles', () => {
    it('returns files in a folder', async () => {
      const files = [
        { id: 'f1', name: 'doc.txt', mimeType: 'text/plain' },
        { id: 'f2', name: 'subfolder', mimeType: 'application/vnd.google-apps.folder' },
      ];
      mockFetch.mockResolvedValueOnce(jsonResponse({ files }));

      const result = await browser.listFiles('parent-id');

      expect(result).toEqual(files);
      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get('q')).toContain("'parent-id' in parents");
    });

    it('passes auth header', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ files: [] }));
      await browser.listFiles('folder-1');

      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
    });

    it('supports sharedWithMe space', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ files: [] }));
      await browser.listFiles('folder-1', 'sharedWithMe');

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get('includeItemsFromAllDrives')).toBe('true');
      expect(url.searchParams.get('supportsAllDrives')).toBe('true');
    });

    it('throws AuthExpiredError on 401', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));
      await expect(browser.listFiles('f')).rejects.toThrow(AuthExpiredError);
    });

    it('throws PermissionDeniedError on 403', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Forbidden'));
      await expect(browser.listFiles('f')).rejects.toThrow(PermissionDeniedError);
    });

    it('throws NotFoundError on 404', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Not Found'));
      await expect(browser.listFiles('f')).rejects.toThrow(NotFoundError);
    });

    it('throws RateLimitedError on 429 with Retry-After', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(429, 'Too Many Requests', { 'Retry-After': '30' }));
      try {
        await browser.listFiles('f');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitedError);
        expect((err as RateLimitedError).retryAfterMs).toBe(30000);
      }
    });

    it('throws StrataError with retryable=true on 500', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'));
      try {
        await browser.listFiles('f');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StrataError);
        expect((err as StrataError).retryable).toBe(true);
        expect((err as StrataError).kind).toBe('unknown');
      }
    });

    it('escapes special characters in folderId', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ files: [] }));
      await browser.listFiles("folder'id");

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get('q')).toContain("folder\\'id");
    });
  });

  describe('createFolder', () => {
    it('creates a folder and returns it', async () => {
      const folder = { id: 'new-folder', name: 'My Folder', mimeType: 'application/vnd.google-apps.folder' };
      mockFetch.mockResolvedValueOnce(jsonResponse(folder));

      const result = await browser.createFolder('My Folder', 'parent-id');

      expect(result).toEqual(folder);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe(DRIVE_API);
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.name).toBe('My Folder');
      expect(body.mimeType).toBe('application/vnd.google-apps.folder');
      expect(body.parents).toEqual(['parent-id']);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Forbidden'));
      await expect(browser.createFolder('F', 'parent')).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe('getFolderInfo', () => {
    it('returns folder info', async () => {
      const folder = { id: 'f1', name: 'Docs', mimeType: 'application/vnd.google-apps.folder' };
      mockFetch.mockResolvedValueOnce(jsonResponse(folder));

      const result = await browser.getFolderInfo('f1');

      expect(result).toEqual(folder);
      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.pathname).toContain('/f1');
    });

    it('throws NotFoundError on 404', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Not Found'));
      await expect(browser.getFolderInfo('missing')).rejects.toThrow(NotFoundError);
    });
  });
});

import type { ErrorOperation } from '@strata-adapters/errors/strata-error';
import {
  StrataError,
  AuthExpiredError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitedError,
} from '@strata-adapters/errors/strata-error';

export function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('Retry-After');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

export function mapDriveError(operation: ErrorOperation, response: Response): StrataError {
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

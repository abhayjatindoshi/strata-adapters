export type ErrorKind =
  | 'auth-expired'
  | 'quota-exceeded'
  | 'not-found'
  | 'permission-denied'
  | 'offline'
  | 'rate-limited'
  | 'data-corrupted'
  | 'unknown';

export type ErrorOperation = 'read' | 'write' | 'delete' | 'list' | 'sync' | 'resolve';

export class StrataError extends Error {
  readonly kind: ErrorKind;
  readonly operation: ErrorOperation;
  readonly retryable: boolean;
  readonly originalError?: Error;

  constructor(
    message: string,
    options: {
      kind: ErrorKind;
      operation: ErrorOperation;
      retryable?: boolean;
      originalError?: Error;
    },
  ) {
    super(message);
    this.name = 'StrataError';
    this.kind = options.kind;
    this.operation = options.operation;
    this.retryable = options.retryable ?? false;
    this.originalError = options.originalError;
  }
}

export class AuthExpiredError extends StrataError {
  constructor(operation: ErrorOperation, originalError?: Error) {
    super('Authentication expired — please sign in again', {
      kind: 'auth-expired',
      operation,
      retryable: false,
      originalError,
    });
    this.name = 'AuthExpiredError';
  }
}

export class QuotaExceededError extends StrataError {
  constructor(operation: ErrorOperation, originalError?: Error) {
    super('Storage quota exceeded', {
      kind: 'quota-exceeded',
      operation,
      retryable: false,
      originalError,
    });
    this.name = 'QuotaExceededError';
  }
}

export class NotFoundError extends StrataError {
  constructor(operation: ErrorOperation, originalError?: Error) {
    super('Storage location not found', {
      kind: 'not-found',
      operation,
      retryable: false,
      originalError,
    });
    this.name = 'NotFoundError';
  }
}

export class PermissionDeniedError extends StrataError {
  constructor(operation: ErrorOperation, originalError?: Error) {
    super('Permission denied — access to storage was revoked', {
      kind: 'permission-denied',
      operation,
      retryable: false,
      originalError,
    });
    this.name = 'PermissionDeniedError';
  }
}

export class OfflineError extends StrataError {
  constructor(operation: ErrorOperation, originalError?: Error) {
    super('No network connectivity', {
      kind: 'offline',
      operation,
      retryable: true,
      originalError,
    });
    this.name = 'OfflineError';
  }
}

export class RateLimitedError extends StrataError {
  readonly retryAfterMs?: number;

  constructor(operation: ErrorOperation, retryAfterMs?: number, originalError?: Error) {
    super('Too many requests — rate limited', {
      kind: 'rate-limited',
      operation,
      retryable: true,
      originalError,
    });
    this.name = 'RateLimitedError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class DataCorruptedError extends StrataError {
  constructor(operation: ErrorOperation, originalError?: Error) {
    super('Data is corrupted — cannot deserialize or decrypt', {
      kind: 'data-corrupted',
      operation,
      retryable: false,
      originalError,
    });
    this.name = 'DataCorruptedError';
  }
}

import { StrataError } from '@strata/core';

export type EncryptionErrorKind =
  | 'dek-not-loaded'
  | 'invalid-key-data'
  | 'data-corrupted';

export class EncryptionError extends StrataError {
  constructor(message: string, options: {
    readonly kind: EncryptionErrorKind;
    readonly cause?: Error;
  }) {
    super(message, { kind: options.kind, retryable: false, cause: options.cause });
    this.name = 'EncryptionError';
  }
}

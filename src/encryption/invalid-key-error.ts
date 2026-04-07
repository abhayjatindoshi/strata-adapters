export class InvalidEncryptionKeyError extends Error {
  constructor(message = 'Invalid encryption key') {
    super(message);
    this.name = 'InvalidEncryptionKeyError';
  }
}

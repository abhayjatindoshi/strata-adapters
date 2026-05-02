import type { EncryptionStrategy } from '@strata/core';
import { aesGcmEncrypt, aesGcmDecrypt } from '../crypto';
import { InvalidEncryptionKeyError } from '@strata/core';

export class AesGcmEncryptionStrategy implements EncryptionStrategy<CryptoKey> {
  async encrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    return aesGcmEncrypt(data, key);
  }

  async decrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    try {
      return await aesGcmDecrypt(data, key);
    } catch {
      throw new InvalidEncryptionKeyError();
    }
  }
}

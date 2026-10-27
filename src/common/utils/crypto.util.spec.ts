import { describe, expect, it } from 'vitest';
import { CryptoUtil } from './crypto.util.js';

describe('CryptoUtil (AES-256-GCM)', () => {
  const secretKey64Hex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const plaintext = 'tiktok_partner_secret_access_token_12345';

  it('should encrypt plaintext into iv:authTag:ciphertext format', () => {
    const encrypted = CryptoUtil.encrypt(plaintext, secretKey64Hex);
    expect(encrypted).toBeDefined();

    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(parts[1]).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should decrypt encrypted text back to original plaintext', () => {
    const encrypted = CryptoUtil.encrypt(plaintext, secretKey64Hex);
    const decrypted = CryptoUtil.decrypt(encrypted, secretKey64Hex);
    expect(decrypted).toBe(plaintext);
  });

  it('should throw an error if the encrypted payload has been tampered with', () => {
    const encrypted = CryptoUtil.encrypt(plaintext, secretKey64Hex);
    const parts = encrypted.split(':');
    // Tamper with the ciphertext
    const tampered = `${parts[0]}:${parts[1]}:ff${parts[2].slice(2)}`;

    expect(() => CryptoUtil.decrypt(tampered, secretKey64Hex)).toThrow();
  });

  it('should throw an error if format is invalid', () => {
    expect(() => CryptoUtil.decrypt('invalid-format', secretKey64Hex)).toThrow(
      'Invalid encrypted payload format',
    );
  });
});

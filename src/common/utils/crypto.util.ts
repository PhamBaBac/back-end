import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class CryptoUtil {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 96 bits standard for GCM
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits

  /**
   * Normalizes a 32-byte key from either a 64-char hex string or a 32-char utf-8 string.
   */
  private static getKeyBuffer(key: string): Buffer {
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
      return Buffer.from(key, 'hex');
    }
    const buf = Buffer.from(key, 'utf8');
    if (buf.length === 32) {
      return buf;
    }
    // Fallback: derive or slice/pad to 32 bytes
    const padded = Buffer.alloc(32);
    buf.copy(padded);
    return padded;
  }

  /**
   * Encrypts plaintext using AES-256-GCM.
   * Output format: `${ivHex}:${authTagHex}:${encryptedHex}`
   */
  static encrypt(plaintext: string, secretKey: string): string {
    const key = this.getKeyBuffer(secretKey);
    const iv = randomBytes(this.IV_LENGTH);
    const cipher = createCipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts AES-256-GCM ciphertext in format `${ivHex}:${authTagHex}:${encryptedHex}`.
   */
  static decrypt(payload: string, secretKey: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format. Expected iv:authTag:ciphertext');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = this.getKeyBuffer(secretKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

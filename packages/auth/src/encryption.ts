import * as crypto from 'crypto';

export interface EncryptionConfig {
  masterKey: string; // 32-byte hex string
  algorithm?: string;
}

export class EncryptionService {
  private algorithm: string;
  private key: Buffer;

  constructor(config: EncryptionConfig) {
    this.algorithm = config.algorithm || 'aes-256-gcm';

    // Convert hex master key to buffer
    if (config.masterKey.length !== 64) {
      throw new Error('Master key must be a 32-byte hex string (64 characters)');
    }

    this.key = Buffer.from(config.masterKey, 'hex');
  }

  /**
   * Encrypt data
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random IV (initialization vector)
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get auth tag for GCM mode
      const authTag = cipher.getAuthTag();

      // Combine IV + encrypted data + auth tag
      const combined = iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');

      return combined;
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt data
   */
  decrypt(ciphertext: string): string {
    try {
      // Split the combined string
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const authTag = Buffer.from(parts[2], 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Generate a random master key (32 bytes as hex)
   */
  static generateMasterKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

/**
 * Helper function to create encryption service from environment
 */
export function createEncryptionService(): EncryptionService {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;

  if (!masterKey) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
  }

  return new EncryptionService({ masterKey });
}

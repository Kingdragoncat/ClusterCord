import * as crypto from 'crypto';

export interface OTPConfig {
  length?: number;
  ttlSeconds?: number;
}

export interface OTPResult {
  code: string;
  hash: string;
  expiresAt: Date;
}

export class OTPGenerator {
  private length: number;
  private ttlSeconds: number;

  constructor(config: OTPConfig = {}) {
    this.length = config.length || 6;
    this.ttlSeconds = config.ttlSeconds || 300; // 5 minutes default
  }

  /**
   * Generate a cryptographically secure OTP code
   */
  generate(): OTPResult {
    // Generate random bytes and convert to numeric string
    const bytes = crypto.randomBytes(4);
    const num = bytes.readUInt32BE(0);
    const code = String(num % Math.pow(10, this.length)).padStart(this.length, '0');

    // Hash the code for storage
    const hash = this.hashCode(code);

    // Calculate expiry
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    return {
      code,
      hash,
      expiresAt
    };
  }

  /**
   * Hash an OTP code for secure storage
   */
  hashCode(code: string): string {
    return crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
  }

  /**
   * Verify an OTP code against its hash
   */
  verify(code: string, hash: string): boolean {
    const inputHash = this.hashCode(code);
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  /**
   * Check if OTP has expired
   */
  isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Get time remaining for OTP in seconds
   */
  getTimeRemaining(expiresAt: Date): number {
    const now = new Date();
    const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    return Math.max(0, remaining);
  }
}

/**
 * Default OTP generator instance
 */
export const defaultOTPGenerator = new OTPGenerator();

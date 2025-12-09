import * as crypto from 'crypto';

export interface IPHashConfig {
  salt: string;
}

export class IPHasher {
  private salt: string;

  constructor(config: IPHashConfig) {
    if (!config.salt) {
      throw new Error('Salt is required for IP hashing');
    }
    this.salt = config.salt;
  }

  /**
   * Hash an IP address with salt
   */
  hash(ip: string): string {
    return crypto
      .createHash('sha256')
      .update(ip + this.salt)
      .digest('hex');
  }

  /**
   * Verify an IP against its hash
   */
  verify(ip: string, hash: string): boolean {
    const inputHash = this.hash(ip);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(inputHash, 'hex'),
        Buffer.from(hash, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract IP from request (handles X-Forwarded-For, X-Real-IP)
   */
  extractIP(request: any): string {
    // Check X-Forwarded-For header
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      // Take the first IP in the list
      const ips = xForwardedFor.split(',').map((ip: string) => ip.trim());
      return ips[0];
    }

    // Check X-Real-IP header
    const xRealIP = request.headers['x-real-ip'];
    if (xRealIP) {
      return xRealIP;
    }

    // Fallback to remote address
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  /**
   * Generate a random salt
   */
  static generateSalt(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

/**
 * Helper function to create IP hasher from environment
 */
export function createIPHasher(): IPHasher {
  const salt = process.env.IP_SALT;

  if (!salt) {
    throw new Error('IP_SALT environment variable is required');
  }

  return new IPHasher({ salt });
}

import { OTPGenerator } from '../otp';

describe('OTPGenerator', () => {
  let generator: OTPGenerator;

  beforeEach(() => {
    generator = new OTPGenerator({ length: 6, ttlSeconds: 300 });
  });

  describe('generate', () => {
    it('should generate a 6-digit OTP code', () => {
      const result = generator.generate();

      expect(result.code).toHaveLength(6);
      expect(result.code).toMatch(/^\d{6}$/);
    });

    it('should generate a valid hash', () => {
      const result = generator.generate();

      expect(result.hash).toBeDefined();
      expect(result.hash).toHaveLength(64); // SHA-256 hex length
    });

    it('should set expiry time in the future', () => {
      const result = generator.generate();
      const now = new Date();

      expect(result.expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should generate unique codes', () => {
      const codes = new Set();

      for (let i = 0; i < 100; i++) {
        const result = generator.generate();
        codes.add(result.code);
      }

      // Should have high uniqueness (allow for rare collisions)
      expect(codes.size).toBeGreaterThan(95);
    });
  });

  describe('verify', () => {
    it('should verify a correct code', () => {
      const result = generator.generate();
      const isValid = generator.verify(result.code, result.hash);

      expect(isValid).toBe(true);
    });

    it('should reject an incorrect code', () => {
      const result = generator.generate();
      const isValid = generator.verify('000000', result.hash);

      expect(isValid).toBe(false);
    });

    it('should reject a code with wrong length', () => {
      const result = generator.generate();
      const isValid = generator.verify('123', result.hash);

      expect(isValid).toBe(false);
    });
  });

  describe('hashCode', () => {
    it('should produce consistent hashes for same input', () => {
      const code = '123456';
      const hash1 = generator.hashCode(code);
      const hash2 = generator.hashCode(code);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = generator.hashCode('123456');
      const hash2 = generator.hashCode('654321');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isExpired', () => {
    it('should return false for future expiry', () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute in future
      const isExpired = generator.isExpired(futureDate);

      expect(isExpired).toBe(false);
    });

    it('should return true for past expiry', () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute in past
      const isExpired = generator.isExpired(pastDate);

      expect(isExpired).toBe(true);
    });
  });

  describe('getTimeRemaining', () => {
    it('should return positive seconds for future expiry', () => {
      const futureDate = new Date(Date.now() + 120000); // 2 minutes
      const remaining = generator.getTimeRemaining(futureDate);

      expect(remaining).toBeGreaterThan(115); // Allow some execution time
      expect(remaining).toBeLessThanOrEqual(120);
    });

    it('should return 0 for past expiry', () => {
      const pastDate = new Date(Date.now() - 60000);
      const remaining = generator.getTimeRemaining(pastDate);

      expect(remaining).toBe(0);
    });
  });

  describe('custom configuration', () => {
    it('should respect custom code length', () => {
      const customGenerator = new OTPGenerator({ length: 8 });
      const result = customGenerator.generate();

      expect(result.code).toHaveLength(8);
      expect(result.code).toMatch(/^\d{8}$/);
    });

    it('should respect custom TTL', () => {
      const customTTL = 600; // 10 minutes
      const customGenerator = new OTPGenerator({ ttlSeconds: customTTL });
      const result = customGenerator.generate();

      const expectedExpiry = Date.now() + customTTL * 1000;
      const actualExpiry = result.expiresAt.getTime();

      // Allow 1 second margin for execution time
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
    });
  });
});

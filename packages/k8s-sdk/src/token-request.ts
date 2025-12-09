import { K8sClient } from './k8s-client';
import { TokenRequestConfig, TokenResponse } from './types';

export class TokenRequestManager {
  constructor(private client: K8sClient) {}

  /**
   * Request an ephemeral token for a service account using TokenRequest API
   */
  async requestToken(config: TokenRequestConfig): Promise<TokenResponse> {
    const coreApi = this.client.getCoreV1Api();
    const expirationSeconds = config.expirationSeconds || 600; // Default 10 minutes
    const audiences = config.audiences || ['api'];

    try {
      const tokenRequest = {
        apiVersion: 'authentication.k8s.io/v1',
        kind: 'TokenRequest',
        spec: {
          audiences,
          expirationSeconds
        }
      };

      // Create token request
      const response = await coreApi.createNamespacedServiceAccountToken(
        config.serviceAccount,
        config.namespace,
        tokenRequest
      );

      const token = response.body.status?.token;
      const expirationTimestamp = response.body.status?.expirationTimestamp;

      if (!token) {
        throw new Error('Token not returned from TokenRequest API');
      }

      const expiresAt = expirationTimestamp
        ? new Date(expirationTimestamp)
        : new Date(Date.now() + expirationSeconds * 1000);

      console.log(`Token requested for ${config.serviceAccount} (expires: ${expiresAt.toISOString()})`);

      return {
        token,
        expiresAt
      };
    } catch (error) {
      throw new Error(`Failed to request token: ${error}`);
    }
  }

  /**
   * Check if a token is still valid (based on expiry time)
   */
  isTokenValid(expiresAt: Date): boolean {
    return new Date() < expiresAt;
  }

  /**
   * Get time remaining for token in seconds
   */
  getTokenTimeRemaining(expiresAt: Date): number {
    const now = new Date();
    const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    return Math.max(0, remaining);
  }
}

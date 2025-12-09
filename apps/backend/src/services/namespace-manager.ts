import { K8sClient } from '@clustercord/k8s-sdk';

export interface NamespaceConfig {
  discordGuildId?: string;
  discordUserId: string;
  clusterId: string;
}

export class NamespaceManager {
  /**
   * Generate namespace name based on isolation type
   */
  static generateNamespaceName(config: NamespaceConfig): string {
    if (config.discordGuildId) {
      // Guild-level namespace for shared clusters
      return `clustercord-guild-${config.discordGuildId}`;
    } else {
      // User-level namespace for personal use
      return `clustercord-user-${config.discordUserId}`;
    }
  }

  /**
   * Ensure namespace exists, create if not
   */
  static async ensureNamespace(client: K8sClient, namespaceName: string): Promise<void> {
    const coreApi = client.getCoreV1Api();

    try {
      // Check if namespace exists
      await coreApi.readNamespace(namespaceName);
      console.log(`Namespace ${namespaceName} already exists`);
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        // Create namespace
        await coreApi.createNamespace({
          metadata: {
            name: namespaceName,
            labels: {
              'app.kubernetes.io/managed-by': 'clustercord',
              'clustercord.io/isolation': 'enabled'
            }
          }
        });
        console.log(`Created namespace: ${namespaceName}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Apply resource quotas to namespace
   */
  static async applyResourceQuota(
    client: K8sClient,
    namespaceName: string,
    quotaConfig?: {
      cpuLimit?: string;
      memoryLimit?: string;
      podsLimit?: string;
    }
  ): Promise<void> {
    const coreApi = client.getCoreV1Api();

    const quota = {
      metadata: {
        name: 'clustercord-quota',
        namespace: namespaceName
      },
      spec: {
        hard: {
          'requests.cpu': quotaConfig?.cpuLimit || '4',
          'requests.memory': quotaConfig?.memoryLimit || '8Gi',
          'pods': quotaConfig?.podsLimit || '50'
        }
      }
    };

    try {
      await coreApi.readNamespacedResourceQuota('clustercord-quota', namespaceName);
      // Update if exists
      await coreApi.replaceNamespacedResourceQuota('clustercord-quota', namespaceName, quota);
      console.log(`Updated resource quota for ${namespaceName}`);
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        // Create if doesn't exist
        await coreApi.createNamespacedResourceQuota(namespaceName, quota);
        console.log(`Created resource quota for ${namespaceName}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Apply network policies for isolation
   */
  static async applyNetworkPolicy(client: K8sClient, namespaceName: string): Promise<void> {
    const networkingApi = client.getKubeConfig().makeApiClient(
      require('@kubernetes/client-node').NetworkingV1Api
    );

    const policy = {
      metadata: {
        name: 'clustercord-isolation',
        namespace: namespaceName
      },
      spec: {
        podSelector: {},
        policyTypes: ['Ingress', 'Egress'],
        ingress: [
          {
            // Allow from same namespace
            from: [
              {
                podSelector: {}
              }
            ]
          }
        ],
        egress: [
          {
            // Allow to same namespace
            to: [
              {
                podSelector: {}
              }
            ]
          },
          {
            // Allow DNS
            to: [
              {
                namespaceSelector: {
                  matchLabels: {
                    'kubernetes.io/metadata.name': 'kube-system'
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'UDP',
                port: 53
              }
            ]
          },
          {
            // Allow internet egress
            to: [
              {
                ipBlock: {
                  cidr: '0.0.0.0/0',
                  except: ['169.254.169.254/32'] // Block metadata service
                }
              }
            ]
          }
        ]
      }
    };

    try {
      await networkingApi.readNamespacedNetworkPolicy('clustercord-isolation', namespaceName);
      await networkingApi.replaceNamespacedNetworkPolicy(
        'clustercord-isolation',
        namespaceName,
        policy
      );
      console.log(`Updated network policy for ${namespaceName}`);
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        await networkingApi.createNamespacedNetworkPolicy(namespaceName, policy);
        console.log(`Created network policy for ${namespaceName}`);
      } else {
        console.warn(`Failed to apply network policy: ${error.message}`);
      }
    }
  }

  /**
   * Setup complete namespace isolation
   */
  static async setupIsolatedNamespace(
    client: K8sClient,
    config: NamespaceConfig,
    quotaConfig?: {
      cpuLimit?: string;
      memoryLimit?: string;
      podsLimit?: string;
    }
  ): Promise<string> {
    const namespaceName = this.generateNamespaceName(config);

    // Create namespace
    await this.ensureNamespace(client, namespaceName);

    // Apply resource quotas
    await this.applyResourceQuota(client, namespaceName, quotaConfig);

    // Apply network policies for isolation
    await this.applyNetworkPolicy(client, namespaceName);

    return namespaceName;
  }

  /**
   * Check if user can access namespace
   */
  static canAccessNamespace(
    namespace: string,
    userDiscordId: string,
    guildId?: string
  ): boolean {
    // User can access their own namespace
    if (namespace === `clustercord-user-${userDiscordId}`) {
      return true;
    }

    // User can access their guild's namespace
    if (guildId && namespace === `clustercord-guild-${guildId}`) {
      return true;
    }

    // Allow access to non-ClusterCord namespaces (cluster admin mode)
    if (!namespace.startsWith('clustercord-')) {
      return true;
    }

    return false;
  }

  /**
   * Delete namespace and all resources
   */
  static async deleteNamespace(client: K8sClient, namespaceName: string): Promise<void> {
    const coreApi = client.getCoreV1Api();

    try {
      await coreApi.deleteNamespace(namespaceName);
      console.log(`Deleted namespace: ${namespaceName}`);
    } catch (error: any) {
      if (error.response?.statusCode !== 404) {
        throw error;
      }
    }
  }
}

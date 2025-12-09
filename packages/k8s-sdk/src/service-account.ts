import { K8sClient } from './k8s-client';
import { ServiceAccountConfig } from './types';

export class ServiceAccountManager {
  constructor(private client: K8sClient) {}

  /**
   * Create a service account for a user
   */
  async createServiceAccount(config: ServiceAccountConfig): Promise<void> {
    const coreApi = this.client.getCoreV1Api();

    try {
      // Check if service account already exists
      try {
        await coreApi.readNamespacedServiceAccount(config.name, config.namespace);
        console.log(`ServiceAccount ${config.name} already exists in ${config.namespace}`);
        return;
      } catch (error: any) {
        if (error.response?.statusCode !== 404) {
          throw error;
        }
      }

      // Create the service account
      await coreApi.createNamespacedServiceAccount(config.namespace, {
        metadata: {
          name: config.name,
          labels: {
            'app.kubernetes.io/managed-by': 'clustercord',
            'clustercord.io/service-account': 'user'
          }
        }
      });

      console.log(`Created ServiceAccount: ${config.name} in namespace ${config.namespace}`);
    } catch (error) {
      throw new Error(`Failed to create service account: ${error}`);
    }
  }

  /**
   * Delete a service account
   */
  async deleteServiceAccount(config: ServiceAccountConfig): Promise<void> {
    const coreApi = this.client.getCoreV1Api();

    try {
      await coreApi.deleteNamespacedServiceAccount(config.name, config.namespace);
      console.log(`Deleted ServiceAccount: ${config.name} from namespace ${config.namespace}`);
    } catch (error: any) {
      if (error.response?.statusCode !== 404) {
        throw new Error(`Failed to delete service account: ${error}`);
      }
    }
  }

  /**
   * Check if service account exists
   */
  async serviceAccountExists(config: ServiceAccountConfig): Promise<boolean> {
    const coreApi = this.client.getCoreV1Api();

    try {
      await coreApi.readNamespacedServiceAccount(config.name, config.namespace);
      return true;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return false;
      }
      throw new Error(`Failed to check service account: ${error}`);
    }
  }

  /**
   * List all ClusterCord-managed service accounts
   */
  async listManagedServiceAccounts(namespace?: string): Promise<any[]> {
    const coreApi = this.client.getCoreV1Api();

    try {
      const labelSelector = 'app.kubernetes.io/managed-by=clustercord';

      if (namespace) {
        const response = await coreApi.listNamespacedServiceAccount(
          namespace,
          undefined,
          undefined,
          undefined,
          undefined,
          labelSelector
        );
        return response.body.items;
      } else {
        const response = await coreApi.listServiceAccountForAllNamespaces(
          undefined,
          undefined,
          undefined,
          labelSelector
        );
        return response.body.items;
      }
    } catch (error) {
      throw new Error(`Failed to list service accounts: ${error}`);
    }
  }
}

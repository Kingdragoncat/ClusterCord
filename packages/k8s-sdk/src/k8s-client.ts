import * as k8s from '@kubernetes/client-node';
import { ClusterConfig } from './types';

export class K8sClient {
  private kc: k8s.KubeConfig;
  private coreV1Api: k8s.CoreV1Api;
  private appsV1Api: k8s.AppsV1Api;
  private rbacV1Api: k8s.RbacAuthorizationV1Api;
  private exec: k8s.Exec;

  constructor(config: ClusterConfig) {
    this.kc = new k8s.KubeConfig();

    // Load kubeconfig from string
    this.kc.loadFromString(config.kubeconfig);

    // Set context if provided
    if (config.context) {
      this.kc.setCurrentContext(config.context);
    }

    this.coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
    this.appsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);
    this.rbacV1Api = this.kc.makeApiClient(k8s.RbacAuthorizationV1Api);
    this.exec = new k8s.Exec(this.kc);
  }

  getCoreV1Api(): k8s.CoreV1Api {
    return this.coreV1Api;
  }

  getAppsV1Api(): k8s.AppsV1Api {
    return this.appsV1Api;
  }

  getRbacV1Api(): k8s.RbacAuthorizationV1Api {
    return this.rbacV1Api;
  }

  getExec(): k8s.Exec {
    return this.exec;
  }

  getKubeConfig(): k8s.KubeConfig {
    return this.kc;
  }

  /**
   * Test cluster connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.coreV1Api.listNamespace();
      return true;
    } catch (error) {
      console.error('Cluster connection test failed:', error);
      return false;
    }
  }

  /**
   * Get cluster info
   */
  async getClusterInfo(): Promise<{ version: string; endpoint: string }> {
    const currentContext = this.kc.getCurrentContext();
    const cluster = this.kc.getCurrentCluster();

    if (!cluster) {
      throw new Error('No cluster found in kubeconfig');
    }

    try {
      const versionApi = this.kc.makeApiClient(k8s.VersionApi);
      const versionInfo = await versionApi.getCode();

      return {
        version: versionInfo.body.gitVersion || 'unknown',
        endpoint: cluster.server
      };
    } catch (error) {
      throw new Error(`Failed to get cluster info: ${error}`);
    }
  }

  /**
   * List all pods in a namespace
   */
  async listPods(namespace: string) {
    try {
      const response = await this.coreV1Api.listNamespacedPod(namespace);
      return response.body.items;
    } catch (error) {
      throw new Error(`Failed to list pods: ${error}`);
    }
  }

  /**
   * Get pod logs
   */
  async getPodLogs(
    podName: string,
    namespace: string,
    options: {
      container?: string;
      tailLines?: number;
      follow?: boolean;
      timestamps?: boolean;
    } = {}
  ): Promise<string> {
    try {
      const response = await this.coreV1Api.readNamespacedPodLog(
        podName,
        namespace,
        options.container,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        options.tailLines,
        options.timestamps
      );
      return response.body;
    } catch (error) {
      throw new Error(`Failed to get pod logs: ${error}`);
    }
  }

  /**
   * Describe pod (get detailed info)
   */
  async describePod(podName: string, namespace: string) {
    try {
      const response = await this.coreV1Api.readNamespacedPod(podName, namespace);
      return response.body;
    } catch (error) {
      throw new Error(`Failed to describe pod: ${error}`);
    }
  }
}

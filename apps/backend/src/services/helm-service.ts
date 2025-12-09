import { K8sClient } from '@clustercord/k8s-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

export interface HelmRelease {
  name: string;
  namespace: string;
  revision: string;
  updated: string;
  status: string;
  chart: string;
  appVersion: string;
}

export interface HelmChart {
  name: string;
  version: string;
  appVersion: string;
  description: string;
  repository: string;
  icon?: string;
  deprecated?: boolean;
}

export interface HelmSearchResult {
  name: string;
  version: string;
  appVersion: string;
  description: string;
  url: string;
}

export interface HelmValues {
  [key: string]: any;
}

/**
 * Helm Service - Complete Helm chart management
 */
export class HelmService {
  /**
   * Search ArtifactHub for Helm charts
   */
  async searchArtifactHub(query: string, limit: number = 20): Promise<HelmSearchResult[]> {
    try {
      const response = await axios.get('https://artifacthub.io/api/v1/packages/search', {
        params: {
          ts_query_web: query,
          kind: 0, // Helm charts
          limit,
          offset: 0
        }
      });

      return response.data.packages.map((pkg: any) => ({
        name: pkg.normalized_name,
        version: pkg.version,
        appVersion: pkg.app_version || 'N/A',
        description: pkg.description || 'No description',
        url: pkg.repository.url,
        repository: pkg.repository.name
      }));
    } catch (error: any) {
      throw new Error(`Failed to search ArtifactHub: ${error.message}`);
    }
  }

  /**
   * Add Helm repository
   */
  async addRepository(name: string, url: string, clusterId?: string): Promise<void> {
    try {
      const command = `helm repo add ${name} ${url}`;
      await execAsync(command);

      // Update repo to fetch latest charts
      await execAsync('helm repo update');
    } catch (error: any) {
      throw new Error(`Failed to add Helm repository: ${error.message}`);
    }
  }

  /**
   * List Helm releases
   */
  async listReleases(
    client: K8sClient,
    namespace?: string
  ): Promise<HelmRelease[]> {
    try {
      const namespaceFlag = namespace ? `-n ${namespace}` : '-A';
      const command = `helm list ${namespaceFlag} -o json`;

      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          KUBECONFIG: this.getKubeconfigPath(client)
        }
      });

      return JSON.parse(stdout || '[]');
    } catch (error: any) {
      throw new Error(`Failed to list Helm releases: ${error.message}`);
    }
  }

  /**
   * Get release status
   */
  async getRelease(
    client: K8sClient,
    name: string,
    namespace: string
  ): Promise<HelmRelease> {
    try {
      const command = `helm status ${name} -n ${namespace} -o json`;

      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          KUBECONFIG: this.getKubeconfigPath(client)
        }
      });

      const status = JSON.parse(stdout);
      return {
        name: status.name,
        namespace: status.namespace,
        revision: status.version.toString(),
        updated: status.info.last_deployed,
        status: status.info.status,
        chart: status.chart.metadata.name,
        appVersion: status.chart.metadata.appVersion || 'N/A'
      };
    } catch (error: any) {
      throw new Error(`Failed to get Helm release: ${error.message}`);
    }
  }

  /**
   * Install Helm chart
   */
  async install(
    client: K8sClient,
    releaseName: string,
    chart: string,
    namespace: string,
    values?: HelmValues,
    createNamespace: boolean = true
  ): Promise<{ success: boolean; revision: string }> {
    try {
      let command = `helm install ${releaseName} ${chart} -n ${namespace}`;

      if (createNamespace) {
        command += ' --create-namespace';
      }

      if (values) {
        // Write values to temp file
        const valuesFile = `/tmp/helm-values-${Date.now()}.yaml`;
        const yaml = require('js-yaml');
        const fs = require('fs');
        fs.writeFileSync(valuesFile, yaml.dump(values));
        command += ` -f ${valuesFile}`;
      }

      command += ' -o json';

      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          KUBECONFIG: this.getKubeconfigPath(client)
        }
      });

      const result = JSON.parse(stdout);

      return {
        success: true,
        revision: result.version?.toString() || '1'
      };
    } catch (error: any) {
      throw new Error(`Failed to install Helm chart: ${error.message}`);
    }
  }

  /**
   * Upgrade Helm release
   */
  async upgrade(
    client: K8sClient,
    releaseName: string,
    chart: string,
    namespace: string,
    values?: HelmValues,
    version?: string
  ): Promise<{ success: boolean; revision: string }> {
    try {
      let command = `helm upgrade ${releaseName} ${chart} -n ${namespace}`;

      if (version) {
        command += ` --version ${version}`;
      }

      if (values) {
        const valuesFile = `/tmp/helm-values-${Date.now()}.yaml`;
        const yaml = require('js-yaml');
        const fs = require('fs');
        fs.writeFileSync(valuesFile, yaml.dump(values));
        command += ` -f ${valuesFile}`;
      }

      command += ' -o json';

      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          KUBECONFIG: this.getKubeconfigPath(client)
        }
      });

      const result = JSON.parse(stdout);

      return {
        success: true,
        revision: result.version?.toString() || 'unknown'
      };
    } catch (error: any) {
      throw new Error(`Failed to upgrade Helm release: ${error.message}`);
    }
  }

  /**
   * Rollback Helm release
   */
  async rollback(
    client: K8sClient,
    releaseName: string,
    namespace: string,
    revision?: number
  ): Promise<{ success: boolean; revision: string }> {
    try {
      let command = `helm rollback ${releaseName}`;

      if (revision) {
        command += ` ${revision}`;
      }

      command += ` -n ${namespace}`;

      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          KUBECONFIG: this.getKubeconfigPath(client)
        }
      });

      // Get current revision after rollback
      const release = await this.getRelease(client, releaseName, namespace);

      return {
        success: true,
        revision: release.revision
      };
    } catch (error: any) {
      throw new Error(`Failed to rollback Helm release: ${error.message}`);
    }
  }

  /**
   * Uninstall Helm release
   */
  async uninstall(
    client: K8sClient,
    releaseName: string,
    namespace: string,
    keepHistory: boolean = false
  ): Promise<{ success: boolean }> {
    try {
      let command = `helm uninstall ${releaseName} -n ${namespace}`;

      if (keepHistory) {
        command += ' --keep-history';
      }

      await execAsync(command, {
        env: {
          ...process.env,
          KUBECONFIG: this.getKubeconfigPath(client)
        }
      });

      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to uninstall Helm release: ${error.message}`);
    }
  }

  /**
   * Get Helm release values
   */
  async getValues(
    client: K8sClient,
    releaseName: string,
    namespace: string
  ): Promise<HelmValues> {
    try {
      const command = `helm get values ${releaseName} -n ${namespace} -o json`;

      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          KUBECONFIG: this.getKubeconfigPath(client)
        }
      });

      return JSON.parse(stdout || '{}');
    } catch (error: any) {
      throw new Error(`Failed to get Helm values: ${error.message}`);
    }
  }

  /**
   * Get Helm release history
   */
  async getHistory(
    client: K8sClient,
    releaseName: string,
    namespace: string
  ): Promise<Array<{ revision: number; updated: string; status: string; description: string }>> {
    try {
      const command = `helm history ${releaseName} -n ${namespace} -o json`;

      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          KUBECONFIG: this.getKubeconfigPath(client)
        }
      });

      return JSON.parse(stdout || '[]');
    } catch (error: any) {
      throw new Error(`Failed to get Helm history: ${error.message}`);
    }
  }

  /**
   * Test Helm chart
   */
  async test(
    client: K8sClient,
    releaseName: string,
    namespace: string
  ): Promise<{ success: boolean; output: string }> {
    try {
      const command = `helm test ${releaseName} -n ${namespace}`;

      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          KUBECONFIG: this.getKubeconfigPath(client)
        }
      });

      return {
        success: true,
        output: stdout
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.message
      };
    }
  }

  /**
   * Get manifest for release
   */
  async getManifest(
    client: K8sClient,
    releaseName: string,
    namespace: string
  ): Promise<string> {
    try {
      const command = `helm get manifest ${releaseName} -n ${namespace}`;

      const { stdout } = await execAsync(command, {
        env: {
          ...process.env,
          KUBECONFIG: this.getKubeconfigPath(client)
        }
      });

      return stdout;
    } catch (error: any) {
      throw new Error(`Failed to get Helm manifest: ${error.message}`);
    }
  }

  /**
   * Helper: Get kubeconfig path for client
   */
  private getKubeconfigPath(client: K8sClient): string {
    // Write kubeconfig to temp file
    const fs = require('fs');
    const tmpFile = `/tmp/kubeconfig-${Date.now()}`;
    const yaml = require('js-yaml');

    // Get kubeconfig from client
    const kc = client.getKubeConfig();
    const kubeconfigYaml = yaml.dump(kc.exportConfig());

    fs.writeFileSync(tmpFile, kubeconfigYaml);

    // Schedule cleanup
    setTimeout(() => {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }, 60000); // Clean up after 1 minute

    return tmpFile;
  }

  /**
   * Format release for Discord
   */
  formatRelease(release: HelmRelease): string {
    const statusEmoji = release.status === 'deployed' ? '✅' : '⚠️';

    return `
${statusEmoji} **${release.name}**
Namespace: ${release.namespace}
Chart: ${release.chart}
Version: ${release.appVersion}
Revision: ${release.revision}
Status: ${release.status}
Updated: ${new Date(release.updated).toLocaleString()}
    `.trim();
  }
}

import { K8sClient } from '@clustercord/k8s-sdk';
import axios from 'axios';

export type GitOpsType = 'ARGOCD' | 'FLUX';

export interface GitOpsApp {
  name: string;
  type: GitOpsType;
  clusterId: string;
  namespace: string;
  repoUrl: string;
  path?: string;
  targetRevision: string;
  syncStatus?: string;
  healthStatus?: string;
}

export interface SyncStatus {
  status: 'Synced' | 'OutOfSync' | 'Unknown';
  health: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
  lastSyncedAt?: Date;
  syncedRevision?: string;
  targetRevision?: string;
  conditions?: Array<{
    type: string;
    status: string;
    message: string;
  }>;
}

export interface DriftDetection {
  drifted: boolean;
  resources: Array<{
    group: string;
    kind: string;
    name: string;
    namespace: string;
    status: 'InSync' | 'OutOfSync';
    message?: string;
  }>;
}

/**
 * GitOps Service - ArgoCD and Flux integration
 */
export class GitOpsService {
  /**
   * Get ArgoCD application status
   */
  async getArgoCDAppStatus(
    client: K8sClient,
    appName: string,
    namespace: string = 'argocd'
  ): Promise<SyncStatus> {
    try {
      const customApi = client.getKubeConfig().makeApiClient(client as any);

      // Get ArgoCD Application CRD
      const response = await customApi.getNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        namespace,
        'applications',
        appName
      );

      const app = response.body as any;

      return {
        status: app.status?.sync?.status || 'Unknown',
        health: app.status?.health?.status || 'Unknown',
        lastSyncedAt: app.status?.operationState?.finishedAt
          ? new Date(app.status.operationState.finishedAt)
          : undefined,
        syncedRevision: app.status?.sync?.revision,
        targetRevision: app.spec?.source?.targetRevision,
        conditions: app.status?.conditions?.map((c: any) => ({
          type: c.type,
          status: c.status,
          message: c.message
        }))
      };
    } catch (error: any) {
      throw new Error(`Failed to get ArgoCD app status: ${error.message}`);
    }
  }

  /**
   * Sync ArgoCD application
   */
  async syncArgoCDApp(
    client: K8sClient,
    appName: string,
    namespace: string = 'argocd',
    prune: boolean = false,
    dryRun: boolean = false
  ): Promise<{ operationId: string }> {
    try {
      const customApi = client.getKubeConfig().makeApiClient(client as any);

      // Patch ArgoCD Application to trigger sync
      const patch = {
        operation: {
          sync: {
            prune,
            dryRun,
            syncOptions: ['CreateNamespace=true']
          }
        }
      };

      const response = await customApi.patchNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        namespace,
        'applications',
        appName,
        patch,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/merge-patch+json' } }
      );

      const app = response.body as any;

      return {
        operationId: app.status?.operationState?.operation?.sync?.revision || 'pending'
      };
    } catch (error: any) {
      throw new Error(`Failed to sync ArgoCD app: ${error.message}`);
    }
  }

  /**
   * Diff ArgoCD application (show changes before sync)
   */
  async diffArgoCDApp(
    client: K8sClient,
    appName: string,
    namespace: string = 'argocd'
  ): Promise<DriftDetection> {
    try {
      const customApi = client.getKubeConfig().makeApiClient(client as any);

      const response = await customApi.getNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        namespace,
        'applications',
        appName
      );

      const app = response.body as any;

      const resources = app.status?.resources?.map((r: any) => ({
        group: r.group || '',
        kind: r.kind,
        name: r.name,
        namespace: r.namespace,
        status: r.status === 'Synced' ? 'InSync' : 'OutOfSync',
        message: r.message
      })) || [];

      const drifted = resources.some((r: any) => r.status === 'OutOfSync');

      return {
        drifted,
        resources
      };
    } catch (error: any) {
      throw new Error(`Failed to diff ArgoCD app: ${error.message}`);
    }
  }

  /**
   * Get Flux Kustomization status
   */
  async getFluxKustomizationStatus(
    client: K8sClient,
    name: string,
    namespace: string = 'flux-system'
  ): Promise<SyncStatus> {
    try {
      const customApi = client.getKubeConfig().makeApiClient(client as any);

      const response = await customApi.getNamespacedCustomObject(
        'kustomize.toolkit.fluxcd.io',
        'v1',
        namespace,
        'kustomizations',
        name
      );

      const kustomization = response.body as any;

      const conditions = kustomization.status?.conditions || [];
      const readyCondition = conditions.find((c: any) => c.type === 'Ready');

      return {
        status: readyCondition?.status === 'True' ? 'Synced' : 'OutOfSync',
        health: readyCondition?.reason === 'ReconciliationSucceeded' ? 'Healthy' : 'Degraded',
        lastSyncedAt: kustomization.status?.lastAppliedRevision
          ? new Date()
          : undefined,
        syncedRevision: kustomization.status?.lastAppliedRevision,
        targetRevision: kustomization.spec?.sourceRef?.branch || 'main',
        conditions: conditions.map((c: any) => ({
          type: c.type,
          status: c.status,
          message: c.message
        }))
      };
    } catch (error: any) {
      throw new Error(`Failed to get Flux Kustomization status: ${error.message}`);
    }
  }

  /**
   * Reconcile Flux Kustomization (force sync)
   */
  async reconcileFluxKustomization(
    client: K8sClient,
    name: string,
    namespace: string = 'flux-system'
  ): Promise<{ success: boolean }> {
    try {
      const customApi = client.getKubeConfig().makeApiClient(client as any);

      // Annotate Kustomization to trigger reconciliation
      const patch = {
        metadata: {
          annotations: {
            'reconcile.fluxcd.io/requestedAt': new Date().toISOString()
          }
        }
      };

      await customApi.patchNamespacedCustomObject(
        'kustomize.toolkit.fluxcd.io',
        'v1',
        namespace,
        'kustomizations',
        name,
        patch,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/merge-patch+json' } }
      );

      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to reconcile Flux Kustomization: ${error.message}`);
    }
  }

  /**
   * Get Flux HelmRelease status
   */
  async getFluxHelmReleaseStatus(
    client: K8sClient,
    name: string,
    namespace: string
  ): Promise<SyncStatus> {
    try {
      const customApi = client.getKubeConfig().makeApiClient(client as any);

      const response = await customApi.getNamespacedCustomObject(
        'helm.toolkit.fluxcd.io',
        'v2beta1',
        namespace,
        'helmreleases',
        name
      );

      const helmRelease = response.body as any;

      const conditions = helmRelease.status?.conditions || [];
      const readyCondition = conditions.find((c: any) => c.type === 'Ready');

      return {
        status: readyCondition?.status === 'True' ? 'Synced' : 'OutOfSync',
        health: readyCondition?.reason === 'ReconciliationSucceeded' ? 'Healthy' : 'Degraded',
        lastSyncedAt: helmRelease.status?.lastAppliedRevision
          ? new Date()
          : undefined,
        syncedRevision: helmRelease.status?.lastAttemptedRevision,
        targetRevision: helmRelease.spec?.chart?.spec?.version,
        conditions: conditions.map((c: any) => ({
          type: c.type,
          status: c.status,
          message: c.message
        }))
      };
    } catch (error: any) {
      throw new Error(`Failed to get Flux HelmRelease status: ${error.message}`);
    }
  }

  /**
   * Suspend ArgoCD application
   */
  async suspendArgoCDApp(
    client: K8sClient,
    appName: string,
    namespace: string = 'argocd'
  ): Promise<{ success: boolean }> {
    try {
      const customApi = client.getKubeConfig().makeApiClient(client as any);

      const patch = {
        spec: {
          syncPolicy: {
            automated: null
          }
        }
      };

      await customApi.patchNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        namespace,
        'applications',
        appName,
        patch,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/merge-patch+json' } }
      );

      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to suspend ArgoCD app: ${error.message}`);
    }
  }

  /**
   * Resume ArgoCD application
   */
  async resumeArgoCDApp(
    client: K8sClient,
    appName: string,
    namespace: string = 'argocd'
  ): Promise<{ success: boolean }> {
    try {
      const customApi = client.getKubeConfig().makeApiClient(client as any);

      const patch = {
        spec: {
          syncPolicy: {
            automated: {
              prune: true,
              selfHeal: true
            }
          }
        }
      };

      await customApi.patchNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        namespace,
        'applications',
        appName,
        patch,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/merge-patch+json' } }
      );

      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to resume ArgoCD app: ${error.message}`);
    }
  }

  /**
   * Detect GitOps type in cluster
   */
  async detectGitOpsType(client: K8sClient): Promise<GitOpsType | null> {
    try {
      const coreApi = client.getCoreV1Api();

      // Check for ArgoCD
      try {
        await coreApi.readNamespace('argocd');
        return 'ARGOCD';
      } catch {}

      // Check for Flux
      try {
        await coreApi.readNamespace('flux-system');
        return 'FLUX';
      } catch {}

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * List all GitOps applications
   */
  async listGitOpsApps(
    client: K8sClient,
    type: GitOpsType,
    namespace?: string
  ): Promise<Array<{ name: string; namespace: string; syncStatus: string; healthStatus: string }>> {
    try {
      const customApi = client.getKubeConfig().makeApiClient(client as any);

      if (type === 'ARGOCD') {
        const response = await customApi.listNamespacedCustomObject(
          'argoproj.io',
          'v1alpha1',
          namespace || 'argocd',
          'applications'
        );

        const apps = (response.body as any).items || [];

        return apps.map((app: any) => ({
          name: app.metadata.name,
          namespace: app.metadata.namespace,
          syncStatus: app.status?.sync?.status || 'Unknown',
          healthStatus: app.status?.health?.status || 'Unknown'
        }));
      } else {
        const response = await customApi.listNamespacedCustomObject(
          'kustomize.toolkit.fluxcd.io',
          'v1',
          namespace || 'flux-system',
          'kustomizations'
        );

        const kustomizations = (response.body as any).items || [];

        return kustomizations.map((k: any) => {
          const readyCondition = k.status?.conditions?.find((c: any) => c.type === 'Ready');
          return {
            name: k.metadata.name,
            namespace: k.metadata.namespace,
            syncStatus: readyCondition?.status === 'True' ? 'Synced' : 'OutOfSync',
            healthStatus: readyCondition?.reason === 'ReconciliationSucceeded' ? 'Healthy' : 'Degraded'
          };
        });
      }
    } catch (error: any) {
      throw new Error(`Failed to list GitOps apps: ${error.message}`);
    }
  }

  /**
   * Format sync status for Discord embed
   */
  formatSyncStatus(status: SyncStatus): string {
    const statusEmoji = status.status === 'Synced' ? '✅' : '⚠️';
    const healthEmoji =
      status.health === 'Healthy'
        ? '💚'
        : status.health === 'Progressing'
        ? '🟡'
        : '❌';

    return `
${statusEmoji} **Sync Status**: ${status.status}
${healthEmoji} **Health**: ${status.health}
📦 **Synced Revision**: ${status.syncedRevision || 'N/A'}
🎯 **Target Revision**: ${status.targetRevision || 'N/A'}
🕐 **Last Synced**: ${status.lastSyncedAt?.toLocaleString() || 'Never'}
    `.trim();
  }
}

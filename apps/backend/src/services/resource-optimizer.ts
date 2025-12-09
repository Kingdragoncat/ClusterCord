import { K8sClient } from '@clustercord/k8s-sdk';

export interface ResourceRecommendation {
  resource: string;
  type: 'cpu' | 'memory';
  current: {
    request?: string;
    limit?: string;
  };
  recommended: {
    request: string;
    limit: string;
  };
  savings: {
    cpu?: string;
    memory?: string;
    cost?: number; // estimated monthly savings
  };
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

export interface OptimizationReport {
  namespace: string;
  totalPods: number;
  overProvisionedPods: number;
  underProvisionedPods: number;
  recommendations: ResourceRecommendation[];
  estimatedMonthlySavings: number;
  wastePercentage: number;
}

/**
 * Resource Optimizer - Analyze and optimize cluster resource allocation
 */
export class ResourceOptimizer {
  /**
   * Analyze namespace and provide optimization recommendations
   */
  async analyzeNamespace(
    client: K8sClient,
    namespace: string
  ): Promise<OptimizationReport> {
    const coreApi = client.getCoreV1Api();
    const appsApi = client.getAppsV1Api();

    // Get all deployments
    const deploymentsResponse = await appsApi.listNamespacedDeployment(namespace);
    const deployments = deploymentsResponse.body.items;

    // Get pod metrics (requires metrics-server)
    let podMetrics: any[] = [];
    try {
      const metricsApi = client.getKubeConfig().makeApiClient(client as any);
      // TODO: Implement metrics fetching
      podMetrics = [];
    } catch (error) {
      console.warn('Metrics server not available');
    }

    const recommendations: ResourceRecommendation[] = [];
    let overProvisionedCount = 0;
    let underProvisionedCount = 0;

    for (const deployment of deployments) {
      const containers = deployment.spec?.template.spec?.containers || [];

      for (const container of containers) {
        const resources = container.resources || {};
        const requests = resources.requests || {};
        const limits = resources.limits || {};

        // Check for common anti-patterns
        const rec = this.analyzeContainer(
          `${deployment.metadata?.name}/${container.name}`,
          requests,
          limits
        );

        if (rec) {
          recommendations.push(rec);
          if (rec.priority === 'high') {
            overProvisionedCount++;
          }
        }
      }
    }

    // Calculate waste percentage
    const wastePercentage = this.calculateWastePercentage(recommendations);

    return {
      namespace,
      totalPods: deployments.length,
      overProvisionedPods: overProvisionedCount,
      underProvisionedPods: underProvisionedCount,
      recommendations,
      estimatedMonthlySavings: this.calculateSavings(recommendations),
      wastePercentage
    };
  }

  /**
   * Analyze individual container resources
   */
  private analyzeContainer(
    resourceName: string,
    requests: any,
    limits: any
  ): ResourceRecommendation | null {
    const cpuRequest = requests.cpu;
    const memRequest = requests.memory;
    const cpuLimit = limits.cpu;
    const memLimit = limits.memory;

    // Anti-pattern: No resource requests/limits
    if (!cpuRequest && !memRequest && !cpuLimit && !memLimit) {
      return {
        resource: resourceName,
        type: 'cpu',
        current: {},
        recommended: {
          request: '100m',
          limit: '200m'
        },
        savings: {
          cpu: '0m',
          memory: '0Mi'
        },
        reason: 'No resource requests or limits set - risks node exhaustion',
        priority: 'high'
      };
    }

    // Anti-pattern: Huge limits without requests
    if (cpuLimit && !cpuRequest) {
      return {
        resource: resourceName,
        type: 'cpu',
        current: {
          limit: cpuLimit
        },
        recommended: {
          request: this.calculateOptimalRequest(cpuLimit),
          limit: cpuLimit
        },
        savings: {},
        reason: 'CPU limit without request - pod may be evicted unnecessarily',
        priority: 'medium'
      };
    }

    // Anti-pattern: Request = Limit (QoS Guaranteed when not needed)
    if (cpuRequest === cpuLimit && memRequest === memLimit) {
      const cpuMillis = this.parseResourceValue(cpuRequest, 'cpu');
      if (cpuMillis > 1000) {
        // > 1 CPU
        return {
          resource: resourceName,
          type: 'cpu',
          current: {
            request: cpuRequest,
            limit: cpuLimit
          },
          recommended: {
            request: cpuRequest,
            limit: this.calculateOptimalLimit(cpuRequest, 1.5)
          },
          savings: {
            cpu: `${cpuMillis * 0.33}m`
          },
          reason: 'Request=Limit forces Guaranteed QoS - allow bursting for better efficiency',
          priority: 'medium'
        };
      }
    }

    // Anti-pattern: Excessive memory limits
    const memMillis = this.parseResourceValue(memLimit, 'memory');
    if (memMillis > 4 * 1024 * 1024 * 1024) {
      // > 4GB
      return {
        resource: resourceName,
        type: 'memory',
        current: {
          request: memRequest,
          limit: memLimit
        },
        recommended: {
          request: memRequest || '512Mi',
          limit: '2Gi'
        },
        savings: {
          memory: `${(memMillis - 2 * 1024 * 1024 * 1024) / (1024 * 1024)}Mi`,
          cost: 15 // estimated monthly savings
        },
        reason: 'Excessive memory limit - likely over-provisioned',
        priority: 'high'
      };
    }

    return null;
  }

  /**
   * Calculate optimal request from limit
   */
  private calculateOptimalRequest(limit: string): string {
    const value = this.parseResourceValue(limit, 'cpu');
    const optimal = Math.floor(value * 0.6); // 60% of limit
    return `${optimal}m`;
  }

  /**
   * Calculate optimal limit from request
   */
  private calculateOptimalLimit(request: string, multiplier: number): string {
    const value = this.parseResourceValue(request, 'cpu');
    const optimal = Math.floor(value * multiplier);
    return `${optimal}m`;
  }

  /**
   * Parse resource value to base units (millicores for CPU, bytes for memory)
   */
  private parseResourceValue(value: string | undefined, type: 'cpu' | 'memory'): number {
    if (!value) return 0;

    if (type === 'cpu') {
      if (value.endsWith('m')) {
        return parseInt(value.slice(0, -1));
      }
      return parseFloat(value) * 1000;
    } else {
      const units: Record<string, number> = {
        Ki: 1024,
        Mi: 1024 * 1024,
        Gi: 1024 * 1024 * 1024,
        Ti: 1024 * 1024 * 1024 * 1024,
        K: 1000,
        M: 1000 * 1000,
        G: 1000 * 1000 * 1000,
        T: 1000 * 1000 * 1000 * 1000
      };

      for (const [suffix, multiplier] of Object.entries(units)) {
        if (value.endsWith(suffix)) {
          return parseInt(value.slice(0, -suffix.length)) * multiplier;
        }
      }

      return parseInt(value);
    }
  }

  /**
   * Calculate total waste percentage
   */
  private calculateWastePercentage(recommendations: ResourceRecommendation[]): number {
    // Simplified calculation - in reality would use actual metrics
    const highPriorityCount = recommendations.filter((r) => r.priority === 'high').length;
    const totalRecommendations = recommendations.length;

    if (totalRecommendations === 0) return 0;

    return Math.round((highPriorityCount / totalRecommendations) * 100);
  }

  /**
   * Calculate estimated monthly savings
   */
  private calculateSavings(recommendations: ResourceRecommendation[]): number {
    return recommendations.reduce((total, rec) => {
      return total + (rec.savings.cost || 0);
    }, 0);
  }

  /**
   * Generate optimization YAML patch
   */
  generatePatch(recommendation: ResourceRecommendation): string {
    return `
# Optimization for ${recommendation.resource}
# Priority: ${recommendation.priority}
# Reason: ${recommendation.reason}

spec:
  template:
    spec:
      containers:
      - name: container-name
        resources:
          requests:
            ${recommendation.type}: ${recommendation.recommended.request}
          limits:
            ${recommendation.type}: ${recommendation.recommended.limit}
`;
  }

  /**
   * Common optimization presets
   */
  static getPresets() {
    return {
      'micro-service': {
        cpu: { request: '50m', limit: '200m' },
        memory: { request: '64Mi', limit: '256Mi' }
      },
      'api-backend': {
        cpu: { request: '100m', limit: '500m' },
        memory: { request: '256Mi', limit: '1Gi' }
      },
      'web-frontend': {
        cpu: { request: '50m', limit: '100m' },
        memory: { request: '128Mi', limit: '512Mi' }
      },
      'database': {
        cpu: { request: '500m', limit: '2000m' },
        memory: { request: '1Gi', limit: '4Gi' }
      },
      'worker-queue': {
        cpu: { request: '200m', limit: '1000m' },
        memory: { request: '512Mi', limit: '2Gi' }
      },
      'batch-job': {
        cpu: { request: '1000m', limit: '4000m' },
        memory: { request: '2Gi', limit: '8Gi' }
      }
    };
  }
}

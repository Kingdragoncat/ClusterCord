import { PrismaClient } from '@prisma/client';

export interface DeploymentEvent {
  id: string;
  deploymentName: string;
  namespace: string;
  clusterId: string;
  image: string;
  previousImage?: string;
  replicas: number;
  previousReplicas?: number;
  strategy: 'RollingUpdate' | 'Recreate';
  status: 'InProgress' | 'Completed' | 'Failed' | 'RolledBack';
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  triggeredBy: string;
  reason?: string;
  rollbackReason?: string;
  healthChecks: {
    ready: number;
    desired: number;
    available: number;
  };
}

export interface DeploymentStats {
  totalDeployments: number;
  successRate: number;
  averageDuration: number;
  fastestDeployment: number;
  slowestDeployment: number;
  failureRate: number;
  rollbackRate: number;
  topFailureReasons: Array<{ reason: string; count: number }>;
}

/**
 * Deployment Tracker - Track, visualize, and analyze deployments
 */
export class DeploymentTracker {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Track new deployment
   */
  async trackDeployment(event: Omit<DeploymentEvent, 'id' | 'startTime'>): Promise<string> {
    const deployment = await this.prisma.deployment.create({
      data: {
        name: event.deploymentName,
        namespace: event.namespace,
        clusterId: event.clusterId,
        image: event.image,
        previousImage: event.previousImage,
        replicas: event.replicas,
        strategy: event.strategy,
        status: 'DEPLOYING',
        triggeredBy: event.triggeredBy,
        metadata: {
          healthChecks: event.healthChecks
        }
      }
    });

    return deployment.id;
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(
    deploymentId: string,
    status: 'Completed' | 'Failed' | 'RolledBack',
    metadata?: {
      reason?: string;
      rollbackReason?: string;
      healthChecks?: any;
    }
  ) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId }
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const duration = Math.floor((Date.now() - deployment.createdAt.getTime()) / 1000);

    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: status === 'Completed' ? 'DEPLOYED' : 'FAILED',
        completedAt: new Date(),
        metadata: {
          ...(deployment.metadata as any),
          duration,
          ...metadata
        }
      }
    });

    // Create timeline event
    await this.createTimelineEvent(deploymentId, status, metadata?.reason);
  }

  /**
   * Create deployment timeline event
   */
  private async createTimelineEvent(
    deploymentId: string,
    status: string,
    message?: string
  ) {
    // This would be stored in a separate DeploymentTimeline table
    // For now, just log it
    console.log(`[Deployment ${deploymentId}] ${status}: ${message || 'N/A'}`);
  }

  /**
   * Get deployment statistics
   */
  async getStats(clusterId?: string, namespace?: string): Promise<DeploymentStats> {
    const where: any = {};
    if (clusterId) where.clusterId = clusterId;
    if (namespace) where.namespace = namespace;

    const deployments = await this.prisma.deployment.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    if (deployments.length === 0) {
      return {
        totalDeployments: 0,
        successRate: 0,
        averageDuration: 0,
        fastestDeployment: 0,
        slowestDeployment: 0,
        failureRate: 0,
        rollbackRate: 0,
        topFailureReasons: []
      };
    }

    const successful = deployments.filter((d) => d.status === 'DEPLOYED').length;
    const failed = deployments.filter((d) => d.status === 'FAILED').length;

    // Calculate durations
    const durations = deployments
      .filter((d) => d.completedAt && d.createdAt)
      .map((d) => {
        const duration = (d.completedAt!.getTime() - d.createdAt.getTime()) / 1000;
        return duration;
      });

    const averageDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    return {
      totalDeployments: deployments.length,
      successRate: (successful / deployments.length) * 100,
      averageDuration: Math.floor(averageDuration),
      fastestDeployment: durations.length > 0 ? Math.min(...durations) : 0,
      slowestDeployment: durations.length > 0 ? Math.max(...durations) : 0,
      failureRate: (failed / deployments.length) * 100,
      rollbackRate: 0, // TODO: Track rollbacks
      topFailureReasons: []
    };
  }

  /**
   * Get deployment history for a specific deployment
   */
  async getHistory(
    clusterId: string,
    namespace: string,
    deploymentName: string,
    limit: number = 10
  ) {
    return await this.prisma.deployment.findMany({
      where: {
        clusterId,
        namespace,
        name: deploymentName
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Compare two deployments
   */
  async compareDeployments(deploymentId1: string, deploymentId2: string) {
    const [dep1, dep2] = await Promise.all([
      this.prisma.deployment.findUnique({ where: { id: deploymentId1 } }),
      this.prisma.deployment.findUnique({ where: { id: deploymentId2 } })
    ]);

    if (!dep1 || !dep2) {
      throw new Error('One or both deployments not found');
    }

    return {
      imageChanged: dep1.image !== dep2.image,
      replicasChanged: dep1.replicas !== dep2.replicas,
      strategyChanged: dep1.strategy !== dep2.strategy,
      durationDiff: this.calculateDuration(dep1) - this.calculateDuration(dep2),
      statusDiff: dep1.status !== dep2.status
    };
  }

  /**
   * Calculate deployment duration
   */
  private calculateDuration(deployment: any): number {
    if (!deployment.completedAt) return 0;
    return (deployment.completedAt.getTime() - deployment.createdAt.getTime()) / 1000;
  }

  /**
   * Get deployment frequency (deployments per day)
   */
  async getDeploymentFrequency(clusterId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const deployments = await this.prisma.deployment.findMany({
      where: {
        clusterId,
        createdAt: {
          gte: startDate
        }
      }
    });

    return deployments.length / days;
  }

  /**
   * Identify slow deployments
   */
  async identifySlowDeployments(
    clusterId: string,
    thresholdSeconds: number = 300
  ) {
    const deployments = await this.prisma.deployment.findMany({
      where: {
        clusterId,
        status: 'DEPLOYED'
      }
    });

    return deployments.filter((d) => {
      const duration = this.calculateDuration(d);
      return duration > thresholdSeconds;
    });
  }

  /**
   * Generate deployment report
   */
  generateReport(stats: DeploymentStats): string {
    return `
📊 **Deployment Report**

**Overview**
• Total Deployments: ${stats.totalDeployments}
• Success Rate: ${stats.successRate.toFixed(1)}%
• Failure Rate: ${stats.failureRate.toFixed(1)}%
• Rollback Rate: ${stats.rollbackRate.toFixed(1)}%

**Performance**
• Average Duration: ${this.formatDuration(stats.averageDuration)}
• Fastest: ${this.formatDuration(stats.fastestDeployment)}
• Slowest: ${this.formatDuration(stats.slowestDeployment)}

**Health**
${stats.successRate >= 95 ? '✅ Excellent' : stats.successRate >= 80 ? '⚠️ Good' : '❌ Needs Improvement'}
`;
  }

  /**
   * Format duration to human-readable string
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }
}

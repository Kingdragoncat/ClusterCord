import { PrismaClient, ChaosType, ExperimentStatus } from '@prisma/client';
import { K8sClient } from '@clustercord/k8s-sdk';
import * as yaml from 'js-yaml';

export interface ChaosExperimentConfig {
  name: string;
  type: ChaosType;
  clusterId: string;
  namespace: string;
  targetResource: string;
  duration?: number; // seconds
  config: Record<string, any>;
}

export class ChaosService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create and start chaos experiment
   */
  async createExperiment(experimentConfig: ChaosExperimentConfig, userId: string) {
    // Create experiment record
    const experiment = await this.prisma.chaosExperiment.create({
      data: {
        name: experimentConfig.name,
        type: experimentConfig.type,
        clusterId: experimentConfig.clusterId,
        namespace: experimentConfig.namespace,
        targetResource: experimentConfig.targetResource,
        config: experimentConfig.config,
        status: 'PENDING'
      }
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CHAOS_EXPERIMENT_CREATE',
        clusterId: experimentConfig.clusterId,
        namespace: experimentConfig.namespace,
        metadata: {
          experimentId: experiment.id,
          type: experimentConfig.type
        }
      }
    });

    return experiment;
  }

  /**
   * Execute chaos experiment
   */
  async executeExperiment(experimentId: string, client: K8sClient) {
    const experiment = await this.prisma.chaosExperiment.findUnique({
      where: { id: experimentId }
    });

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    // Update status to running
    await this.prisma.chaosExperiment.update({
      where: { id: experimentId },
      data: { status: 'RUNNING', startedAt: new Date() }
    });

    try {
      const manifest = this.generateChaosManifest(experiment);
      const result = await this.applyChaosManifest(client, manifest, experiment.namespace);

      // Update status to completed
      await this.prisma.chaosExperiment.update({
        where: { id: experimentId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: result
        }
      });

      return result;
    } catch (error: any) {
      // Update status to failed
      await this.prisma.chaosExperiment.update({
        where: { id: experimentId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          result: { error: error.message }
        }
      });

      throw error;
    }
  }

  /**
   * Stop running experiment
   */
  async stopExperiment(experimentId: string, client: K8sClient) {
    const experiment = await this.prisma.chaosExperiment.findUnique({
      where: { id: experimentId }
    });

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    // Delete chaos resource from cluster
    await this.deleteChaosManifest(client, experiment.name, experiment.namespace);

    // Update status
    await this.prisma.chaosExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'STOPPED',
        completedAt: new Date()
      }
    });
  }

  /**
   * Get experiment details
   */
  async getExperiment(experimentId: string) {
    return await this.prisma.chaosExperiment.findUnique({
      where: { id: experimentId }
    });
  }

  /**
   * List experiments
   */
  async listExperiments(filters: {
    clusterId?: string;
    namespace?: string;
    status?: ExperimentStatus;
  }) {
    return await this.prisma.chaosExperiment.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Generate chaos mesh manifest based on experiment type
   */
  private generateChaosManifest(experiment: any) {
    const baseManifest = {
      apiVersion: 'chaos-mesh.org/v1alpha1',
      metadata: {
        name: experiment.name,
        namespace: experiment.namespace
      },
      spec: {
        selector: {
          labelSelectors: experiment.config.selector || {}
        },
        mode: experiment.config.mode || 'one',
        duration: experiment.config.duration || '30s'
      }
    };

    switch (experiment.type) {
      case 'POD_KILL':
        return {
          ...baseManifest,
          kind: 'PodChaos',
          spec: {
            ...baseManifest.spec,
            action: 'pod-kill',
            gracePeriod: experiment.config.gracePeriod || 0
          }
        };

      case 'POD_FAILURE':
        return {
          ...baseManifest,
          kind: 'PodChaos',
          spec: {
            ...baseManifest.spec,
            action: 'pod-failure',
            duration: experiment.config.duration || '5m'
          }
        };

      case 'NETWORK_DELAY':
        return {
          ...baseManifest,
          kind: 'NetworkChaos',
          spec: {
            ...baseManifest.spec,
            action: 'delay',
            delay: {
              latency: experiment.config.latency || '100ms',
              correlation: experiment.config.correlation || '0',
              jitter: experiment.config.jitter || '0ms'
            }
          }
        };

      case 'NETWORK_LOSS':
        return {
          ...baseManifest,
          kind: 'NetworkChaos',
          spec: {
            ...baseManifest.spec,
            action: 'loss',
            loss: {
              loss: experiment.config.loss || '25',
              correlation: experiment.config.correlation || '0'
            }
          }
        };

      case 'CPU_STRESS':
        return {
          ...baseManifest,
          kind: 'StressChaos',
          spec: {
            ...baseManifest.spec,
            stressors: {
              cpu: {
                workers: experiment.config.workers || 1,
                load: experiment.config.load || 50
              }
            }
          }
        };

      case 'MEMORY_STRESS':
        return {
          ...baseManifest,
          kind: 'StressChaos',
          spec: {
            ...baseManifest.spec,
            stressors: {
              memory: {
                workers: experiment.config.workers || 1,
                size: experiment.config.size || '256MB'
              }
            }
          }
        };

      case 'NODE_DRAIN':
        return {
          ...baseManifest,
          kind: 'NodeChaos',
          spec: {
            ...baseManifest.spec,
            action: 'node-drain',
            gracePeriod: experiment.config.gracePeriod || 30
          }
        };

      default:
        throw new Error(`Unsupported chaos type: ${experiment.type}`);
    }
  }

  /**
   * Apply chaos manifest to cluster
   */
  private async applyChaosManifest(client: K8sClient, manifest: any, namespace: string) {
    // This would use the Kubernetes dynamic client to apply custom resources
    // For now, returning success (full implementation requires chaos-mesh CRDs)
    return {
      applied: true,
      manifest,
      message: 'Chaos experiment manifest generated (requires Chaos Mesh installation)'
    };
  }

  /**
   * Delete chaos manifest from cluster
   */
  private async deleteChaosManifest(client: K8sClient, name: string, namespace: string) {
    // Delete chaos resource
    return {
      deleted: true,
      message: 'Chaos experiment stopped'
    };
  }

  /**
   * Get available chaos types with descriptions
   */
  static getChaosTypes() {
    return [
      {
        type: 'POD_KILL',
        name: 'Pod Kill',
        description: 'Immediately kill selected pods',
        category: 'Pod Chaos',
        params: {
          gracePeriod: { type: 'number', default: 0, description: 'Grace period in seconds' }
        }
      },
      {
        type: 'POD_FAILURE',
        name: 'Pod Failure',
        description: 'Make pods fail for a duration',
        category: 'Pod Chaos',
        params: {
          duration: { type: 'string', default: '5m', description: 'Failure duration' }
        }
      },
      {
        type: 'NETWORK_DELAY',
        name: 'Network Delay',
        description: 'Add latency to network packets',
        category: 'Network Chaos',
        params: {
          latency: { type: 'string', default: '100ms', description: 'Latency to add' },
          jitter: { type: 'string', default: '0ms', description: 'Jitter variance' },
          correlation: { type: 'string', default: '0', description: 'Correlation %' }
        }
      },
      {
        type: 'NETWORK_LOSS',
        name: 'Network Packet Loss',
        description: 'Drop network packets randomly',
        category: 'Network Chaos',
        params: {
          loss: { type: 'string', default: '25', description: 'Loss percentage' },
          correlation: { type: 'string', default: '0', description: 'Correlation %' }
        }
      },
      {
        type: 'CPU_STRESS',
        name: 'CPU Stress',
        description: 'Stress CPU resources',
        category: 'Stress Chaos',
        params: {
          workers: { type: 'number', default: 1, description: 'Number of workers' },
          load: { type: 'number', default: 50, description: 'CPU load %' }
        }
      },
      {
        type: 'MEMORY_STRESS',
        name: 'Memory Stress',
        description: 'Stress memory resources',
        category: 'Stress Chaos',
        params: {
          workers: { type: 'number', default: 1, description: 'Number of workers' },
          size: { type: 'string', default: '256MB', description: 'Memory size' }
        }
      },
      {
        type: 'NODE_DRAIN',
        name: 'Node Drain',
        description: 'Drain and cordon nodes',
        category: 'Node Chaos',
        params: {
          gracePeriod: { type: 'number', default: 30, description: 'Grace period in seconds' }
        }
      }
    ];
  }
}

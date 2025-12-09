import { PrismaClient, TemplateCategory } from '@prisma/client';
import { K8sClient } from '@clustercord/k8s-sdk';
import * as yaml from 'js-yaml';

export interface TemplateVariable {
  name: string;
  description: string;
  default?: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
}

export interface TemplateManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
  };
  spec?: any;
}

export class TemplateService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get all templates by category
   */
  async getTemplates(category?: TemplateCategory) {
    return await this.prisma.clusterTemplate.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ verified: 'desc' }, { popularity: 'desc' }]
    });
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string) {
    return await this.prisma.clusterTemplate.findUnique({
      where: { id }
    });
  }

  /**
   * Deploy template to cluster
   */
  async deployTemplate(
    templateId: string,
    client: K8sClient,
    namespace: string,
    variables: Record<string, any> = {}
  ) {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const manifests = template.manifests as TemplateManifest[];
    const helmCharts = template.helmCharts as any[];

    const results: any[] = [];

    // Apply Kubernetes manifests
    for (const manifest of manifests) {
      try {
        // Replace variables
        const processedManifest = this.replaceVariables(manifest, variables);

        // Set namespace
        if (!processedManifest.metadata.namespace) {
          processedManifest.metadata.namespace = namespace;
        }

        // Apply manifest
        const result = await this.applyManifest(client, processedManifest);
        results.push({
          type: 'manifest',
          name: processedManifest.metadata.name,
          kind: processedManifest.kind,
          status: 'applied',
          result
        });
      } catch (error: any) {
        results.push({
          type: 'manifest',
          name: manifest.metadata.name,
          kind: manifest.kind,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Install Helm charts (if any)
    if (helmCharts && helmCharts.length > 0) {
      for (const chart of helmCharts) {
        try {
          // TODO: Implement Helm chart installation
          results.push({
            type: 'helm',
            name: chart.name,
            chart: chart.chart,
            status: 'pending',
            message: 'Helm integration not yet implemented'
          });
        } catch (error: any) {
          results.push({
            type: 'helm',
            name: chart.name,
            status: 'failed',
            error: error.message
          });
        }
      }
    }

    // Create deployment record
    const deployment = await this.prisma.templateDeployment.create({
      data: {
        templateId,
        namespace,
        variables,
        status: results.some((r) => r.status === 'failed') ? 'FAILED' : 'DEPLOYED'
      }
    });

    // Increment popularity
    await this.prisma.clusterTemplate.update({
      where: { id: templateId },
      data: { popularity: { increment: 1 } }
    });

    return {
      deploymentId: deployment.id,
      results
    };
  }

  /**
   * Replace variables in manifest
   */
  private replaceVariables(manifest: any, variables: Record<string, any>): any {
    const manifestStr = JSON.stringify(manifest);
    let processed = manifestStr;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      processed = processed.replace(regex, String(value));
    }

    return JSON.parse(processed);
  }

  /**
   * Apply manifest to cluster
   */
  private async applyManifest(client: K8sClient, manifest: TemplateManifest) {
    const { kind, metadata } = manifest;
    const namespace = metadata.namespace || 'default';

    const coreApi = client.getCoreV1Api();
    const appsApi = client.getAppsV1Api();

    switch (kind) {
      case 'Deployment':
        return await appsApi.createNamespacedDeployment(namespace, manifest as any);

      case 'Service':
        return await coreApi.createNamespacedService(namespace, manifest as any);

      case 'ConfigMap':
        return await coreApi.createNamespacedConfigMap(namespace, manifest as any);

      case 'Secret':
        return await coreApi.createNamespacedSecret(namespace, manifest as any);

      case 'PersistentVolumeClaim':
        return await coreApi.createNamespacedPersistentVolumeClaim(
          namespace,
          manifest as any
        );

      default:
        throw new Error(`Unsupported resource kind: ${kind}`);
    }
  }

  /**
   * Get built-in templates
   */
  static getBuiltInTemplates() {
    return BUILTIN_TEMPLATES;
  }

  /**
   * Initialize built-in templates
   */
  async initializeBuiltInTemplates() {
    for (const template of BUILTIN_TEMPLATES) {
      const existing = await this.prisma.clusterTemplate.findFirst({
        where: { name: template.name }
      });

      if (!existing) {
        await this.prisma.clusterTemplate.create({
          data: template
        });
      }
    }
  }
}

/**
 * Built-in homelab templates
 */
const BUILTIN_TEMPLATES = [
  {
    name: 'Minecraft Server',
    category: 'GAMING' as TemplateCategory,
    description:
      'Production-ready Minecraft Java Edition server with automatic backups and monitoring',
    manifests: [
      {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: { name: 'minecraft-data' },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '10Gi' } }
        }
      },
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'minecraft' },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: 'minecraft' } },
          template: {
            metadata: { labels: { app: 'minecraft' } },
            spec: {
              containers: [
                {
                  name: 'minecraft',
                  image: 'itzg/minecraft-server:latest',
                  env: [
                    { name: 'EULA', value: 'TRUE' },
                    { name: 'VERSION', value: '{{VERSION}}' },
                    { name: 'MEMORY', value: '{{MEMORY}}' },
                    { name: 'DIFFICULTY', value: '{{DIFFICULTY}}' },
                    { name: 'MAX_PLAYERS', value: '{{MAX_PLAYERS}}' }
                  ],
                  ports: [{ containerPort: 25565, name: 'minecraft' }],
                  volumeMounts: [{ name: 'data', mountPath: '/data' }],
                  resources: {
                    requests: { memory: '2Gi', cpu: '1' },
                    limits: { memory: '4Gi', cpu: '2' }
                  }
                }
              ],
              volumes: [
                {
                  name: 'data',
                  persistentVolumeClaim: { claimName: 'minecraft-data' }
                }
              ]
            }
          }
        }
      },
      {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: 'minecraft' },
        spec: {
          type: 'LoadBalancer',
          ports: [{ port: 25565, targetPort: 25565, name: 'minecraft' }],
          selector: { app: 'minecraft' }
        }
      }
    ],
    helmCharts: [],
    popularity: 0,
    verified: true
  },
  {
    name: 'Plex Media Server',
    category: 'MEDIA' as TemplateCategory,
    description: 'Complete Plex media server with hardware transcoding support',
    manifests: [
      {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: { name: 'plex-config' },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '20Gi' } }
        }
      },
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'plex' },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: 'plex' } },
          template: {
            metadata: { labels: { app: 'plex' } },
            spec: {
              containers: [
                {
                  name: 'plex',
                  image: 'linuxserver/plex:latest',
                  env: [
                    { name: 'PUID', value: '1000' },
                    { name: 'PGID', value: '1000' },
                    { name: 'TZ', value: '{{TIMEZONE}}' },
                    { name: 'PLEX_CLAIM', value: '{{PLEX_CLAIM}}' }
                  ],
                  ports: [
                    { containerPort: 32400, name: 'plex' },
                    { containerPort: 1900, protocol: 'UDP', name: 'dlna-udp' },
                    { containerPort: 32469, name: 'dlna-tcp' }
                  ],
                  volumeMounts: [
                    { name: 'config', mountPath: '/config' },
                    { name: 'media', mountPath: '/media' }
                  ],
                  resources: {
                    requests: { memory: '2Gi', cpu: '1' },
                    limits: { memory: '8Gi', cpu: '4' }
                  }
                }
              ],
              volumes: [
                {
                  name: 'config',
                  persistentVolumeClaim: { claimName: 'plex-config' }
                },
                {
                  name: 'media',
                  hostPath: { path: '{{MEDIA_PATH}}', type: 'Directory' }
                }
              ]
            }
          }
        }
      },
      {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: 'plex' },
        spec: {
          type: 'LoadBalancer',
          ports: [
            { port: 32400, targetPort: 32400, name: 'plex' },
            { port: 1900, protocol: 'UDP', targetPort: 1900, name: 'dlna-udp' }
          ],
          selector: { app: 'plex' }
        }
      }
    ],
    helmCharts: [],
    popularity: 0,
    verified: true
  },
  {
    name: 'GitLab CE',
    category: 'DEVELOPMENT' as TemplateCategory,
    description: 'Self-hosted GitLab Community Edition with CI/CD runners',
    manifests: [
      {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: { name: 'gitlab-config' },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '10Gi' } }
        }
      },
      {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: { name: 'gitlab-data' },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '50Gi' } }
        }
      },
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'gitlab' },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: 'gitlab' } },
          template: {
            metadata: { labels: { app: 'gitlab' } },
            spec: {
              containers: [
                {
                  name: 'gitlab',
                  image: 'gitlab/gitlab-ce:latest',
                  env: [
                    { name: 'GITLAB_OMNIBUS_CONFIG', value: "external_url '{{EXTERNAL_URL}}'" }
                  ],
                  ports: [
                    { containerPort: 80, name: 'http' },
                    { containerPort: 443, name: 'https' },
                    { containerPort: 22, name: 'ssh' }
                  ],
                  volumeMounts: [
                    { name: 'config', mountPath: '/etc/gitlab' },
                    { name: 'data', mountPath: '/var/opt/gitlab' }
                  ],
                  resources: {
                    requests: { memory: '4Gi', cpu: '2' },
                    limits: { memory: '8Gi', cpu: '4' }
                  }
                }
              ],
              volumes: [
                {
                  name: 'config',
                  persistentVolumeClaim: { claimName: 'gitlab-config' }
                },
                {
                  name: 'data',
                  persistentVolumeClaim: { claimName: 'gitlab-data' }
                }
              ]
            }
          }
        }
      },
      {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: 'gitlab' },
        spec: {
          type: 'LoadBalancer',
          ports: [
            { port: 80, targetPort: 80, name: 'http' },
            { port: 443, targetPort: 443, name: 'https' },
            { port: 22, targetPort: 22, name: 'ssh' }
          ],
          selector: { app: 'gitlab' }
        }
      }
    ],
    helmCharts: [],
    popularity: 0,
    verified: true
  },
  {
    name: 'Full Monitoring Stack',
    category: 'MONITORING' as TemplateCategory,
    description:
      'Complete observability: Prometheus, Grafana, Loki, and Alertmanager',
    manifests: [],
    helmCharts: [
      {
        name: 'prometheus',
        chart: 'prometheus-community/kube-prometheus-stack',
        version: 'latest',
        values: {
          grafana: { enabled: true, adminPassword: '{{GRAFANA_PASSWORD}}' },
          prometheus: { prometheusSpec: { retention: '30d' } },
          alertmanager: { enabled: true }
        }
      },
      {
        name: 'loki',
        chart: 'grafana/loki-stack',
        version: 'latest',
        values: {
          loki: { persistence: { enabled: true, size: '50Gi' } },
          promtail: { enabled: true }
        }
      }
    ],
    popularity: 0,
    verified: true
  },
  {
    name: 'PostgreSQL HA',
    category: 'DATABASES' as TemplateCategory,
    description: 'High-availability PostgreSQL cluster with automatic failover',
    manifests: [],
    helmCharts: [
      {
        name: 'postgresql-ha',
        chart: 'bitnami/postgresql-ha',
        version: 'latest',
        values: {
          postgresql: {
            replicaCount: 3,
            password: '{{DB_PASSWORD}}',
            database: '{{DB_NAME}}'
          },
          persistence: { size: '50Gi' },
          metrics: { enabled: true }
        }
      }
    ],
    popularity: 0,
    verified: true
  }
];

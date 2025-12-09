import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed built-in templates
  console.log('Creating homelab templates...');

  const minecraftTemplate = await prisma.clusterTemplate.upsert({
    where: { name: 'minecraft-server' },
    update: {},
    create: {
      name: 'minecraft-server',
      category: 'GAMING',
      description: 'Vanilla Minecraft server with persistent world storage',
      icon: '🎮',
      manifests: {
        deployment: {
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
                    ports: [{ containerPort: 25565 }],
                    env: [
                      { name: 'EULA', value: 'TRUE' },
                      { name: 'TYPE', value: 'VANILLA' },
                      { name: 'VERSION', value: '{{ version }}' }
                    ],
                    volumeMounts: [{ name: 'data', mountPath: '/data' }]
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
        service: {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: { name: 'minecraft' },
          spec: {
            type: 'LoadBalancer',
            ports: [{ port: 25565, targetPort: 25565 }],
            selector: { app: 'minecraft' }
          }
        },
        pvc: {
          apiVersion: 'v1',
          kind: 'PersistentVolumeClaim',
          metadata: { name: 'minecraft-data' },
          spec: {
            accessModes: ['ReadWriteOnce'],
            resources: { requests: { storage: '{{ storage }}' } }
          }
        }
      },
      variables: {
        version: { type: 'string', default: '1.20.4', description: 'Minecraft version' },
        storage: { type: 'string', default: '10Gi', description: 'Storage size' }
      },
      popularity: 100,
      verified: true,
      author: 'ClusterCord'
    }
  });

  const plexTemplate = await prisma.clusterTemplate.upsert({
    where: { name: 'plex-media-server' },
    update: {},
    create: {
      name: 'plex-media-server',
      category: 'MEDIA',
      description: 'Plex Media Server with GPU transcoding support',
      icon: '🎬',
      manifests: {
        deployment: {
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
                    image: 'plexinc/pms-docker:latest',
                    ports: [{ containerPort: 32400 }],
                    env: [
                      { name: 'TZ', value: '{{ timezone }}' },
                      { name: 'PLEX_CLAIM', value: '{{ plex_claim }}' }
                    ],
                    volumeMounts: [
                      { name: 'config', mountPath: '/config' },
                      { name: 'media', mountPath: '/media' }
                    ]
                  }
                ],
                volumes: [
                  { name: 'config', persistentVolumeClaim: { claimName: 'plex-config' } },
                  { name: 'media', persistentVolumeClaim: { claimName: 'plex-media' } }
                ]
              }
            }
          }
        },
        service: {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: { name: 'plex' },
          spec: {
            type: 'LoadBalancer',
            ports: [{ port: 32400, targetPort: 32400 }],
            selector: { app: 'plex' }
          }
        }
      },
      variables: {
        timezone: { type: 'string', default: 'America/New_York', description: 'Timezone' },
        plex_claim: { type: 'string', required: true, description: 'Plex claim token' }
      },
      popularity: 90,
      verified: true,
      author: 'ClusterCord'
    }
  });

  const gitlabTemplate = await prisma.clusterTemplate.upsert({
    where: { name: 'gitlab-ce' },
    update: {},
    create: {
      name: 'gitlab-ce',
      category: 'CICD',
      description: 'GitLab Community Edition with CI/CD runners',
      icon: '🦊',
      helmCharts: [
        {
          name: 'gitlab',
          repo: 'https://charts.gitlab.io',
          chart: 'gitlab/gitlab',
          version: 'latest',
          values: {
            global: {
              hosts: {
                domain: '{{ domain }}'
              }
            },
            'gitlab-runner': {
              install: true
            }
          }
        }
      ],
      variables: {
        domain: { type: 'string', required: true, description: 'GitLab domain' }
      },
      popularity: 75,
      verified: true,
      author: 'ClusterCord'
    }
  });

  const monitoringTemplate = await prisma.clusterTemplate.upsert({
    where: { name: 'monitoring-stack' },
    update: {},
    create: {
      name: 'monitoring-stack',
      category: 'MONITORING',
      description: 'Prometheus + Grafana monitoring stack',
      icon: '📊',
      helmCharts: [
        {
          name: 'kube-prometheus-stack',
          repo: 'https://prometheus-community.github.io/helm-charts',
          chart: 'prometheus-community/kube-prometheus-stack',
          version: 'latest',
          values: {
            prometheus: {
              prometheusSpec: {
                retention: '{{ retention }}'
              }
            },
            grafana: {
              adminPassword: '{{ admin_password }}'
            }
          }
        }
      ],
      variables: {
        retention: { type: 'string', default: '15d', description: 'Metrics retention' },
        admin_password: { type: 'string', required: true, description: 'Grafana admin password' }
      },
      popularity: 85,
      verified: true,
      author: 'ClusterCord'
    }
  });

  const postgresTemplate = await prisma.clusterTemplate.upsert({
    where: { name: 'postgresql-ha' },
    update: {},
    create: {
      name: 'postgresql-ha',
      category: 'DATABASES',
      description: 'High-availability PostgreSQL cluster with replication',
      icon: '🐘',
      helmCharts: [
        {
          name: 'postgresql-ha',
          repo: 'https://charts.bitnami.com/bitnami',
          chart: 'bitnami/postgresql-ha',
          version: 'latest',
          values: {
            postgresql: {
              replicaCount: '{{ replicas }}',
              password: '{{ password }}'
            },
            persistence: {
              size: '{{ storage }}'
            }
          }
        }
      ],
      variables: {
        replicas: { type: 'number', default: 3, description: 'Number of replicas' },
        password: { type: 'string', required: true, description: 'PostgreSQL password' },
        storage: { type: 'string', default: '20Gi', description: 'Storage size per replica' }
      },
      popularity: 70,
      verified: true,
      author: 'ClusterCord'
    }
  });

  console.log(`✅ Created ${5} homelab templates`);

  // Seed command blacklist patterns
  console.log('Creating command blacklist patterns...');

  const blacklistPatterns = [
    { pattern: 'rm -rf /', isRegex: false, description: 'Prevent root deletion' },
    { pattern: 'rm -rf \\*', isRegex: true, description: 'Prevent wildcard deletion' },
    { pattern: 'dd if=/dev/zero', isRegex: false, description: 'Prevent disk wiping' },
    { pattern: 'fork.*bomb', isRegex: true, description: 'Prevent fork bombs' },
    { pattern: ':(){ :|:& };:', isRegex: false, description: 'Prevent classic fork bomb' },
    { pattern: 'wget.*\\|.*sh', isRegex: true, description: 'Prevent remote code execution' },
    { pattern: 'curl.*\\|.*bash', isRegex: true, description: 'Prevent remote code execution' }
  ];

  for (const pattern of blacklistPatterns) {
    await prisma.commandBlacklist.upsert({
      where: { pattern: pattern.pattern },
      update: {},
      create: pattern
    });
  }

  console.log(`✅ Created ${blacklistPatterns.length} blacklist patterns`);

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { K8sClient } from '@clustercord/k8s-sdk';
import { createEncryptionService } from '@clustercord/auth';

const encryption = createEncryptionService();

export default async function clusterRoutes(fastify: FastifyInstance) {
  /**
   * Add a new cluster
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, kubeconfig, discordUserId } = request.body as any;

    if (!name || !kubeconfig || !discordUserId) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      // Test cluster connection
      const client = new K8sClient({ kubeconfig });
      const isConnected = await client.testConnection();

      if (!isConnected) {
        return reply.status(400).send({ error: 'Failed to connect to cluster' });
      }

      const clusterInfo = await client.getClusterInfo();

      // Encrypt kubeconfig
      const kubeconfigEncrypted = encryption.encrypt(kubeconfig);

      // Check if cluster already exists for this user
      const existing = await fastify.prisma.cluster.findFirst({
        where: {
          ownerId: discordUserId,
          name
        }
      });

      if (existing) {
        return reply.status(409).send({ error: 'Cluster with this name already exists' });
      }

      // Create cluster record
      const cluster = await fastify.prisma.cluster.create({
        data: {
          name,
          kubeconfigEncrypted,
          ownerId: discordUserId,
          endpoint: clusterInfo.endpoint,
          context: clusterInfo.version
        }
      });

      fastify.log.info(`Cluster added: ${name} by user ${discordUserId}`);

      return {
        id: cluster.id,
        name: cluster.name,
        endpoint: cluster.endpoint
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * List clusters for a user
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { discordUserId } = request.query as any;

    if (!discordUserId) {
      return reply.status(400).send({ error: 'Missing discordUserId' });
    }

    const clusters = await fastify.prisma.cluster.findMany({
      where: { ownerId: discordUserId },
      select: {
        id: true,
        name: true,
        endpoint: true,
        createdAt: true
      }
    });

    return clusters;
  });

  /**
   * Get cluster status
   */
  fastify.get('/:name/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = request.params as any;
    const { discordUserId } = request.query as any;

    if (!discordUserId) {
      return reply.status(400).send({ error: 'Missing discordUserId' });
    }

    const cluster = await fastify.prisma.cluster.findFirst({
      where: {
        ownerId: discordUserId,
        name
      }
    });

    if (!cluster) {
      return reply.status(404).send({ error: 'Cluster not found' });
    }

    try {
      const kubeconfig = encryption.decrypt(cluster.kubeconfigEncrypted);
      const client = new K8sClient({ kubeconfig });
      const info = await client.getClusterInfo();

      return {
        name: cluster.name,
        endpoint: cluster.endpoint,
        version: info.version,
        status: 'Connected'
      };
    } catch (error: any) {
      return {
        name: cluster.name,
        endpoint: cluster.endpoint,
        version: 'Unknown',
        status: 'Disconnected'
      };
    }
  });

  /**
   * Remove a cluster
   */
  fastify.delete('/:name', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = request.params as any;
    const { discordUserId } = request.query as any;

    if (!discordUserId) {
      return reply.status(400).send({ error: 'Missing discordUserId' });
    }

    const result = await fastify.prisma.cluster.deleteMany({
      where: {
        ownerId: discordUserId,
        name
      }
    });

    if (result.count === 0) {
      return reply.status(404).send({ error: 'Cluster not found' });
    }

    fastify.log.info(`Cluster removed: ${name} by user ${discordUserId}`);

    return { success: true };
  });
}

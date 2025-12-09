import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { K8sClient } from '@clustercord/k8s-sdk';
import { createEncryptionService } from '@clustercord/auth';

const encryption = createEncryptionService();

export default async function podRoutes(fastify: FastifyInstance) {
  /**
   * List pods in a namespace
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { discordUserId, cluster, namespace } = request.query as any;

    if (!discordUserId || !cluster || !namespace) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      const clusterRecord = await fastify.prisma.cluster.findFirst({
        where: {
          ownerId: discordUserId,
          name: cluster
        }
      });

      if (!clusterRecord) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const kubeconfig = encryption.decrypt(clusterRecord.kubeconfigEncrypted);
      const client = new K8sClient({ kubeconfig });

      const pods = await client.listPods(namespace);

      return pods;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Get pod logs
   */
  fastify.get('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const { discordUserId, cluster, namespace, pod, tail, container } = request.query as any;

    if (!discordUserId || !cluster || !namespace || !pod) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      const clusterRecord = await fastify.prisma.cluster.findFirst({
        where: {
          ownerId: discordUserId,
          name: cluster
        }
      });

      if (!clusterRecord) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const kubeconfig = encryption.decrypt(clusterRecord.kubeconfigEncrypted);
      const client = new K8sClient({ kubeconfig });

      const logs = await client.getPodLogs(pod, namespace, {
        container,
        tailLines: tail ? parseInt(tail) : 100
      });

      return { logs };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Describe a pod
   */
  fastify.get('/describe', async (request: FastifyRequest, reply: FastifyReply) => {
    const { discordUserId, cluster, namespace, pod } = request.query as any;

    if (!discordUserId || !cluster || !namespace || !pod) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      const clusterRecord = await fastify.prisma.cluster.findFirst({
        where: {
          ownerId: discordUserId,
          name: cluster
        }
      });

      if (!clusterRecord) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const kubeconfig = encryption.decrypt(clusterRecord.kubeconfigEncrypted);
      const client = new K8sClient({ kubeconfig });

      const podInfo = await client.describePod(pod, namespace);

      return podInfo;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });
}

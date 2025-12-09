import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TemplateService } from '../services/template-service';
import { K8sClient } from '@clustercord/k8s-sdk';
import { createEncryptionService } from '@clustercord/auth';

const encryption = createEncryptionService();

export default async function templateRoutes(fastify: FastifyInstance) {
  const templateService = new TemplateService(fastify.prisma);

  /**
   * List all templates
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { category } = request.query as any;

    try {
      const templates = await templateService.getTemplates(category);
      return templates;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Get template by ID
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const template = await templateService.getTemplate(id);

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      return template;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Deploy template
   */
  fastify.post('/:id/deploy', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { discordUserId, cluster, namespace, variables } = request.body as any;

    if (!discordUserId || !cluster || !namespace) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      // Get cluster
      const clusterRecord = await fastify.prisma.cluster.findFirst({
        where: {
          ownerId: discordUserId,
          name: cluster
        }
      });

      if (!clusterRecord) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      // Decrypt kubeconfig
      const kubeconfig = encryption.decrypt(clusterRecord.kubeconfigEncrypted);
      const k8sClient = new K8sClient({ kubeconfig });

      // Deploy template
      const result = await templateService.deployTemplate(
        id,
        k8sClient,
        namespace,
        variables || {}
      );

      // Audit log
      await fastify.prisma.auditLog.create({
        data: {
          userId: discordUserId,
          action: 'TEMPLATE_DEPLOY',
          clusterId: clusterRecord.id,
          namespace,
          metadata: {
            templateId: id,
            deploymentId: result.deploymentId
          }
        }
      });

      return result;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Initialize built-in templates
   */
  fastify.post('/init', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await templateService.initializeBuiltInTemplates();
      return { message: 'Built-in templates initialized successfully' };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Get template categories
   */
  fastify.get('/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      categories: [
        { value: 'GAMING', label: 'Gaming', description: 'Game servers and related tools' },
        { value: 'MEDIA', label: 'Media', description: 'Media servers and streaming' },
        { value: 'DEVELOPMENT', label: 'Development', description: 'Dev tools and CI/CD' },
        { value: 'MONITORING', label: 'Monitoring', description: 'Observability stack' },
        { value: 'DATABASES', label: 'Databases', description: 'Database systems' },
        { value: 'MESSAGING', label: 'Messaging', description: 'Message queues and brokers' },
        { value: 'CICD', label: 'CI/CD', description: 'Continuous integration/deployment' },
        { value: 'STORAGE', label: 'Storage', description: 'Storage solutions' },
        { value: 'NETWORKING', label: 'Networking', description: 'Network tools' },
        { value: 'SECURITY', label: 'Security', description: 'Security tools' }
      ]
    };
  });
}

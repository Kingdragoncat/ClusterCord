import { FastifyPluginAsync } from 'fastify';
import { K8sClient } from '@clustercord/k8s-sdk';
import { authenticateUser, verifyClusterOwnership } from '../middleware/auth';
import { rateLimiters } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validation';

interface OptimizeQueryParams {
  clusterId: string;
  namespace: string;
}

const optimizerRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply rate limiting to all routes
  fastify.addHook('onRequest', rateLimiters.cluster);

  /**
   * POST /api/optimizer/analyze
   * Analyze namespace for resource optimization opportunities
   */
  fastify.post<{
    Body: OptimizeQueryParams;
  }>('/analyze', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, namespace } = request.body;

    try {
      // Get cluster from database
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      // Create K8s client
      const client = new K8sClient(cluster.kubeconfig);

      // Analyze namespace
      const report = await fastify.resourceOptimizer.analyzeNamespace(client, namespace);

      return {
        success: true,
        report
      };
    } catch (error: any) {
      // Use smart error explainer
      const explanation = fastify.errorExplainer.explain(error.message);

      return reply.status(500).send({
        error: 'Failed to analyze namespace',
        details: explanation
      });
    }
  });

  /**
   * GET /api/optimizer/presets
   * Get optimization presets
   */
  fastify.get('/presets', async (request, reply) => {
    const presets = fastify.resourceOptimizer.constructor.getPresets();

    return {
      success: true,
      presets
    };
  });

  /**
   * POST /api/optimizer/patch
   * Generate optimization patch YAML
   */
  fastify.post<{
    Body: {
      resource: string;
      type: 'cpu' | 'memory';
      current: any;
      recommended: any;
      reason: string;
      priority: string;
    };
  }>('/patch', async (request, reply) => {
    const recommendation = request.body;

    const patch = fastify.resourceOptimizer.generatePatch({
      resource: recommendation.resource,
      type: recommendation.type,
      current: recommendation.current,
      recommended: recommendation.recommended,
      savings: {},
      reason: recommendation.reason,
      priority: recommendation.priority as any
    });

    return {
      success: true,
      patch
    };
  });
};

export default optimizerRoutes;

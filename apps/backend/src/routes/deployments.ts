import { FastifyPluginAsync } from 'fastify';
import { authenticateUser, verifyClusterOwnership } from '../middleware/auth';
import { rateLimiters } from '../middleware/rate-limit';

const deploymentRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply rate limiting
  fastify.addHook('onRequest', rateLimiters.cluster);

  /**
   * POST /api/deployments/track
   * Track a new deployment
   */
  fastify.post<{
    Body: {
      deploymentName: string;
      namespace: string;
      clusterId: string;
      image: string;
      previousImage?: string;
      replicas: number;
      strategy: 'RollingUpdate' | 'Recreate';
      triggeredBy: string;
      healthChecks: {
        ready: number;
        desired: number;
        available: number;
      };
    };
  }>('/track', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    try {
      const deploymentId = await fastify.deploymentTracker.trackDeployment(request.body);

      return {
        success: true,
        deploymentId
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to track deployment',
        message: error.message
      });
    }
  });

  /**
   * PUT /api/deployments/:id/status
   * Update deployment status
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      status: 'Completed' | 'Failed' | 'RolledBack';
      reason?: string;
      rollbackReason?: string;
    };
  }>('/:id/status', {
    preHandler: [authenticateUser]
  }, async (request, reply) => {
    const { id } = request.params;
    const { status, reason, rollbackReason } = request.body;

    try {
      await fastify.deploymentTracker.updateDeploymentStatus(id, status, {
        reason,
        rollbackReason
      });

      return {
        success: true
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to update deployment status',
        message: error.message
      });
    }
  });

  /**
   * GET /api/deployments/stats
   * Get deployment statistics
   */
  fastify.get<{
    Querystring: {
      clusterId?: string;
      namespace?: string;
    };
  }>('/stats', {
    preHandler: [authenticateUser]
  }, async (request, reply) => {
    const { clusterId, namespace } = request.query;

    try {
      const stats = await fastify.deploymentTracker.getStats(clusterId, namespace);

      return {
        success: true,
        stats
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get deployment stats',
        message: error.message
      });
    }
  });

  /**
   * GET /api/deployments/history
   * Get deployment history
   */
  fastify.get<{
    Querystring: {
      clusterId: string;
      namespace: string;
      deploymentName: string;
      limit?: number;
    };
  }>('/history', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, namespace, deploymentName, limit } = request.query;

    try {
      const history = await fastify.deploymentTracker.getHistory(
        clusterId,
        namespace,
        deploymentName,
        limit ? parseInt(limit as any) : 10
      );

      return {
        success: true,
        history
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get deployment history',
        message: error.message
      });
    }
  });

  /**
   * GET /api/deployments/compare
   * Compare two deployments
   */
  fastify.get<{
    Querystring: {
      id1: string;
      id2: string;
    };
  }>('/compare', {
    preHandler: [authenticateUser]
  }, async (request, reply) => {
    const { id1, id2 } = request.query;

    try {
      const comparison = await fastify.deploymentTracker.compareDeployments(id1, id2);

      return {
        success: true,
        comparison
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to compare deployments',
        message: error.message
      });
    }
  });

  /**
   * GET /api/deployments/frequency
   * Get deployment frequency
   */
  fastify.get<{
    Querystring: {
      clusterId: string;
      days?: number;
    };
  }>('/frequency', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, days } = request.query;

    try {
      const frequency = await fastify.deploymentTracker.getDeploymentFrequency(
        clusterId,
        days ? parseInt(days as any) : 7
      );

      return {
        success: true,
        frequency,
        period: days || 7
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get deployment frequency',
        message: error.message
      });
    }
  });

  /**
   * GET /api/deployments/slow
   * Identify slow deployments
   */
  fastify.get<{
    Querystring: {
      clusterId: string;
      thresholdSeconds?: number;
    };
  }>('/slow', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, thresholdSeconds } = request.query;

    try {
      const slowDeployments = await fastify.deploymentTracker.identifySlowDeployments(
        clusterId,
        thresholdSeconds ? parseInt(thresholdSeconds as any) : 300
      );

      return {
        success: true,
        slowDeployments,
        threshold: thresholdSeconds || 300
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to identify slow deployments',
        message: error.message
      });
    }
  });

  /**
   * POST /api/deployments/report
   * Generate deployment report
   */
  fastify.post<{
    Body: {
      clusterId?: string;
      namespace?: string;
    };
  }>('/report', {
    preHandler: [authenticateUser]
  }, async (request, reply) => {
    const { clusterId, namespace } = request.body;

    try {
      const stats = await fastify.deploymentTracker.getStats(clusterId, namespace);
      const report = fastify.deploymentTracker.generateReport(stats);

      return {
        success: true,
        report,
        stats
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to generate deployment report',
        message: error.message
      });
    }
  });
};

export default deploymentRoutes;

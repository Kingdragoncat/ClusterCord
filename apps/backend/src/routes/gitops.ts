import { FastifyPluginAsync } from 'fastify';
import { K8sClient } from '@clustercord/k8s-sdk';
import { authenticateUser, verifyClusterOwnership } from '../middleware/auth';
import { rateLimiters } from '../middleware/rate-limit';
import { GitOpsService } from '../services/gitops-service';

const gitOpsService = new GitOpsService();

const gitopsRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply rate limiting
  fastify.addHook('onRequest', rateLimiters.cluster);

  /**
   * GET /api/gitops/detect
   * Detect GitOps type in cluster (ArgoCD or Flux)
   */
  fastify.get<{
    Querystring: { clusterId: string };
  }>('/detect', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId } = request.query;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const gitopsType = await gitOpsService.detectGitOpsType(client);

      return {
        success: true,
        gitopsType,
        detected: gitopsType !== null
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to detect GitOps type',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gitops/apps
   * List all GitOps applications
   */
  fastify.get<{
    Querystring: {
      clusterId: string;
      type: 'ARGOCD' | 'FLUX';
      namespace?: string;
    };
  }>('/apps', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, type, namespace } = request.query;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const apps = await gitOpsService.listGitOpsApps(client, type, namespace);

      return {
        success: true,
        apps,
        count: apps.length
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to list GitOps apps',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gitops/status
   * Get GitOps application status
   */
  fastify.get<{
    Querystring: {
      clusterId: string;
      type: 'ARGOCD' | 'FLUX';
      name: string;
      namespace: string;
    };
  }>('/status', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, type, name, namespace } = request.query;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);

      let status;
      if (type === 'ARGOCD') {
        status = await gitOpsService.getArgoCDAppStatus(client, name, namespace);
      } else {
        status = await gitOpsService.getFluxKustomizationStatus(client, name, namespace);
      }

      return {
        success: true,
        status
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get app status',
        message: error.message
      });
    }
  });

  /**
   * POST /api/gitops/sync
   * Sync GitOps application
   */
  fastify.post<{
    Body: {
      clusterId: string;
      type: 'ARGOCD' | 'FLUX';
      name: string;
      namespace: string;
      prune?: boolean;
      dryRun?: boolean;
    };
  }>('/sync', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, type, name, namespace, prune, dryRun } = request.body;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);

      let result;
      if (type === 'ARGOCD') {
        result = await gitOpsService.syncArgoCDApp(client, name, namespace, prune, dryRun);
      } else {
        result = await gitOpsService.reconcileFluxKustomization(client, name, namespace);
      }

      return {
        success: true,
        result
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to sync app',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gitops/diff
   * Show changes (drift detection)
   */
  fastify.get<{
    Querystring: {
      clusterId: string;
      name: string;
      namespace: string;
    };
  }>('/diff', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, name, namespace } = request.query;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const diff = await gitOpsService.diffArgoCDApp(client, name, namespace);

      return {
        success: true,
        diff
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to diff app',
        message: error.message
      });
    }
  });

  /**
   * POST /api/gitops/suspend
   * Suspend automatic syncing
   */
  fastify.post<{
    Body: {
      clusterId: string;
      name: string;
      namespace: string;
    };
  }>('/suspend', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, name, namespace } = request.body;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const result = await gitOpsService.suspendArgoCDApp(client, name, namespace);

      return {
        success: true,
        result
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to suspend app',
        message: error.message
      });
    }
  });

  /**
   * POST /api/gitops/resume
   * Resume automatic syncing
   */
  fastify.post<{
    Body: {
      clusterId: string;
      name: string;
      namespace: string;
    };
  }>('/resume', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, name, namespace } = request.body;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const result = await gitOpsService.resumeArgoCDApp(client, name, namespace);

      return {
        success: true,
        result
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to resume app',
        message: error.message
      });
    }
  });
};

export default gitopsRoutes;

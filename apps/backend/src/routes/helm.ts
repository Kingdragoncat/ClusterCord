import { FastifyPluginAsync } from 'fastify';
import { K8sClient } from '@clustercord/k8s-sdk';
import { authenticateUser, verifyClusterOwnership } from '../middleware/auth';
import { rateLimiters } from '../middleware/rate-limit';
import { HelmService } from '../services/helm-service';

const helmService = new HelmService();

const helmRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply rate limiting
  fastify.addHook('onRequest', rateLimiters.cluster);

  /**
   * GET /api/helm/search
   * Search ArtifactHub for Helm charts
   */
  fastify.get<{
    Querystring: { query: string; limit?: number };
  }>('/search', async (request, reply) => {
    const { query, limit } = request.query;

    try {
      const results = await helmService.searchArtifactHub(query, limit);

      return {
        success: true,
        results,
        count: results.length
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to search charts',
        message: error.message
      });
    }
  });

  /**
   * GET /api/helm/releases
   * List Helm releases
   */
  fastify.get<{
    Querystring: { clusterId: string; namespace?: string };
  }>('/releases', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, namespace } = request.query;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const releases = await helmService.listReleases(client, namespace);

      return {
        success: true,
        releases,
        count: releases.length
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to list releases',
        message: error.message
      });
    }
  });

  /**
   * GET /api/helm/releases/:name
   * Get release status
   */
  fastify.get<{
    Params: { name: string };
    Querystring: { clusterId: string; namespace: string };
  }>('/releases/:name', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { name } = request.params;
    const { clusterId, namespace } = request.query;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const release = await helmService.getRelease(client, name, namespace);

      return {
        success: true,
        release
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get release',
        message: error.message
      });
    }
  });

  /**
   * POST /api/helm/install
   * Install Helm chart
   */
  fastify.post<{
    Body: {
      clusterId: string;
      releaseName: string;
      chart: string;
      namespace: string;
      values?: any;
      createNamespace?: boolean;
    };
  }>('/install', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, releaseName, chart, namespace, values, createNamespace } = request.body;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const result = await helmService.install(
        client,
        releaseName,
        chart,
        namespace,
        values,
        createNamespace
      );

      return {
        success: true,
        ...result
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to install chart',
        message: error.message
      });
    }
  });

  /**
   * PUT /api/helm/upgrade
   * Upgrade Helm release
   */
  fastify.put<{
    Body: {
      clusterId: string;
      releaseName: string;
      chart: string;
      namespace: string;
      values?: any;
      version?: string;
    };
  }>('/upgrade', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, releaseName, chart, namespace, values, version } = request.body;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const result = await helmService.upgrade(
        client,
        releaseName,
        chart,
        namespace,
        values,
        version
      );

      return {
        success: true,
        ...result
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to upgrade release',
        message: error.message
      });
    }
  });

  /**
   * POST /api/helm/rollback
   * Rollback Helm release
   */
  fastify.post<{
    Body: {
      clusterId: string;
      releaseName: string;
      namespace: string;
      revision?: number;
    };
  }>('/rollback', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { clusterId, releaseName, namespace, revision } = request.body;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const result = await helmService.rollback(client, releaseName, namespace, revision);

      return {
        success: true,
        ...result
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to rollback release',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/helm/releases/:name
   * Uninstall Helm release
   */
  fastify.delete<{
    Params: { name: string };
    Body: {
      clusterId: string;
      namespace: string;
      keepHistory?: boolean;
    };
  }>('/releases/:name', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { name } = request.params;
    const { clusterId, namespace, keepHistory } = request.body;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const result = await helmService.uninstall(client, name, namespace, keepHistory);

      return {
        success: true,
        ...result
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to uninstall release',
        message: error.message
      });
    }
  });

  /**
   * GET /api/helm/releases/:name/values
   * Get release values
   */
  fastify.get<{
    Params: { name: string };
    Querystring: { clusterId: string; namespace: string };
  }>('/releases/:name/values', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { name } = request.params;
    const { clusterId, namespace } = request.query;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const values = await helmService.getValues(client, name, namespace);

      return {
        success: true,
        values
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get values',
        message: error.message
      });
    }
  });

  /**
   * GET /api/helm/releases/:name/history
   * Get release history
   */
  fastify.get<{
    Params: { name: string };
    Querystring: { clusterId: string; namespace: string };
  }>('/releases/:name/history', {
    preHandler: [authenticateUser, verifyClusterOwnership]
  }, async (request, reply) => {
    const { name } = request.params;
    const { clusterId, namespace } = request.query;

    try {
      const cluster = await fastify.prisma.cluster.findUnique({
        where: { id: clusterId }
      });

      if (!cluster) {
        return reply.status(404).send({ error: 'Cluster not found' });
      }

      const client = new K8sClient(cluster.kubeconfig);
      const history = await helmService.getHistory(client, name, namespace);

      return {
        success: true,
        history
      };
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get history',
        message: error.message
      });
    }
  });
};

export default helmRoutes;

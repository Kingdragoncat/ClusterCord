import { FastifyPluginAsync } from 'fastify';
import { rateLimiters } from '../middleware/rate-limit';
import os from 'os';

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply rate limiting
  fastify.addHook('onRequest', rateLimiters.general);

  /**
   * GET /api/stats
   * Get bot statistics and system health
   */
  fastify.get('/', async (request, reply) => {
    try {
      // Get database stats
      const [totalUsers, totalClusters, totalDeployments, totalSessions] = await Promise.all([
        fastify.prisma.user.count(),
        fastify.prisma.cluster.count(),
        fastify.prisma.deployment.count(),
        fastify.prisma.terminalSession.count()
      ]);

      // Get active sessions
      const activeSessions = await fastify.prisma.terminalSession.count({
        where: {
          status: 'ACTIVE'
        }
      });

      // Get recording sessions
      const recordingSessions = await fastify.prisma.terminalRecording.count({
        where: {
          expiresAt: {
            gt: new Date()
          }
        }
      });

      // Get cluster health (basic check)
      const clusters = await fastify.prisma.cluster.findMany({
        select: {
          id: true,
          name: true
        }
      });

      // System stats
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsed = totalMemory - freeMemory;
      const cpuCount = os.cpus().length;

      // Database connection test
      const dbStartTime = Date.now();
      await fastify.prisma.$queryRaw`SELECT 1`;
      const dbResponseTime = Date.now() - dbStartTime;

      return {
        success: true,
        stats: {
          totalUsers,
          totalClusters,
          totalDeployments,
          totalSessions,
          activeSessions,
          recordingSessions,
          clusters: clusters.map((c) => ({
            id: c.id,
            name: c.name,
            healthy: true // TODO: Implement actual health check
          })),
          database: {
            connected: true,
            responseTime: dbResponseTime
          },
          system: {
            memoryTotal: totalMemory,
            memoryUsed,
            memoryFree: freeMemory,
            cpuCount,
            cpuLoad: os.loadavg()[0] * 100 / cpuCount,
            uptime: os.uptime(),
            platform: os.platform(),
            nodeVersion: process.version
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      fastify.log.error('Error fetching stats:', error);

      return reply.status(500).send({
        error: 'Failed to fetch statistics',
        message: error.message
      });
    }
  });
};

export default statsRoutes;

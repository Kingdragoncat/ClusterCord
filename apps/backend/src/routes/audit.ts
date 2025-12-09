import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function auditRoutes(fastify: FastifyInstance) {
  /**
   * Export audit logs
   */
  fastify.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const { discordUserId, timeRange } = request.query as any;

    if (!discordUserId) {
      return reply.status(400).send({ error: 'Missing discordUserId' });
    }

    try {
      const user = await fastify.prisma.user.findUnique({
        where: { discordId: discordUserId }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Calculate time range
      let startDate = new Date(0); // Beginning of time
      const now = new Date();

      if (timeRange === '24h') {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (timeRange === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeRange === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const logs = await fastify.prisma.auditLog.findMany({
        where: {
          userId: user.id,
          createdAt: {
            gte: startDate
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1000 // Limit to 1000 records
      });

      return {
        logs,
        count: logs.length,
        timeRange,
        exportedAt: new Date()
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });
}

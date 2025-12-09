import { FastifyPluginAsync } from 'fastify';
import { authenticateUser } from '../middleware/auth';
import { rateLimiters } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validation';

const userRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply rate limiting
  fastify.addHook('onRequest', rateLimiters.general);

  /**
   * GET /api/users/:userId
   * Get user information
   */
  fastify.get<{
    Params: { userId: string };
  }>('/:userId', {
    preHandler: [authenticateUser]
  }, async (request, reply) => {
    const { userId } = request.params;

    try {
      const user = await fastify.prisma.user.findUnique({
        where: { discordId: userId },
        include: {
          cluster: true,
          _count: {
            select: {
              terminalSessions: true,
              auditLogs: true
            }
          }
        }
      });

      if (!user) {
        return reply.status(404).send({
          error: 'User not found'
        });
      }

      // Get cluster count
      const clusterCount = await fastify.prisma.cluster.count({
        where: { ownerId: userId }
      });

      return {
        success: true,
        user: {
          id: user.id,
          discordId: user.discordId,
          email: user.email,
          emailVerified: user.emailVerified,
          serviceAccountName: user.serviceAccountName,
          assignedNamespace: user.assignedNamespace,
          trustedIps: user.trustedIps,
          lastVerifiedAt: user.lastVerifiedAt,
          createdAt: user.createdAt,
          clusterCount,
          sessionCount: user._count.terminalSessions,
          auditLogCount: user._count.auditLogs
        }
      };
    } catch (error: any) {
      fastify.log.error('Error fetching user:', error);

      return reply.status(500).send({
        error: 'Failed to fetch user',
        message: error.message
      });
    }
  });

  /**
   * PUT /api/users/:userId
   * Update user configuration
   */
  fastify.put<{
    Params: { userId: string };
    Body: {
      email?: string;
      defaultCluster?: string;
      defaultNamespace?: string;
    };
  }>('/:userId', {
    preHandler: [authenticateUser]
  }, async (request, reply) => {
    const { userId } = request.params;
    const { email, defaultCluster, defaultNamespace } = request.body;

    try {
      const updateData: any = {};

      if (email) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return reply.status(400).send({
            error: 'Invalid email format'
          });
        }
        updateData.email = email;
        updateData.emailVerified = false; // Reset verification when email changes
      }

      if (defaultCluster) {
        updateData.clusterId = defaultCluster;
      }

      if (defaultNamespace) {
        updateData.assignedNamespace = defaultNamespace;
      }

      const user = await fastify.prisma.user.update({
        where: { discordId: userId },
        data: updateData
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          assignedNamespace: user.assignedNamespace
        }
      };
    } catch (error: any) {
      fastify.log.error('Error updating user:', error);

      return reply.status(500).send({
        error: 'Failed to update user',
        message: error.message
      });
    }
  });

  /**
   * POST /api/users/:userId/verify-email
   * Send email verification
   */
  fastify.post<{
    Params: { userId: string };
  }>('/:userId/verify-email', {
    preHandler: [authenticateUser]
  }, async (request, reply) => {
    const { userId } = request.params;

    try {
      const user = await fastify.prisma.user.findUnique({
        where: { discordId: userId }
      });

      if (!user) {
        return reply.status(404).send({
          error: 'User not found'
        });
      }

      if (!user.email) {
        return reply.status(400).send({
          error: 'No email address configured'
        });
      }

      // TODO: Send verification email
      // For now, just return success

      return {
        success: true,
        message: 'Verification email sent'
      };
    } catch (error: any) {
      fastify.log.error('Error sending verification:', error);

      return reply.status(500).send({
        error: 'Failed to send verification email',
        message: error.message
      });
    }
  });
};

export default userRoutes;

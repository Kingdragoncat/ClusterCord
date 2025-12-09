import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    discordId: string;
    id: string;
    isAdmin: boolean;
  };
}

/**
 * Simple authentication middleware for Discord user verification
 * In production, you'd use JWT or session-based auth
 */
export async function authenticateUser(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  const discordUserId =
    request.headers['x-discord-user-id'] ||
    (request.body as any)?.discordUserId ||
    (request.query as any)?.discordUserId;

  if (!discordUserId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Discord user ID required'
    });
  }

  // Fetch user from database
  const user = await request.server.prisma.user.findUnique({
    where: { discordId: discordUserId as string }
  });

  if (!user) {
    // Auto-create user on first request (optional)
    const newUser = await request.server.prisma.user.create({
      data: {
        discordId: discordUserId as string,
        email: '', // Will be set later
        emailVerified: false
      }
    });

    request.user = {
      discordId: newUser.discordId,
      id: newUser.id,
      isAdmin: false
    };
  } else {
    request.user = {
      discordId: user.discordId,
      id: user.id,
      isAdmin: false // TODO: Implement admin role check
    };
  }
}

/**
 * Verify user owns the specified cluster
 */
export async function verifyClusterOwnership(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  if (!request.user) {
    return reply.status(401).send({ error: 'Not authenticated' });
  }

  const clusterName =
    (request.params as any).name ||
    (request.params as any).cluster ||
    (request.query as any).cluster ||
    (request.body as any).cluster;

  if (!clusterName) {
    return reply.status(400).send({ error: 'Cluster name required' });
  }

  const cluster = await request.server.prisma.cluster.findFirst({
    where: {
      ownerId: request.user.id,
      name: clusterName
    }
  });

  if (!cluster) {
    return reply.status(404).send({
      error: 'Cluster not found or access denied'
    });
  }
}

/**
 * Admin-only middleware
 */
export async function requireAdmin(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  if (!request.user?.isAdmin) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
}

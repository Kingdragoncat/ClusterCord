import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Middleware
import { rateLimiters } from './middleware/rate-limit';
import { globalErrorHandler } from './middleware/error-handler';
import { logger } from './utils/logger';

// Routes
import clusterRoutes from './routes/clusters';
import podRoutes from './routes/pods';
import terminalRoutes from './routes/terminal';
import auditRoutes from './routes/audit';
import recordingRoutes from './routes/recording';
import templateRoutes from './routes/templates';
import optimizerRoutes from './routes/optimizer';
import deploymentRoutes from './routes/deployments';
import statsRoutes from './routes/stats';
import userRoutes from './routes/users';
import gitopsRoutes from './routes/gitops';
import helmRoutes from './routes/helm';

// Services - for global access
import { SmartErrorExplainer } from './services/smart-error-explainer';
import { SensitiveOutputFilter } from './services/sensitive-output-filter';
import { ApprovalFlow } from './services/approval-flow';
import { ResourceOptimizer } from './services/resource-optimizer';
import { DeploymentTracker } from './services/deployment-tracker';

dotenv.config();

const prisma = new PrismaClient();

// Initialize global services
const errorExplainer = new SmartErrorExplainer();
const outputFilter = new SensitiveOutputFilter();
const approvalFlow = new ApprovalFlow();
const resourceOptimizer = new ResourceOptimizer();
const deploymentTracker = new DeploymentTracker(prisma);

const fastify = Fastify({
  logger
});

// Register plugins
fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
});

fastify.register(websocket);

// Add Prisma and services to request context
fastify.decorate('prisma', prisma);
fastify.decorate('errorExplainer', errorExplainer);
fastify.decorate('outputFilter', outputFilter);
fastify.decorate('approvalFlow', approvalFlow);
fastify.decorate('resourceOptimizer', resourceOptimizer);
fastify.decorate('deploymentTracker', deploymentTracker);

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    errorExplainer: SmartErrorExplainer;
    outputFilter: SensitiveOutputFilter;
    approvalFlow: ApprovalFlow;
    resourceOptimizer: ResourceOptimizer;
    deploymentTracker: DeploymentTracker;
  }
}

// Apply global rate limiting
fastify.addHook('onRequest', rateLimiters.general);

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes with appropriate rate limiters
fastify.register(clusterRoutes, { prefix: '/api/clusters' });
fastify.register(podRoutes, { prefix: '/api/pods' });
fastify.register(terminalRoutes, { prefix: '/api/terminal' });
fastify.register(auditRoutes, { prefix: '/api/audit' });
fastify.register(recordingRoutes, { prefix: '/api/recordings' });
fastify.register(templateRoutes, { prefix: '/api/templates' });
fastify.register(optimizerRoutes, { prefix: '/api/optimizer' });
fastify.register(deploymentRoutes, { prefix: '/api/deployments' });
fastify.register(statsRoutes, { prefix: '/api/stats' });
fastify.register(userRoutes, { prefix: '/api/users' });
fastify.register(gitopsRoutes, { prefix: '/api/gitops' });
fastify.register(helmRoutes, { prefix: '/api/helm' });

// Global error handler (uses custom error classes)
fastify.setErrorHandler(globalErrorHandler);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  fastify.log.info('Received shutdown signal, closing server...');
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

start();

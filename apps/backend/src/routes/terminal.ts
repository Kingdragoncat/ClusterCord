import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { K8sClient, ServiceAccountManager, TokenRequestManager, RBACManager } from '@clustercord/k8s-sdk';
import { createEncryptionService, createIPHasher, OTPGenerator, defaultCommandValidator } from '@clustercord/auth';
import { createEmailService } from '../services/email';
import { TerminalRecordingService } from '../services/terminal-recording';

const encryption = createEncryptionService();
const ipHasher = createIPHasher();
const otpGenerator = new OTPGenerator({
  length: 6,
  ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '300')
});
const emailService = createEmailService();

export default async function terminalRoutes(fastify: FastifyInstance) {
  const recordingService = new TerminalRecordingService(fastify.prisma);

  /**
   * Start a terminal session
   */
  fastify.post('/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const { discordUserId, cluster, namespace, pod, container, shell } = request.body as any;

    if (!discordUserId || !cluster || !namespace || !pod) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      // Get user
      let user = await fastify.prisma.user.findUnique({
        where: { discordId: discordUserId }
      });

      if (!user) {
        // Create user on first use
        user = await fastify.prisma.user.create({
          data: {
            discordId: discordUserId,
            email: '', // Should be set via a registration flow
            emailVerified: false
          }
        });
      }

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

      // Extract and hash IP
      const userIP = ipHasher.extractIP(request);
      const currentIPHash = ipHasher.hash(userIP);

      // Check if IP is trusted
      const isTrustedIP = user.trustedIps.includes(currentIPHash);

      // If new IP, require OTP
      if (!isTrustedIP && user.emailVerified && user.email) {
        const otp = otpGenerator.generate();

        // Store OTP
        await fastify.prisma.oTPCode.create({
          data: {
            userId: user.id,
            code: otp.code,
            codeHash: otp.hash,
            ipHash: currentIPHash,
            expiresAt: otp.expiresAt
          }
        });

        // Send OTP email
        await emailService.sendOTP(user.email, otp.code, otpGenerator.getTimeRemaining(otp.expiresAt));

        fastify.log.info(`OTP sent to ${user.email} for user ${discordUserId}`);

        // Create pending session
        const session = await fastify.prisma.terminalSession.create({
          data: {
            userId: user.id,
            clusterId: clusterRecord.id,
            podName: pod,
            namespace,
            containerName: container,
            shell: shell || '/bin/sh',
            tokenExpiry: new Date(Date.now() + 600000), // 10 minutes
            ipHash: currentIPHash,
            status: 'PENDING_OTP'
          }
        });

        return {
          requiresOTP: true,
          sessionId: session.id,
          expiresAt: otp.expiresAt
        };
      }

      // Setup K8s resources
      const kubeconfig = encryption.decrypt(clusterRecord.kubeconfigEncrypted);
      const k8sClient = new K8sClient({ kubeconfig });

      const saManager = new ServiceAccountManager(k8sClient);
      const tokenManager = new TokenRequestManager(k8sClient);
      const rbacManager = new RBACManager(k8sClient);

      // Create service account and RBAC
      const serviceAccountName = `clustercord-user-${discordUserId}`;
      await saManager.createServiceAccount({
        name: serviceAccountName,
        namespace
      });

      await rbacManager.setupUserRBAC(discordUserId, namespace);

      // Request ephemeral token
      const tokenResponse = await tokenManager.requestToken({
        serviceAccount: serviceAccountName,
        namespace,
        expirationSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '600')
      });

      // Create active session
      const session = await fastify.prisma.terminalSession.create({
        data: {
          userId: user.id,
          clusterId: clusterRecord.id,
          podName: pod,
          namespace,
          containerName: container,
          shell: shell || '/bin/sh',
          tokenExpiry: tokenResponse.expiresAt,
          ipHash: currentIPHash,
          status: 'ACTIVE'
        }
      });

      // Start recording if enabled
      const recordingEnabled = process.env.TERMINAL_RECORDING_ENABLED !== 'false';
      let recordingId: string | undefined;

      if (recordingEnabled) {
        try {
          recordingId = await recordingService.startRecording(
            session.id,
            user.id,
            clusterRecord.id,
            pod,
            namespace,
            {
              width: 80,
              height: 24,
              env: { TERM: 'xterm-256color', SHELL: shell || '/bin/sh' }
            }
          );
          fastify.log.info(`Recording started: ${recordingId} for session ${session.id}`);
        } catch (error: any) {
          fastify.log.error(`Failed to start recording: ${error.message}`);
        }
      }

      // Add IP to trusted list if not already there
      if (!isTrustedIP) {
        await fastify.prisma.user.update({
          where: { id: user.id },
          data: {
            trustedIps: {
              push: currentIPHash
            }
          }
        });
      }

      fastify.log.info(`Terminal session started: ${session.id} for user ${discordUserId}`);

      // Audit log
      await fastify.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'TERMINAL_START',
          clusterId: clusterRecord.id,
          namespace,
          podName: pod,
          ipHash: currentIPHash
        }
      });

      return {
        requiresOTP: false,
        sessionId: session.id,
        expiresAt: tokenResponse.expiresAt,
        pod,
        namespace,
        container
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Verify OTP and activate session
   */
  fastify.post('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const { discordUserId, code } = request.body as any;

    if (!discordUserId || !code) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      const user = await fastify.prisma.user.findUnique({
        where: { discordId: discordUserId }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Find OTP code
      const otpRecord = await fastify.prisma.oTPCode.findFirst({
        where: {
          userId: user.id,
          verified: false,
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!otpRecord) {
        return reply.status(404).send({ error: 'No valid OTP found' });
      }

      // Verify OTP
      const isValid = otpGenerator.verify(code, otpRecord.codeHash);

      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid OTP code' });
      }

      // Mark OTP as verified
      await fastify.prisma.oTPCode.update({
        where: { id: otpRecord.id },
        data: {
          verified: true,
          verifiedAt: new Date()
        }
      });

      // Find pending session
      const session = await fastify.prisma.terminalSession.findFirst({
        where: {
          userId: user.id,
          status: 'PENDING_OTP',
          ipHash: otpRecord.ipHash
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          cluster: true
        }
      });

      if (!session) {
        return reply.status(404).send({ error: 'No pending session found' });
      }

      // Setup K8s resources
      const kubeconfig = encryption.decrypt(session.cluster.kubeconfigEncrypted);
      const k8sClient = new K8sClient({ kubeconfig });

      const saManager = new ServiceAccountManager(k8sClient);
      const tokenManager = new TokenRequestManager(k8sClient);
      const rbacManager = new RBACManager(k8sClient);

      const serviceAccountName = `clustercord-user-${discordUserId}`;
      await saManager.createServiceAccount({
        name: serviceAccountName,
        namespace: session.namespace
      });

      await rbacManager.setupUserRBAC(discordUserId, session.namespace);

      const tokenResponse = await tokenManager.requestToken({
        serviceAccount: serviceAccountName,
        namespace: session.namespace,
        expirationSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '600')
      });

      // Update session to active
      await fastify.prisma.terminalSession.update({
        where: { id: session.id },
        data: {
          status: 'ACTIVE',
          tokenExpiry: tokenResponse.expiresAt
        }
      });

      // Add IP to trusted list
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: {
          trustedIps: {
            push: otpRecord.ipHash
          },
          lastVerifiedAt: new Date()
        }
      });

      fastify.log.info(`OTP verified, session activated: ${session.id}`);

      // Audit log
      await fastify.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'OTP_VERIFY',
          clusterId: session.cluster.id,
          ipHash: otpRecord.ipHash
        }
      });

      return {
        sessionId: session.id,
        expiresAt: tokenResponse.expiresAt,
        pod: session.podName,
        namespace: session.namespace,
        container: session.containerName
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Execute command in terminal session
   */
  fastify.post('/exec', async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId, command } = request.body as any;

    if (!sessionId || !command) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      const session = await fastify.prisma.terminalSession.findUnique({
        where: { id: sessionId },
        include: {
          cluster: true,
          user: true
        }
      });

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      if (session.status !== 'ACTIVE') {
        return reply.status(400).send({ error: 'Session is not active' });
      }

      // Check if token has expired
      if (new Date() > session.tokenExpiry) {
        await fastify.prisma.terminalSession.update({
          where: { id: sessionId },
          data: { status: 'ENDED', endedAt: new Date() }
        });
        return reply.status(401).send({ error: 'Session has expired' });
      }

      // Validate command
      const validation = defaultCommandValidator.validate(command);
      if (!validation.allowed) {
        fastify.log.warn(`Blocked command: ${command} (${validation.reason})`);

        // Audit log
        await fastify.prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'TERMINAL_EXEC',
            clusterId: session.cluster.id,
            namespace: session.namespace,
            podName: session.podName,
            command: command,
            ipHash: session.ipHash,
            metadata: {
              blocked: true,
              reason: validation.reason
            }
          }
        });

        return reply.status(403).send({ error: validation.reason });
      }

      // Rate limiting check
      const commandCount = session.commandCount + 1;
      const maxCommandsPerMin = parseInt(process.env.MAX_COMMANDS_PER_MINUTE || '30');

      if (commandCount > maxCommandsPerMin) {
        return reply.status(429).send({ error: 'Rate limit exceeded' });
      }

      // Update session
      await fastify.prisma.terminalSession.update({
        where: { id: sessionId },
        data: { commandCount }
      });

      // Audit log
      await fastify.prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'TERMINAL_EXEC',
          clusterId: session.cluster.id,
          namespace: session.namespace,
          podName: session.podName,
          command: command,
          ipHash: session.ipHash
        }
      });

      // Record command input
      const recordingEnabled = process.env.TERMINAL_RECORDING_ENABLED !== 'false';
      if (recordingEnabled) {
        try {
          const recording = await fastify.prisma.terminalRecording.findFirst({
            where: { sessionId: session.id },
            orderBy: { createdAt: 'desc' }
          });

          if (recording) {
            await recordingService.addFrame(recording.id, {
              type: 'input',
              data: command + '\n'
            });
          }
        } catch (error: any) {
          fastify.log.error(`Failed to record command: ${error.message}`);
        }
      }

      // In a real implementation, this would execute via WebSocket
      // For now, return success
      return { success: true, command };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Kill a terminal session
   */
  fastify.post('/kill', async (request: FastifyRequest, reply: FastifyReply) => {
    const { discordUserId, sessionId } = request.body as any;

    if (!discordUserId || !sessionId) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      const session = await fastify.prisma.terminalSession.findFirst({
        where: {
          id: sessionId,
          user: {
            discordId: discordUserId
          }
        },
        include: { user: true, cluster: true }
      });

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      await fastify.prisma.terminalSession.update({
        where: { id: sessionId },
        data: {
          status: 'KILLED',
          endedAt: new Date()
        }
      });

      // Stop recording if exists
      const recordingEnabled = process.env.TERMINAL_RECORDING_ENABLED !== 'false';
      if (recordingEnabled) {
        try {
          const recording = await fastify.prisma.terminalRecording.findFirst({
            where: { sessionId: session.id },
            orderBy: { createdAt: 'desc' }
          });

          if (recording) {
            // Set expiration based on retention policy
            const retentionDays = parseInt(process.env.RECORDING_RETENTION_DAYS || '30');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + retentionDays);

            await recordingService.stopRecording(recording.id, expiresAt);
            fastify.log.info(`Recording stopped: ${recording.id} (expires in ${retentionDays} days)`);
          }
        } catch (error: any) {
          fastify.log.error(`Failed to stop recording: ${error.message}`);
        }
      }

      // Audit log
      await fastify.prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'TERMINAL_KILL',
          clusterId: session.cluster.id,
          namespace: session.namespace,
          podName: session.podName,
          ipHash: session.ipHash
        }
      });

      fastify.log.info(`Terminal session killed: ${sessionId}`);

      return { success: true };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });
}

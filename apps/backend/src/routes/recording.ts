import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TerminalRecordingService } from '../services/terminal-recording';

export default async function recordingRoutes(fastify: FastifyInstance) {
  const recordingService = new TerminalRecordingService(fastify.prisma);

  /**
   * Get recording by ID
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const recording = await fastify.prisma.terminalRecording.findUnique({
        where: { id },
        include: {
          user: {
            select: { discordId: true },
          },
          cluster: {
            select: { name: true },
          },
        },
      });

      if (!recording) {
        return reply.status(404).send({ error: 'Recording not found' });
      }

      return recording;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Search recordings
   */
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    try {
      const recordings = await recordingService.search({
        userId: query.userId,
        clusterId: query.clusterId,
        namespace: query.namespace,
        podName: query.podName,
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
        minDuration: query.minDuration ? parseInt(query.minDuration) : undefined,
        maxDuration: query.maxDuration ? parseInt(query.maxDuration) : undefined,
        limit: query.limit ? parseInt(query.limit) : 50,
      });

      return recordings;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Playback recording
   */
  fastify.get('/:id/playback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;

    try {
      const data = await recordingService.getRecording(id);

      // For API, we return all frames (client handles playback timing)
      const frames = data.frames.filter((frame) => {
        if (query.startTime && frame.timestamp < parseInt(query.startTime)) return false;
        if (query.endTime && frame.timestamp > parseInt(query.endTime)) return false;
        return true;
      });

      if (query.maxFrames) {
        return {
          metadata: data.metadata,
          frames: frames.slice(0, parseInt(query.maxFrames)),
        };
      }

      return { metadata: data.metadata, frames };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Export recording
   */
  fastify.get('/:id/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;

    try {
      const format = query.format || 'json';
      const compress = query.compress === 'true';

      const output = await recordingService.export(id, {
        format,
        includeMetadata: query.includeMetadata !== 'false',
        compress,
      });

      // Set appropriate content type
      let contentType = 'application/json';
      let extension = '.json';

      switch (format) {
        case 'tty':
          contentType = 'text/plain';
          extension = '.txt';
          break;
        case 'html':
          contentType = 'text/html';
          extension = '.html';
          break;
        case 'asciicast':
          contentType = 'application/x-asciicast';
          extension = '.cast';
          break;
      }

      if (compress) {
        contentType = 'application/gzip';
        extension += '.gz';
      }

      reply.header('Content-Type', contentType);
      reply.header('Content-Disposition', `attachment; filename="recording-${id}${extension}"`);

      return output;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Delete recording
   */
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.query as { userId?: string };

    try {
      const recording = await fastify.prisma.terminalRecording.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!recording) {
        return reply.status(404).send({ error: 'Recording not found' });
      }

      // Verify ownership if userId provided
      if (userId && recording.user.discordId !== userId) {
        return reply.status(403).send({ error: 'Not authorized to delete this recording' });
      }

      await fastify.prisma.terminalRecording.delete({
        where: { id },
      });

      return { success: true };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Get statistics
   */
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    try {
      const stats = await recordingService.getStats(query.userId, query.clusterId);

      return stats;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Cleanup expired recordings
   */
  fastify.post('/cleanup', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const count = await recordingService.cleanupExpired();

      return { deletedCount: count };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });
}

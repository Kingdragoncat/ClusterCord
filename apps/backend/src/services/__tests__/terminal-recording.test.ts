import { PrismaClient } from '@prisma/client';
import { TerminalRecordingService } from '../terminal-recording';

const prisma = new PrismaClient();
const recordingService = new TerminalRecordingService(prisma);

describe('TerminalRecordingService', () => {
  let testUserId: string;
  let testClusterId: string;
  let testSessionId: string;
  let testRecordingId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        discordId: 'test-user-recording',
        email: 'test@example.com',
        emailVerified: true,
      },
    });
    testUserId = user.id;

    // Create test cluster
    const cluster = await prisma.cluster.create({
      data: {
        name: 'test-cluster-recording',
        kubeconfigEncrypted: 'encrypted-config',
        ownerId: testUserId,
      },
    });
    testClusterId = cluster.id;

    // Create test session
    const session = await prisma.terminalSession.create({
      data: {
        userId: testUserId,
        clusterId: testClusterId,
        podName: 'test-pod',
        namespace: 'default',
        shell: '/bin/bash',
        tokenExpiry: new Date(Date.now() + 600000),
        ipHash: 'test-ip-hash',
        status: 'ACTIVE',
      },
    });
    testSessionId = session.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.terminalRecording.deleteMany({ where: { userId: testUserId } });
    await prisma.terminalSession.deleteMany({ where: { userId: testUserId } });
    await prisma.cluster.deleteMany({ where: { id: testClusterId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('startRecording', () => {
    it('should create a new recording', async () => {
      testRecordingId = await recordingService.startRecording(
        testSessionId,
        testUserId,
        testClusterId,
        'test-pod',
        'default',
        {
          width: 80,
          height: 24,
          env: { TERM: 'xterm-256color' },
        }
      );

      expect(testRecordingId).toBeDefined();

      const recording = await prisma.terminalRecording.findUnique({
        where: { id: testRecordingId },
      });

      expect(recording).toBeDefined();
      expect(recording?.sessionId).toBe(testSessionId);
      expect(recording?.userId).toBe(testUserId);
      expect(recording?.clusterId).toBe(testClusterId);
      expect(recording?.podName).toBe('test-pod');
      expect(recording?.namespace).toBe('default');
      expect(recording?.duration).toBe(0);
      expect(recording?.commandCount).toBe(0);
    });

    it('should initialize with correct metadata', async () => {
      const data = await recordingService.getRecording(testRecordingId);

      expect(data.version).toBe('1.0.0');
      expect(data.metadata.width).toBe(80);
      expect(data.metadata.height).toBe(24);
      expect(data.metadata.env?.TERM).toBe('xterm-256color');
      expect(data.frames).toHaveLength(0);
    });
  });

  describe('addFrame', () => {
    it('should add input frame', async () => {
      await recordingService.addFrame(testRecordingId, {
        type: 'input',
        data: 'ls -la\n',
      });

      const data = await recordingService.getRecording(testRecordingId);
      expect(data.frames).toHaveLength(1);
      expect(data.frames[0].type).toBe('input');
      expect(data.frames[0].data).toBe('ls -la\n');
      expect(data.frames[0].timestamp).toBeGreaterThanOrEqual(0);
    });

    it('should add output frame', async () => {
      await recordingService.addFrame(testRecordingId, {
        type: 'output',
        data: 'total 48\ndrwxr-xr-x 12 user user 4096 Jan 1 12:00 .\n',
      });

      const data = await recordingService.getRecording(testRecordingId);
      expect(data.frames).toHaveLength(2);
      expect(data.frames[1].type).toBe('output');
    });

    it('should add error frame', async () => {
      await recordingService.addFrame(testRecordingId, {
        type: 'error',
        data: 'bash: command not found\n',
      });

      const data = await recordingService.getRecording(testRecordingId);
      expect(data.frames).toHaveLength(3);
      expect(data.frames[2].type).toBe('error');
    });

    it('should add system frame', async () => {
      await recordingService.addFrame(testRecordingId, {
        type: 'system',
        data: '[Session ended]',
      });

      const data = await recordingService.getRecording(testRecordingId);
      expect(data.frames).toHaveLength(4);
      expect(data.frames[3].type).toBe('system');
    });

    it('should update command count for input frames', async () => {
      const recording = await prisma.terminalRecording.findUnique({
        where: { id: testRecordingId },
      });

      expect(recording?.commandCount).toBe(1); // Only input frames count
    });

    it('should redact secrets in output frames', async () => {
      await recordingService.addFrame(testRecordingId, {
        type: 'output',
        data: 'password: mysecretpassword123\ntoken: abc123token\n',
      });

      const data = await recordingService.getRecording(testRecordingId);
      const lastFrame = data.frames[data.frames.length - 1];

      // Secrets should be redacted
      expect(lastFrame.data).toContain('password:');
      expect(lastFrame.data).not.toContain('mysecretpassword123');
      expect(lastFrame.data).toContain('token:');
      expect(lastFrame.data).not.toContain('abc123token');
    });

    it('should reject frames exceeding max size', async () => {
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB

      await expect(
        recordingService.addFrame(testRecordingId, {
          type: 'output',
          data: largeData,
        })
      ).rejects.toThrow('Frame size exceeds maximum allowed size');
    });
  });

  describe('stopRecording', () => {
    it('should finalize recording with end time', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await recordingService.stopRecording(testRecordingId, expiresAt);

      const data = await recordingService.getRecording(testRecordingId);
      const recording = await prisma.terminalRecording.findUnique({
        where: { id: testRecordingId },
      });

      expect(data.metadata.endTime).toBeDefined();
      expect(recording?.duration).toBeGreaterThan(0);
      expect(recording?.expiresAt).toEqual(expiresAt);
    });
  });

  describe('playback', () => {
    it('should replay all frames', async () => {
      const frames: any[] = [];

      for await (const frame of recordingService.playback(testRecordingId, {
        speed: 1000, // Very fast for testing
      })) {
        frames.push(frame);
      }

      expect(frames.length).toBeGreaterThan(0);
    });

    it('should filter by time range', async () => {
      const data = await recordingService.getRecording(testRecordingId);
      const firstTimestamp = data.frames[0].timestamp;
      const lastTimestamp = data.frames[data.frames.length - 1].timestamp;

      const frames: any[] = [];

      for await (const frame of recordingService.playback(testRecordingId, {
        startTime: firstTimestamp,
        endTime: lastTimestamp,
        speed: 1000,
      })) {
        frames.push(frame);
      }

      expect(frames.length).toBeGreaterThan(0);
    });

    it('should limit max frames', async () => {
      const frames: any[] = [];

      for await (const frame of recordingService.playback(testRecordingId, {
        maxFrames: 2,
        speed: 1000,
      })) {
        frames.push(frame);
      }

      expect(frames.length).toBeLessThanOrEqual(2);
    });
  });

  describe('export', () => {
    it('should export as JSON', async () => {
      const output = await recordingService.export(testRecordingId, {
        format: 'json',
        includeMetadata: true,
      });

      expect(typeof output).toBe('string');
      const parsed = JSON.parse(output as string);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.frames).toBeDefined();
      expect(parsed.metadata).toBeDefined();
    });

    it('should export as JSON without metadata', async () => {
      const output = await recordingService.export(testRecordingId, {
        format: 'json',
        includeMetadata: false,
      });

      const parsed = JSON.parse(output as string);
      expect(parsed.frames).toBeDefined();
      expect(parsed.version).toBeUndefined();
      expect(parsed.metadata).toBeUndefined();
    });

    it('should export as TTY', async () => {
      const output = await recordingService.export(testRecordingId, {
        format: 'tty',
      });

      expect(typeof output).toBe('string');
      expect(output).toContain('total 48'); // From output frame
    });

    it('should export as HTML', async () => {
      const output = await recordingService.export(testRecordingId, {
        format: 'html',
      });

      expect(typeof output).toBe('string');
      expect(output).toContain('<!DOCTYPE html>');
      expect(output).toContain('<script>');
      expect(output).toContain('const frames');
    });

    it('should export as asciicast', async () => {
      const output = await recordingService.export(testRecordingId, {
        format: 'asciicast',
      });

      expect(typeof output).toBe('string');
      const lines = (output as string).split('\n');
      const header = JSON.parse(lines[0]);

      expect(header.version).toBe(2);
      expect(header.width).toBe(80);
      expect(header.height).toBe(24);
    });

    it('should compress output', async () => {
      const output = await recordingService.export(testRecordingId, {
        format: 'json',
        compress: true,
      });

      expect(Buffer.isBuffer(output)).toBe(true);
    });
  });

  describe('search', () => {
    it('should find recordings by user', async () => {
      const results = await recordingService.search({
        userId: testUserId,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].userId).toBe(testUserId);
    });

    it('should find recordings by cluster', async () => {
      const results = await recordingService.search({
        clusterId: testClusterId,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].clusterId).toBe(testClusterId);
    });

    it('should find recordings by namespace', async () => {
      const results = await recordingService.search({
        namespace: 'default',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].namespace).toBe('default');
    });

    it('should find recordings by pod name', async () => {
      const results = await recordingService.search({
        podName: 'test-pod',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].podName).toBe('test-pod');
    });

    it('should limit results', async () => {
      const results = await recordingService.search({
        userId: testUserId,
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getStats', () => {
    it('should return statistics for user', async () => {
      const stats = await recordingService.getStats(testUserId);

      expect(stats.totalRecordings).toBeGreaterThan(0);
      expect(stats.totalDuration).toBeGreaterThanOrEqual(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.avgDuration).toBeGreaterThanOrEqual(0);
    });

    it('should return statistics for cluster', async () => {
      const stats = await recordingService.getStats(undefined, testClusterId);

      expect(stats.totalRecordings).toBeGreaterThan(0);
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired recordings', async () => {
      // Create expired recording
      const expiredSessionId = 'expired-session-test';
      const expiredRecordingId = await recordingService.startRecording(
        expiredSessionId,
        testUserId,
        testClusterId,
        'expired-pod',
        'default'
      );

      // Set expiration to past
      await prisma.terminalRecording.update({
        where: { id: expiredRecordingId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const deletedCount = await recordingService.cleanupExpired();
      expect(deletedCount).toBeGreaterThan(0);

      // Verify deleted
      const recording = await prisma.terminalRecording.findUnique({
        where: { id: expiredRecordingId },
      });
      expect(recording).toBeNull();
    });
  });
});

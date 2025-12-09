import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface TerminalFrame {
  timestamp: number;
  type: 'input' | 'output' | 'error' | 'system';
  data: string;
  exitCode?: number;
}

export interface RecordingMetadata {
  startTime: number;
  endTime?: number;
  width?: number;
  height?: number;
  env?: Record<string, string>;
}

export interface RecordingData {
  version: string;
  metadata: RecordingMetadata;
  frames: TerminalFrame[];
}

export interface PlaybackOptions {
  speed?: number; // Playback speed multiplier (1.0 = normal)
  maxFrames?: number;
  startTime?: number;
  endTime?: number;
}

export interface ExportFormat {
  format: 'json' | 'tty' | 'html' | 'asciicast';
  includeMetadata?: boolean;
  compress?: boolean;
}

export class TerminalRecordingService {
  private prisma: PrismaClient;
  private readonly VERSION = '1.0.0';
  private readonly MAX_FRAME_SIZE = 1024 * 1024; // 1MB per frame
  private readonly SECRET_PATTERNS = [
    /password[:\s=]+["']?([^"'\s]+)/gi,
    /token[:\s=]+["']?([^"'\s]+)/gi,
    /api[_-]?key[:\s=]+["']?([^"'\s]+)/gi,
    /secret[:\s=]+["']?([^"'\s]+)/gi,
    /-----BEGIN.*PRIVATE KEY-----[\s\S]*?-----END.*PRIVATE KEY-----/gi,
    /bearer\s+([a-zA-Z0-9\-._~+/]+=*)/gi,
  ];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Start recording a terminal session
   */
  async startRecording(
    sessionId: string,
    userId: string,
    clusterId: string,
    podName: string,
    namespace: string,
    metadata?: Partial<RecordingMetadata>
  ): Promise<string> {
    const recordingData: RecordingData = {
      version: this.VERSION,
      metadata: {
        startTime: Date.now(),
        ...metadata,
      },
      frames: [],
    };

    const recording = await this.prisma.terminalRecording.create({
      data: {
        sessionId,
        userId,
        clusterId,
        podName,
        namespace,
        recordingData: recordingData as any,
        duration: 0,
        commandCount: 0,
        size: 0,
      },
    });

    return recording.id;
  }

  /**
   * Add a frame to an active recording
   */
  async addFrame(
    recordingId: string,
    frame: Omit<TerminalFrame, 'timestamp'>
  ): Promise<void> {
    const recording = await this.prisma.terminalRecording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new Error('Recording not found');
    }

    const data = recording.recordingData as RecordingData;

    // Add timestamp
    const frameWithTimestamp: TerminalFrame = {
      ...frame,
      timestamp: Date.now() - data.metadata.startTime,
    };

    // Validate frame size
    const frameSize = JSON.stringify(frameWithTimestamp).length;
    if (frameSize > this.MAX_FRAME_SIZE) {
      throw new Error(`Frame size exceeds maximum allowed size (${this.MAX_FRAME_SIZE} bytes)`);
    }

    // Auto-redact secrets in output frames
    if (frame.type === 'output' || frame.type === 'error') {
      frameWithTimestamp.data = this.redactSecrets(frameWithTimestamp.data);
    }

    data.frames.push(frameWithTimestamp);

    // Update recording
    const newSize = JSON.stringify(data).length;
    const commandCount = frame.type === 'input' ? recording.commandCount + 1 : recording.commandCount;

    await this.prisma.terminalRecording.update({
      where: { id: recordingId },
      data: {
        recordingData: data as any,
        commandCount,
        size: newSize,
      },
    });
  }

  /**
   * Stop recording and finalize
   */
  async stopRecording(recordingId: string, expiresAt?: Date): Promise<void> {
    const recording = await this.prisma.terminalRecording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new Error('Recording not found');
    }

    const data = recording.recordingData as RecordingData;
    data.metadata.endTime = Date.now();

    const duration = Math.floor((data.metadata.endTime - data.metadata.startTime) / 1000);

    await this.prisma.terminalRecording.update({
      where: { id: recordingId },
      data: {
        recordingData: data as any,
        duration,
        expiresAt,
      },
    });
  }

  /**
   * Get recording for playback
   */
  async getRecording(recordingId: string): Promise<RecordingData> {
    const recording = await this.prisma.terminalRecording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new Error('Recording not found');
    }

    return recording.recordingData as RecordingData;
  }

  /**
   * Play back recording with options
   */
  async* playback(
    recordingId: string,
    options: PlaybackOptions = {}
  ): AsyncGenerator<TerminalFrame> {
    const data = await this.getRecording(recordingId);
    const speed = options.speed || 1.0;
    const startTime = options.startTime || 0;
    const endTime = options.endTime || Infinity;

    let frames = data.frames.filter(
      (frame) => frame.timestamp >= startTime && frame.timestamp <= endTime
    );

    if (options.maxFrames) {
      frames = frames.slice(0, options.maxFrames);
    }

    let lastTimestamp = 0;

    for (const frame of frames) {
      // Calculate delay based on speed
      const delay = (frame.timestamp - lastTimestamp) / speed;

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      yield frame;
      lastTimestamp = frame.timestamp;
    }
  }

  /**
   * Export recording in different formats
   */
  async export(recordingId: string, exportOptions: ExportFormat): Promise<string | Buffer> {
    const data = await this.getRecording(recordingId);

    let output: string;

    switch (exportOptions.format) {
      case 'json':
        output = JSON.stringify(
          exportOptions.includeMetadata ? data : { frames: data.frames },
          null,
          2
        );
        break;

      case 'tty':
        // TTY format: just the raw terminal output
        output = data.frames
          .filter((f) => f.type === 'output' || f.type === 'error')
          .map((f) => f.data)
          .join('');
        break;

      case 'html':
        output = this.generateHTML(data);
        break;

      case 'asciicast':
        // asciinema format (v2)
        output = this.generateAsciicast(data);
        break;

      default:
        throw new Error(`Unsupported export format: ${exportOptions.format}`);
    }

    if (exportOptions.compress) {
      return await gzip(Buffer.from(output, 'utf-8'));
    }

    return output;
  }

  /**
   * Search recordings by criteria
   */
  async search(criteria: {
    userId?: string;
    clusterId?: string;
    namespace?: string;
    podName?: string;
    fromDate?: Date;
    toDate?: Date;
    minDuration?: number;
    maxDuration?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (criteria.userId) where.userId = criteria.userId;
    if (criteria.clusterId) where.clusterId = criteria.clusterId;
    if (criteria.namespace) where.namespace = criteria.namespace;
    if (criteria.podName) where.podName = criteria.podName;

    if (criteria.fromDate || criteria.toDate) {
      where.createdAt = {};
      if (criteria.fromDate) where.createdAt.gte = criteria.fromDate;
      if (criteria.toDate) where.createdAt.lte = criteria.toDate;
    }

    if (criteria.minDuration || criteria.maxDuration) {
      where.duration = {};
      if (criteria.minDuration) where.duration.gte = criteria.minDuration;
      if (criteria.maxDuration) where.duration.lte = criteria.maxDuration;
    }

    return await this.prisma.terminalRecording.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: criteria.limit || 50,
      include: {
        user: {
          select: { discordId: true },
        },
        cluster: {
          select: { name: true },
        },
      },
    });
  }

  /**
   * Delete old recordings based on retention policy
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.terminalRecording.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Get recording statistics
   */
  async getStats(userId?: string, clusterId?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (clusterId) where.clusterId = clusterId;

    const [totalRecordings, totalDuration, totalSize, avgDuration] = await Promise.all([
      this.prisma.terminalRecording.count({ where }),
      this.prisma.terminalRecording.aggregate({
        where,
        _sum: { duration: true },
      }),
      this.prisma.terminalRecording.aggregate({
        where,
        _sum: { size: true },
      }),
      this.prisma.terminalRecording.aggregate({
        where,
        _avg: { duration: true },
      }),
    ]);

    return {
      totalRecordings,
      totalDuration: totalDuration._sum.duration || 0,
      totalSize: totalSize._sum.size || 0,
      avgDuration: Math.floor(avgDuration._avg.duration || 0),
    };
  }

  /**
   * Redact sensitive information from output
   */
  private redactSecrets(text: string): string {
    let redacted = text;

    for (const pattern of this.SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, (match) => {
        return match.replace(/[a-zA-Z0-9]/g, '*');
      });
    }

    return redacted;
  }

  /**
   * Generate HTML playback
   */
  private generateHTML(data: RecordingData): string {
    const duration = Math.floor((data.metadata.endTime! - data.metadata.startTime) / 1000);
    const frames = data.frames.map((f) => ({
      t: f.timestamp,
      d: f.data,
      type: f.type,
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminal Recording</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: 'Courier New', monospace;
    }
    .terminal {
      background: #000;
      padding: 20px;
      border-radius: 8px;
      max-width: 1200px;
      margin: 0 auto;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }
    .controls {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    button {
      background: #0e639c;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover {
      background: #1177bb;
    }
    .output {
      white-space: pre-wrap;
      word-wrap: break-word;
      min-height: 400px;
      max-height: 600px;
      overflow-y: auto;
      line-height: 1.4;
    }
    .error { color: #f48771; }
    .input { color: #4ec9b0; }
    .system { color: #dcdcaa; }
    .progress {
      width: 100%;
      height: 4px;
      background: #333;
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .progress-bar {
      height: 100%;
      background: #0e639c;
      transition: width 0.1s linear;
    }
    .info {
      font-size: 12px;
      color: #808080;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="terminal">
    <div class="info">
      Duration: ${duration}s | Frames: ${data.frames.length}
    </div>
    <div class="progress">
      <div class="progress-bar" id="progress"></div>
    </div>
    <div class="controls">
      <button onclick="play()">Play</button>
      <button onclick="pause()">Pause</button>
      <button onclick="reset()">Reset</button>
      <label>Speed: </label>
      <select id="speed" onchange="setSpeed()">
        <option value="0.5">0.5x</option>
        <option value="1" selected>1x</option>
        <option value="2">2x</option>
        <option value="4">4x</option>
      </select>
    </div>
    <div class="output" id="output"></div>
  </div>

  <script>
    const frames = ${JSON.stringify(frames)};
    const duration = ${duration * 1000};
    let currentFrame = 0;
    let playing = false;
    let speed = 1.0;
    let startTime = 0;

    function play() {
      if (!playing) {
        playing = true;
        startTime = Date.now() - (frames[currentFrame]?.t || 0) / speed;
        requestAnimationFrame(render);
      }
    }

    function pause() {
      playing = false;
    }

    function reset() {
      playing = false;
      currentFrame = 0;
      document.getElementById('output').innerHTML = '';
      document.getElementById('progress').style.width = '0%';
    }

    function setSpeed() {
      speed = parseFloat(document.getElementById('speed').value);
      if (playing) {
        startTime = Date.now() - (frames[currentFrame]?.t || 0) / speed;
      }
    }

    function render() {
      if (!playing) return;

      const elapsed = (Date.now() - startTime) * speed;
      const output = document.getElementById('output');

      while (currentFrame < frames.length && frames[currentFrame].t <= elapsed) {
        const frame = frames[currentFrame];
        const span = document.createElement('span');
        span.className = frame.type;
        span.textContent = frame.d;
        output.appendChild(span);
        currentFrame++;
      }

      const progress = Math.min(100, (elapsed / duration) * 100);
      document.getElementById('progress').style.width = progress + '%';

      if (currentFrame < frames.length) {
        requestAnimationFrame(render);
      } else {
        playing = false;
      }
    }
  </script>
</body>
</html>`;
  }

  /**
   * Generate asciinema format (v2)
   */
  private generateAsciicast(data: RecordingData): string {
    const header = {
      version: 2,
      width: data.metadata.width || 80,
      height: data.metadata.height || 24,
      timestamp: Math.floor(data.metadata.startTime / 1000),
      duration: Math.floor((data.metadata.endTime! - data.metadata.startTime) / 1000),
      env: data.metadata.env || { TERM: 'xterm-256color', SHELL: '/bin/sh' },
    };

    const lines = [JSON.stringify(header)];

    for (const frame of data.frames) {
      if (frame.type === 'output') {
        // asciinema format: [timestamp, "o", data]
        lines.push(JSON.stringify([frame.timestamp / 1000, 'o', frame.data]));
      } else if (frame.type === 'input') {
        // asciinema format: [timestamp, "i", data]
        lines.push(JSON.stringify([frame.timestamp / 1000, 'i', frame.data]));
      }
    }

    return lines.join('\n');
  }
}

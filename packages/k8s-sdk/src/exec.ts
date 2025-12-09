import { K8sClient } from './k8s-client';
import { ExecOptions } from './types';
import * as stream from 'stream';
import * as WebSocket from 'ws';

export class ExecManager {
  constructor(private client: K8sClient) {}

  /**
   * Execute a command in a pod container
   */
  async exec(
    options: ExecOptions,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void,
    onError?: (error: Error) => void
  ): Promise<WebSocket> {
    const exec = this.client.getExec();

    const command = options.command || [options.shell || '/bin/sh'];
    const container = options.containerName;

    try {
      const ws = await exec.exec(
        options.namespace,
        options.podName,
        container || '',
        command,
        process.stdout as stream.Writable,
        process.stderr as stream.Writable,
        process.stdin as stream.Readable,
        options.tty || false,
        (status) => {
          console.log('Exec connection closed with status:', status);
        }
      );

      return ws;
    } catch (error) {
      throw new Error(`Failed to execute command: ${error}`);
    }
  }

  /**
   * Execute a single command and return output
   */
  async execCommand(
    options: ExecOptions,
    command: string
  ): Promise<{ stdout: string; stderr: string }> {
    const exec = this.client.getExec();

    let stdout = '';
    let stderr = '';

    const stdoutStream = new stream.Writable({
      write(chunk, encoding, callback) {
        stdout += chunk.toString();
        callback();
      }
    });

    const stderrStream = new stream.Writable({
      write(chunk, encoding, callback) {
        stderr += chunk.toString();
        callback();
      }
    });

    try {
      await exec.exec(
        options.namespace,
        options.podName,
        options.containerName || '',
        [options.shell || '/bin/sh', '-c', command],
        stdoutStream,
        stderrStream,
        null,
        false
      );

      return { stdout, stderr };
    } catch (error) {
      throw new Error(`Failed to execute command: ${error}`);
    }
  }

  /**
   * Validate that a pod/container is ready for exec
   */
  async validateExecTarget(options: ExecOptions): Promise<{ valid: boolean; reason?: string }> {
    try {
      const pod = await this.client.describePod(options.podName, options.namespace);

      // Check pod phase
      if (pod.status?.phase !== 'Running') {
        return {
          valid: false,
          reason: `Pod is not running (current phase: ${pod.status?.phase})`
        };
      }

      // Check if container exists (if specified)
      if (options.containerName) {
        const containerExists = pod.spec?.containers?.some(
          c => c.name === options.containerName
        );

        if (!containerExists) {
          return {
            valid: false,
            reason: `Container ${options.containerName} not found in pod`
          };
        }

        // Check container status
        const containerStatus = pod.status?.containerStatuses?.find(
          cs => cs.name === options.containerName
        );

        if (!containerStatus?.ready) {
          return {
            valid: false,
            reason: `Container ${options.containerName} is not ready`
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `Failed to validate exec target: ${error}`
      };
    }
  }
}

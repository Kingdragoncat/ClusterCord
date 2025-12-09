import { EmbedBuilder } from 'discord.js';

export class ClusterCordEmbeds {
  private static readonly BRAND_COLOR = 0x5865f2;
  private static readonly SUCCESS_COLOR = 0x57f287;
  private static readonly ERROR_COLOR = 0xed4245;
  private static readonly WARNING_COLOR = 0xfee75c;

  /**
   * Create a success embed
   */
  static success(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(this.SUCCESS_COLOR)
      .setTitle(`✅ ${title}`)
      .setTimestamp();

    if (description) {
      embed.setDescription(description);
    }

    return embed;
  }

  /**
   * Create an error embed
   */
  static error(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(this.ERROR_COLOR)
      .setTitle(`❌ ${title}`)
      .setTimestamp();

    if (description) {
      embed.setDescription(description);
    }

    return embed;
  }

  /**
   * Create a warning embed
   */
  static warning(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(this.WARNING_COLOR)
      .setTitle(`⚠️ ${title}`)
      .setTimestamp();

    if (description) {
      embed.setDescription(description);
    }

    return embed;
  }

  /**
   * Create an info embed
   */
  static info(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(this.BRAND_COLOR)
      .setTitle(title)
      .setTimestamp();

    if (description) {
      embed.setDescription(description);
    }

    return embed;
  }

  /**
   * Create a cluster info embed
   */
  static clusterInfo(cluster: {
    name: string;
    endpoint: string;
    version?: string;
    status?: string;
  }): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(this.BRAND_COLOR)
      .setTitle(`📦 Cluster: ${cluster.name}`)
      .addFields(
        { name: 'Endpoint', value: cluster.endpoint || 'Unknown', inline: true },
        { name: 'Version', value: cluster.version || 'Unknown', inline: true },
        { name: 'Status', value: cluster.status || 'Unknown', inline: true }
      )
      .setTimestamp();
  }

  /**
   * Create a pod list embed
   */
  static podList(namespace: string, pods: any[]): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(this.BRAND_COLOR)
      .setTitle(`🐳 Pods in ${namespace}`)
      .setDescription(`Found ${pods.length} pod(s)`)
      .setTimestamp();

    if (pods.length > 0) {
      const podFields = pods.slice(0, 10).map(pod => ({
        name: pod.metadata?.name || 'Unknown',
        value: `Status: ${pod.status?.phase || 'Unknown'} | Restarts: ${
          pod.status?.containerStatuses?.[0]?.restartCount || 0
        }`,
        inline: false
      }));

      embed.addFields(podFields);

      if (pods.length > 10) {
        embed.setFooter({ text: `Showing 10 of ${pods.length} pods` });
      }
    }

    return embed;
  }

  /**
   * Create a terminal session embed
   */
  static terminalSession(session: {
    pod: string;
    namespace: string;
    container?: string;
    expiresAt: Date;
  }): EmbedBuilder {
    const timeRemaining = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    return new EmbedBuilder()
      .setColor(this.SUCCESS_COLOR)
      .setTitle('🖥️ Terminal Session Active')
      .addFields(
        { name: 'Pod', value: session.pod, inline: true },
        { name: 'Namespace', value: session.namespace, inline: true },
        {
          name: 'Container',
          value: session.container || 'default',
          inline: true
        },
        {
          name: 'Expires In',
          value: `${minutes}m ${seconds}s`,
          inline: false
        }
      )
      .setDescription(
        'Type your commands below. Use `exit` to end the session.\n\n' +
          '⚠️ **Security Notice**: All commands are logged and validated.'
      )
      .setTimestamp();
  }

  /**
   * Create an OTP verification embed
   */
  static otpVerification(expiresAt: Date): EmbedBuilder {
    const timeRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    return new EmbedBuilder()
      .setColor(this.WARNING_COLOR)
      .setTitle('🔐 Verification Required')
      .setDescription(
        'A new location was detected for your terminal session.\n\n' +
          'Please check your email for a verification code and use:\n' +
          '`/terminal verify code:<your-code>`'
      )
      .addFields({
        name: 'Code Expires In',
        value: `${timeRemaining} seconds`,
        inline: false
      })
      .setTimestamp();
  }

  /**
   * Create an audit log embed
   */
  static auditLog(log: {
    action: string;
    user: string;
    timestamp: Date;
    details?: string;
  }): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(this.BRAND_COLOR)
      .setTitle('📋 Audit Log Entry')
      .addFields(
        { name: 'Action', value: log.action, inline: true },
        { name: 'User', value: log.user, inline: true },
        {
          name: 'Timestamp',
          value: log.timestamp.toISOString(),
          inline: true
        }
      )
      .setDescription(log.details || 'No additional details')
      .setTimestamp();
  }

  /**
   * Create a session summary embed (for when session ends)
   */
  static sessionSummary(summary: {
    duration: number;
    commandCount: number;
    outputBytes: number;
  }): EmbedBuilder {
    const minutes = Math.floor(summary.duration / 60);
    const seconds = summary.duration % 60;

    return new EmbedBuilder()
      .setColor(this.BRAND_COLOR)
      .setTitle('📊 Session Summary')
      .addFields(
        {
          name: 'Duration',
          value: `${minutes}m ${seconds}s`,
          inline: true
        },
        {
          name: 'Commands',
          value: summary.commandCount.toString(),
          inline: true
        },
        {
          name: 'Output',
          value: `${(summary.outputBytes / 1024).toFixed(2)} KB`,
          inline: true
        }
      )
      .setDescription('Terminal session has ended.')
      .setTimestamp();
  }
}

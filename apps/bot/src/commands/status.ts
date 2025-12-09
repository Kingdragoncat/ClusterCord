import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder
} from 'discord.js';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('📡 Check bot status and backend health');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const startTime = Date.now();

  try {
    // Check backend health
    const healthResponse = await axios.get(`${BACKEND_URL}/health`, {
      timeout: 5000
    });

    const responseTime = Date.now() - startTime;
    const health = healthResponse.data;

    // Get detailed stats
    const statsResponse = await axios
      .get(`${BACKEND_URL}/api/stats`, {
        timeout: 5000,
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      })
      .catch(() => null);

    const stats = statsResponse?.data || {};

    const embed = new EmbedBuilder()
      .setTitle('📡 ClusterCord Status')
      .setDescription('**System Health & Performance**')
      .setColor(0x00ff00)
      .addFields(
        {
          name: '🟢 Backend API',
          value: `**Status**: Operational\n**Response Time**: ${responseTime}ms\n**Endpoint**: ${BACKEND_URL}`,
          inline: false
        },
        {
          name: '🤖 Discord Bot',
          value:
            `**Status**: Online\n` +
            `**Latency**: ${interaction.client.ws.ping}ms\n` +
            `**Uptime**: ${formatUptime(process.uptime())}`,
          inline: false
        }
      );

    // Add database status if available
    if (stats.database) {
      embed.addFields({
        name: '🗄️ Database',
        value:
          `**Status**: ${stats.database.connected ? 'Connected' : 'Disconnected'}\n` +
          `**Response Time**: ${stats.database.responseTime || 'N/A'}ms`,
        inline: true
      });
    }

    // Add cluster connectivity if available
    if (stats.clusters) {
      const healthyClusters = stats.clusters.filter((c: any) => c.healthy).length;
      const totalClusters = stats.clusters.length;

      embed.addFields({
        name: '🎯 Cluster Connectivity',
        value:
          `**Healthy**: ${healthyClusters}/${totalClusters}\n` +
          `**Status**: ${healthyClusters === totalClusters ? '✅ All OK' : '⚠️ Issues Detected'}`,
        inline: true
      });
    }

    // Add active sessions
    if (stats.activeSessions !== undefined) {
      embed.addFields({
        name: '💻 Active Sessions',
        value:
          `**Terminal Sessions**: ${stats.activeSessions || 0}\n` +
          `**Recording**: ${stats.recordingSessions || 0}`,
        inline: true
      });
    }

    // Add resource usage if available
    if (stats.system) {
      embed.addFields({
        name: '📊 System Resources',
        value:
          `**Memory**: ${Math.round((stats.system.memoryUsed / stats.system.memoryTotal) * 100)}% (${formatBytes(stats.system.memoryUsed)} / ${formatBytes(stats.system.memoryTotal)})\n` +
          `**CPU Load**: ${stats.system.cpuLoad || 'N/A'}%`,
        inline: false
      });
    }

    embed.setFooter({ text: 'Last checked' });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error checking status:', error);

    const responseTime = Date.now() - startTime;

    const embed = new EmbedBuilder()
      .setTitle('📡 ClusterCord Status')
      .setDescription('**System Health Check**')
      .setColor(0xff0000)
      .addFields(
        {
          name: '🔴 Backend API',
          value:
            `**Status**: ${error.code === 'ECONNREFUSED' ? 'Offline' : 'Error'}\n` +
            `**Response Time**: ${responseTime}ms\n` +
            `**Error**: ${error.message}`,
          inline: false
        },
        {
          name: '🤖 Discord Bot',
          value:
            `**Status**: Online\n` +
            `**Latency**: ${interaction.client.ws.ping}ms\n` +
            `**Uptime**: ${formatUptime(process.uptime())}`,
          inline: false
        }
      )
      .setFooter({ text: 'Backend is currently unavailable' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '< 1m';
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder
} from 'discord.js';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

export const data = new SlashCommandBuilder()
  .setName('deployment')
  .setDescription('📊 Track and analyze deployments')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('stats')
      .setDescription('View deployment statistics')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID (optional)')
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace (optional)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('history')
      .setDescription('View deployment history')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('deployment')
          .setDescription('Deployment name')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('limit')
          .setDescription('Number of deployments to show (default: 10)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('frequency')
      .setDescription('View deployment frequency')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('days')
          .setDescription('Number of days (default: 7)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('slow')
      .setDescription('Identify slow deployments')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('threshold')
          .setDescription('Threshold in seconds (default: 300)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('report')
      .setDescription('Generate deployment report')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID (optional)')
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace (optional)')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'stats':
      await handleStats(interaction);
      break;
    case 'history':
      await handleHistory(interaction);
      break;
    case 'frequency':
      await handleFrequency(interaction);
      break;
    case 'slow':
      await handleSlow(interaction);
      break;
    case 'report':
      await handleReport(interaction);
      break;
  }
}

async function handleStats(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster');
  const namespace = interaction.options.getString('namespace');

  await interaction.deferReply();

  try {
    const params = new URLSearchParams();
    if (clusterId) params.append('clusterId', clusterId);
    if (namespace) params.append('namespace', namespace);

    const response = await axios.get(
      `${BACKEND_URL}/api/deployments/stats?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const stats = response.data.stats;

    const embed = new EmbedBuilder()
      .setTitle('📊 Deployment Statistics')
      .setColor(0x00ff00)
      .addFields(
        {
          name: '📈 Overview',
          value: `Total Deployments: **${stats.totalDeployments}**\nSuccess Rate: **${stats.successRate.toFixed(1)}%**\nFailure Rate: **${stats.failureRate.toFixed(1)}%**\nRollback Rate: **${stats.rollbackRate.toFixed(1)}%**`,
          inline: false
        },
        {
          name: '⏱️ Performance',
          value: `Average Duration: **${formatDuration(stats.averageDuration)}**\nFastest: **${formatDuration(stats.fastestDeployment)}**\nSlowest: **${formatDuration(stats.slowestDeployment)}**`,
          inline: false
        }
      )
      .setTimestamp();

    if (stats.topFailureReasons && stats.topFailureReasons.length > 0) {
      const reasonsText = stats.topFailureReasons
        .map((r: any) => `• ${r.reason} (${r.count} times)`)
        .join('\n');

      embed.addFields({
        name: '🔝 Top Failure Reasons',
        value: reasonsText,
        inline: false
      });
    }

    // Health indicator
    const healthEmoji = stats.successRate >= 95 ? '✅' : stats.successRate >= 80 ? '⚠️' : '❌';
    const healthText = stats.successRate >= 95 ? 'Excellent' : stats.successRate >= 80 ? 'Good' : 'Needs Improvement';

    embed.addFields({
      name: '🏥 Health',
      value: `${healthEmoji} ${healthText}`,
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error fetching deployment stats:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Fetch Stats')
      .setDescription(error.response?.data?.error || 'Failed to fetch deployment statistics')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleHistory(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const namespace = interaction.options.getString('namespace', true);
  const deploymentName = interaction.options.getString('deployment', true);
  const limit = interaction.options.getInteger('limit') || 10;

  await interaction.deferReply();

  try {
    const params = new URLSearchParams({
      clusterId,
      namespace,
      deploymentName,
      limit: limit.toString()
    });

    const response = await axios.get(
      `${BACKEND_URL}/api/deployments/history?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const history = response.data.history;

    const embed = new EmbedBuilder()
      .setTitle(`📜 Deployment History: ${deploymentName}`)
      .setDescription(`Namespace: **${namespace}**`)
      .setColor(0x0099ff)
      .setTimestamp();

    if (history.length === 0) {
      embed.addFields({
        name: 'No History',
        value: 'No deployment history found',
        inline: false
      });
    } else {
      for (const deployment of history.slice(0, 10)) {
        const statusEmoji = deployment.status === 'DEPLOYED' ? '✅' : '❌';
        const duration = deployment.completedAt
          ? Math.floor((new Date(deployment.completedAt).getTime() - new Date(deployment.createdAt).getTime()) / 1000)
          : 0;

        embed.addFields({
          name: `${statusEmoji} ${new Date(deployment.createdAt).toLocaleString()}`,
          value: `Status: ${deployment.status}\nImage: ${deployment.image || 'N/A'}\nDuration: ${formatDuration(duration)}\nTriggered by: ${deployment.triggeredBy || 'Unknown'}`,
          inline: false
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error fetching deployment history:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Fetch History')
      .setDescription(error.response?.data?.error || 'Failed to fetch deployment history')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleFrequency(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const days = interaction.options.getInteger('days') || 7;

  await interaction.deferReply();

  try {
    const params = new URLSearchParams({
      clusterId,
      days: days.toString()
    });

    const response = await axios.get(
      `${BACKEND_URL}/api/deployments/frequency?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const frequency = response.data.frequency;

    const embed = new EmbedBuilder()
      .setTitle('📈 Deployment Frequency')
      .setDescription(`Cluster: **${clusterId}**\nPeriod: Last **${days}** days`)
      .setColor(0x00ff00)
      .addFields({
        name: 'Average Deployments per Day',
        value: `**${frequency.toFixed(2)}** deployments/day`,
        inline: false
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error fetching deployment frequency:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Fetch Frequency')
      .setDescription(error.response?.data?.error || 'Failed to fetch deployment frequency')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleSlow(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const threshold = interaction.options.getInteger('threshold') || 300;

  await interaction.deferReply();

  try {
    const params = new URLSearchParams({
      clusterId,
      thresholdSeconds: threshold.toString()
    });

    const response = await axios.get(
      `${BACKEND_URL}/api/deployments/slow?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const slowDeployments = response.data.slowDeployments;

    const embed = new EmbedBuilder()
      .setTitle('🐌 Slow Deployments')
      .setDescription(`Threshold: **${formatDuration(threshold)}**`)
      .setColor(0xffaa00)
      .setTimestamp();

    if (slowDeployments.length === 0) {
      embed.addFields({
        name: '✅ No Slow Deployments',
        value: 'All deployments are within the threshold',
        inline: false
      });
    } else {
      for (const deployment of slowDeployments.slice(0, 10)) {
        const duration = deployment.completedAt
          ? Math.floor((new Date(deployment.completedAt).getTime() - new Date(deployment.createdAt).getTime()) / 1000)
          : 0;

        embed.addFields({
          name: `${deployment.namespace}/${deployment.name}`,
          value: `Duration: **${formatDuration(duration)}**\nImage: ${deployment.image || 'N/A'}`,
          inline: true
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error identifying slow deployments:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Identify Slow Deployments')
      .setDescription(error.response?.data?.error || 'Failed to identify slow deployments')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleReport(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster');
  const namespace = interaction.options.getString('namespace');

  await interaction.deferReply();

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/deployments/report`,
      {
        clusterId,
        namespace
      },
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const report = response.data.report;

    const embed = new EmbedBuilder()
      .setTitle('📊 Deployment Report')
      .setDescription(report)
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error generating deployment report:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Generate Report')
      .setDescription(error.response?.data?.error || 'Failed to generate deployment report')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

export const data = new SlashCommandBuilder()
  .setName('optimize')
  .setDescription('🔧 Analyze and optimize cluster resource allocation')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('analyze')
      .setDescription('Analyze namespace for optimization opportunities')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace to analyze')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('presets')
      .setDescription('View resource optimization presets')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'analyze') {
    await handleAnalyze(interaction);
  } else if (subcommand === 'presets') {
    await handlePresets(interaction);
  }
}

async function handleAnalyze(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const namespace = interaction.options.getString('namespace', true);

  await interaction.deferReply();

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/optimizer/analyze`,
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
      .setTitle('💰 Resource Optimization Report')
      .setDescription(`Namespace: **${namespace}**`)
      .setColor(0x00ff00)
      .addFields(
        {
          name: '📊 Overview',
          value: `Total Pods: ${report.totalPods}\nOver-provisioned: ${report.overProvisionedPods}\nUnder-provisioned: ${report.underProvisionedPods}`,
          inline: false
        },
        {
          name: '💸 Savings',
          value: `Estimated Monthly: **$${report.estimatedMonthlySavings}**\nWaste: **${report.wastePercentage}%**`,
          inline: false
        }
      )
      .setTimestamp();

    // Add recommendations
    if (report.recommendations.length > 0) {
      const topRecommendations = report.recommendations.slice(0, 5);

      let recommendationText = '';
      for (const rec of topRecommendations) {
        const priorityEmoji = {
          high: '🔴',
          medium: '🟡',
          low: '🟢'
        }[rec.priority];

        recommendationText += `${priorityEmoji} **${rec.resource}**\n`;
        recommendationText += `• Current: ${rec.current.request || 'none'} → ${rec.current.limit || 'none'}\n`;
        recommendationText += `• Recommended: ${rec.recommended.request} → ${rec.recommended.limit}\n`;
        recommendationText += `• Reason: ${rec.reason}\n\n`;
      }

      embed.addFields({
        name: `🎯 Top Recommendations (${report.recommendations.length} total)`,
        value: recommendationText || 'No recommendations',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error analyzing namespace:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Analysis Failed')
      .setDescription(
        error.response?.data?.details?.explanation ||
          error.response?.data?.error ||
          'Failed to analyze namespace'
      )
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handlePresets(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const response = await axios.get(`${BACKEND_URL}/api/optimizer/presets`);

    const presets = response.data.presets;

    const embed = new EmbedBuilder()
      .setTitle('📋 Resource Optimization Presets')
      .setDescription('Pre-configured resource settings for common workload types')
      .setColor(0x0099ff);

    for (const [name, config] of Object.entries(presets) as any) {
      const cpuConfig = config.cpu;
      const memConfig = config.memory;

      embed.addFields({
        name: `**${name.replace(/-/g, ' ').toUpperCase()}**`,
        value: `CPU: ${cpuConfig.request} → ${cpuConfig.limit}\nMemory: ${memConfig.request} → ${memConfig.limit}`,
        inline: true
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error fetching presets:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Fetch Presets')
      .setDescription('Could not retrieve optimization presets')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

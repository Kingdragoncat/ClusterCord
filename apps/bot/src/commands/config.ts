import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder
} from 'discord.js';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('⚙️ View and manage your ClusterCord configuration')
  .addSubcommand((subcommand) =>
    subcommand.setName('view').setDescription('View current configuration')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('set')
      .setDescription('Update configuration')
      .addStringOption((option) =>
        option
          .setName('key')
          .setDescription('Configuration key to update')
          .setRequired(true)
          .addChoices(
            { name: 'Email', value: 'email' },
            { name: 'Default Cluster', value: 'defaultCluster' },
            { name: 'Default Namespace', value: 'defaultNamespace' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('value')
          .setDescription('New value')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'view') {
    await handleView(interaction);
  } else if (subcommand === 'set') {
    await handleSet(interaction);
  }
}

async function handleView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const response = await axios.get(
      `${BACKEND_URL}/api/users/${interaction.user.id}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const user = response.data.user;

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Your Configuration')
      .setDescription(`**User**: ${interaction.user.tag}`)
      .setColor(0x0099ff)
      .addFields(
        {
          name: '📧 Email',
          value: user.email || 'Not set',
          inline: true
        },
        {
          name: '✅ Email Verified',
          value: user.emailVerified ? 'Yes' : 'No',
          inline: true
        },
        {
          name: '🎯 Clusters',
          value: user.clusterCount?.toString() || '0',
          inline: true
        },
        {
          name: '📦 Assigned Namespace',
          value: user.assignedNamespace || 'None',
          inline: true
        },
        {
          name: '🔐 Service Account',
          value: user.serviceAccountName || 'Not created',
          inline: true
        },
        {
          name: '🌐 Trusted IPs',
          value: user.trustedIps?.length?.toString() || '0',
          inline: true
        }
      )
      .addFields({
        name: '📝 Account Info',
        value:
          `**Created**: ${new Date(user.createdAt).toLocaleDateString()}\n` +
          `**Last Verified**: ${user.lastVerifiedAt ? new Date(user.lastVerifiedAt).toLocaleDateString() : 'Never'}`,
        inline: false
      })
      .setFooter({ text: 'Use /config set to update configuration' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error fetching config:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Fetch Configuration')
      .setDescription(
        error.response?.data?.error || 'Failed to retrieve your configuration'
      )
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleSet(interaction: ChatInputCommandInteraction) {
  const key = interaction.options.getString('key', true);
  const value = interaction.options.getString('value', true);

  await interaction.deferReply({ ephemeral: true });

  try {
    await axios.put(
      `${BACKEND_URL}/api/users/${interaction.user.id}`,
      {
        [key]: value
      },
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const embed = new EmbedBuilder()
      .setTitle('✅ Configuration Updated')
      .setDescription(`Successfully updated **${key}** to \`${value}\``)
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error updating config:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Update Configuration')
      .setDescription(
        error.response?.data?.error || 'Failed to update configuration'
      )
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { ClusterCordEmbeds } from '@clustercord/ui';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cluster')
    .setDescription('Manage Kubernetes clusters')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a new cluster')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('Cluster name')
            .setRequired(true)
        )
        .addAttachmentOption(option =>
          option
            .setName('kubeconfig')
            .setDescription('Kubeconfig file')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all your clusters')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a cluster')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('Cluster name')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Get cluster status')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('Cluster name')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'add':
          await handleAdd(interaction);
          break;
        case 'list':
          await handleList(interaction);
          break;
        case 'remove':
          await handleRemove(interaction);
          break;
        case 'status':
          await handleStatus(interaction);
          break;
      }
    } catch (error: any) {
      console.error('[ERROR] Cluster command failed:', error);
      await interaction.reply({
        embeds: [ClusterCordEmbeds.error('Command Failed', error.message)],
        ephemeral: true
      });
    }
  }
};

async function handleAdd(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.options.getString('name', true);
  const attachment = interaction.options.getAttachment('kubeconfig', true);

  // Download kubeconfig
  const response = await axios.get(attachment.url);
  const kubeconfigContent = response.data;

  // Send to backend
  const result = await axios.post(`${BACKEND_URL}/api/clusters`, {
    name,
    kubeconfig: kubeconfigContent,
    discordUserId: interaction.user.id
  });

  await interaction.editReply({
    embeds: [ClusterCordEmbeds.success(
      'Cluster Added',
      `Successfully added cluster **${name}**`
    )]
  });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const response = await axios.get(`${BACKEND_URL}/api/clusters`, {
    params: { discordUserId: interaction.user.id }
  });

  const clusters = response.data;

  if (clusters.length === 0) {
    await interaction.editReply({
      embeds: [ClusterCordEmbeds.info('No Clusters', 'You have not added any clusters yet.')]
    });
    return;
  }

  const embed = ClusterCordEmbeds.info(
    `Your Clusters (${clusters.length})`,
    clusters.map((c: any) => `• **${c.name}** - ${c.endpoint || 'Unknown endpoint'}`).join('\n')
  );

  await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.options.getString('name', true);

  await axios.delete(`${BACKEND_URL}/api/clusters/${name}`, {
    params: { discordUserId: interaction.user.id }
  });

  await interaction.editReply({
    embeds: [ClusterCordEmbeds.success(
      'Cluster Removed',
      `Successfully removed cluster **${name}**`
    )]
  });
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.options.getString('name', true);

  const response = await axios.get(`${BACKEND_URL}/api/clusters/${name}/status`, {
    params: { discordUserId: interaction.user.id }
  });

  const cluster = response.data;

  await interaction.editReply({
    embeds: [ClusterCordEmbeds.clusterInfo(cluster)]
  });
}

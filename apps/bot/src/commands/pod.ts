import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ClusterCordEmbeds, Paginator } from '@clustercord/ui';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pod')
    .setDescription('Manage Kubernetes pods')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List pods in a namespace')
        .addStringOption(option =>
          option
            .setName('cluster')
            .setDescription('Cluster name')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('namespace')
            .setDescription('Namespace')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('logs')
        .setDescription('Get pod logs')
        .addStringOption(option =>
          option
            .setName('cluster')
            .setDescription('Cluster name')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('namespace')
            .setDescription('Namespace')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('pod')
            .setDescription('Pod name')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('tail')
            .setDescription('Number of lines to tail')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('describe')
        .setDescription('Describe a pod')
        .addStringOption(option =>
          option
            .setName('cluster')
            .setDescription('Cluster name')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('namespace')
            .setDescription('Namespace')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('pod')
            .setDescription('Pod name')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'list':
          await handleList(interaction);
          break;
        case 'logs':
          await handleLogs(interaction);
          break;
        case 'describe':
          await handleDescribe(interaction);
          break;
      }
    } catch (error: any) {
      console.error('[ERROR] Pod command failed:', error);
      await interaction.reply({
        embeds: [ClusterCordEmbeds.error('Command Failed', error.message)],
        ephemeral: true
      });
    }
  }
};

async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const cluster = interaction.options.getString('cluster', true);
  const namespace = interaction.options.getString('namespace', true);

  const response = await axios.get(`${BACKEND_URL}/api/pods`, {
    params: {
      discordUserId: interaction.user.id,
      cluster,
      namespace
    }
  });

  const pods = response.data;

  await interaction.editReply({
    embeds: [ClusterCordEmbeds.podList(namespace, pods)]
  });
}

async function handleLogs(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const cluster = interaction.options.getString('cluster', true);
  const namespace = interaction.options.getString('namespace', true);
  const pod = interaction.options.getString('pod', true);
  const tail = interaction.options.getInteger('tail') || 100;

  const response = await axios.get(`${BACKEND_URL}/api/pods/logs`, {
    params: {
      discordUserId: interaction.user.id,
      cluster,
      namespace,
      pod,
      tail
    }
  });

  const logs = response.data.logs;

  // Split logs into chunks if too long
  const chunks = splitIntoChunks(logs, 1900);

  if (chunks.length === 1) {
    await interaction.editReply({
      embeds: [
        ClusterCordEmbeds.info(
          `Logs: ${pod}`,
          `\`\`\`\n${chunks[0]}\n\`\`\``
        )
      ]
    });
  } else {
    const embeds = chunks.map((chunk, i) =>
      ClusterCordEmbeds.info(
        `Logs: ${pod} (${i + 1}/${chunks.length})`,
        `\`\`\`\n${chunk}\n\`\`\``
      )
    );

    const paginator = new Paginator({ embeds });
    await paginator.start(interaction);
  }
}

async function handleDescribe(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const cluster = interaction.options.getString('cluster', true);
  const namespace = interaction.options.getString('namespace', true);
  const pod = interaction.options.getString('pod', true);

  const response = await axios.get(`${BACKEND_URL}/api/pods/describe`, {
    params: {
      discordUserId: interaction.user.id,
      cluster,
      namespace,
      pod
    }
  });

  const podInfo = response.data;

  const embed = ClusterCordEmbeds.info(`Pod: ${pod}`)
    .addFields(
      { name: 'Namespace', value: podInfo.metadata?.namespace || 'Unknown', inline: true },
      { name: 'Status', value: podInfo.status?.phase || 'Unknown', inline: true },
      { name: 'Node', value: podInfo.spec?.nodeName || 'Unknown', inline: true },
      { name: 'IP', value: podInfo.status?.podIP || 'Unknown', inline: true }
    );

  await interaction.editReply({ embeds: [embed] });
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > chunkSize) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

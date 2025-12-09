import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';
import axios from 'axios';

const API_BASE = process.env.BACKEND_URL || 'http://localhost:3000';

export const data = new SlashCommandBuilder()
  .setName('recording')
  .setDescription('Manage terminal session recordings')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('List your terminal recordings')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Filter by cluster name')
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Filter by namespace')
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('limit')
          .setDescription('Maximum number of results (default: 10)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(50)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('playback')
      .setDescription('Play back a terminal recording')
      .addStringOption((option) =>
        option
          .setName('id')
          .setDescription('Recording ID')
          .setRequired(true)
      )
      .addNumberOption((option) =>
        option
          .setName('speed')
          .setDescription('Playback speed (default: 1.0)')
          .setRequired(false)
          .addChoices(
            { name: '0.5x', value: 0.5 },
            { name: '1x', value: 1.0 },
            { name: '2x', value: 2.0 },
            { name: '4x', value: 4.0 }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('export')
      .setDescription('Export a recording')
      .addStringOption((option) =>
        option
          .setName('id')
          .setDescription('Recording ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('format')
          .setDescription('Export format')
          .setRequired(false)
          .addChoices(
            { name: 'JSON', value: 'json' },
            { name: 'TTY (Plain text)', value: 'tty' },
            { name: 'HTML (Interactive)', value: 'html' },
            { name: 'Asciinema', value: 'asciicast' }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('delete')
      .setDescription('Delete a recording')
      .addStringOption((option) =>
        option
          .setName('id')
          .setDescription('Recording ID')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('stats')
      .setDescription('View your recording statistics')
  );

export async function execute(interaction: CommandInteraction) {
  const subcommand = interaction.options.data[0].name;

  try {
    switch (subcommand) {
      case 'list':
        await handleList(interaction);
        break;
      case 'playback':
        await handlePlayback(interaction);
        break;
      case 'export':
        await handleExport(interaction);
        break;
      case 'delete':
        await handleDelete(interaction);
        break;
      case 'stats':
        await handleStats(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
    }
  } catch (error: any) {
    console.error('Recording command error:', error);
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: `❌ Error: ${errorMessage}` });
    } else {
      await interaction.reply({ content: `❌ Error: ${errorMessage}`, ephemeral: true });
    }
  }
}

async function handleList(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const cluster = interaction.options.get('cluster')?.value as string | undefined;
  const namespace = interaction.options.get('namespace')?.value as string | undefined;
  const limit = (interaction.options.get('limit')?.value as number) || 10;

  const params = new URLSearchParams();
  params.append('userId', interaction.user.id);
  if (cluster) params.append('cluster', cluster);
  if (namespace) params.append('namespace', namespace);
  params.append('limit', limit.toString());

  const response = await axios.get(`${API_BASE}/api/recordings/search?${params.toString()}`);
  const recordings = response.data;

  if (recordings.length === 0) {
    await interaction.editReply('No recordings found.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📹 Terminal Recordings')
    .setColor(0x0099ff)
    .setTimestamp();

  recordings.forEach((recording: any, index: number) => {
    const duration = formatDuration(recording.duration);
    const date = new Date(recording.createdAt).toLocaleString();

    embed.addFields({
      name: `${index + 1}. ${recording.cluster.name} / ${recording.podName}`,
      value:
        `**ID:** \`${recording.id}\`\n` +
        `**Namespace:** ${recording.namespace}\n` +
        `**Duration:** ${duration}\n` +
        `**Commands:** ${recording.commandCount}\n` +
        `**Date:** ${date}\n` +
        `**Size:** ${formatBytes(recording.size)}`,
      inline: false,
    });
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handlePlayback(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const id = interaction.options.get('id', true).value as string;
  const speed = (interaction.options.get('speed')?.value as number) || 1.0;

  const response = await axios.get(`${API_BASE}/api/recordings/${id}/playback`);
  const { metadata, frames } = response.data;

  const duration = formatDuration(Math.floor((metadata.endTime - metadata.startTime) / 1000));

  const embed = new EmbedBuilder()
    .setTitle('📹 Recording Playback')
    .setColor(0x0099ff)
    .addFields(
      { name: 'Duration', value: duration, inline: true },
      { name: 'Frames', value: frames.length.toString(), inline: true },
      { name: 'Speed', value: `${speed}x`, inline: true }
    )
    .setTimestamp();

  // Send initial embed
  await interaction.editReply({ embeds: [embed] });

  // Send frames in chunks (Discord has message length limits)
  const maxChunkSize = 1900; // Leave room for code blocks
  let currentChunk = '';
  let chunkCount = 0;

  for (const frame of frames) {
    const frameText = frame.data;

    if (currentChunk.length + frameText.length > maxChunkSize) {
      // Send current chunk
      if (currentChunk.length > 0) {
        await interaction.followUp({
          content: `\`\`\`\n${currentChunk}\n\`\`\``,
          ephemeral: true,
        });
        currentChunk = '';
        chunkCount++;

        // Add delay for playback effect (adjusted by speed)
        if (chunkCount < 10) { // Limit to prevent spam
          await new Promise((resolve) => setTimeout(resolve, 1000 / speed));
        }
      }
    }

    currentChunk += frameText;
  }

  // Send remaining chunk
  if (currentChunk.length > 0) {
    await interaction.followUp({
      content: `\`\`\`\n${currentChunk}\n\`\`\``,"
      ephemeral: true,
    });
  }

  await interaction.followUp({
    content: '✅ Playback complete!',
    ephemeral: true,
  });
}

async function handleExport(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const id = interaction.options.get('id', true).value as string;
  const format = (interaction.options.get('format')?.value as string) || 'json';

  const response = await axios.get(`${API_BASE}/api/recordings/${id}/export`, {
    params: { format },
    responseType: format === 'html' ? 'text' : 'json',
  });

  let filename = `recording-${id}`;
  let extension = '.json';
  let contentType = 'application/json';

  switch (format) {
    case 'tty':
      extension = '.txt';
      contentType = 'text/plain';
      break;
    case 'html':
      extension = '.html';
      contentType = 'text/html';
      break;
    case 'asciicast':
      extension = '.cast';
      contentType = 'application/x-asciicast';
      break;
  }

  filename += extension;

  const content = typeof response.data === 'string'
    ? response.data
    : JSON.stringify(response.data, null, 2);

  const buffer = Buffer.from(content, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: filename });

  const embed = new EmbedBuilder()
    .setTitle('📥 Recording Export')
    .setColor(0x00ff00)
    .addFields(
      { name: 'Format', value: format.toUpperCase(), inline: true },
      { name: 'Size', value: formatBytes(buffer.length), inline: true }
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    files: [attachment],
  });
}

async function handleDelete(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const id = interaction.options.get('id', true).value as string;

  await axios.delete(`${API_BASE}/api/recordings/${id}`, {
    params: { userId: interaction.user.id },
  });

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Recording Deleted')
    .setDescription(`Successfully deleted recording \`${id}\``)
    .setColor(0xff0000)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleStats(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const response = await axios.get(`${API_BASE}/api/recordings/stats`, {
    params: { userId: interaction.user.id },
  });

  const stats = response.data;

  const embed = new EmbedBuilder()
    .setTitle('📊 Recording Statistics')
    .setColor(0x0099ff)
    .addFields(
      {
        name: 'Total Recordings',
        value: stats.totalRecordings.toString(),
        inline: true
      },
      {
        name: 'Total Duration',
        value: formatDuration(stats.totalDuration),
        inline: true
      },
      {
        name: 'Average Duration',
        value: formatDuration(stats.avgDuration),
        inline: true
      },
      {
        name: 'Total Storage',
        value: formatBytes(stats.totalSize),
        inline: true
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

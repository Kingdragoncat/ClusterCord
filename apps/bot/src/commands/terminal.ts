import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ClusterCordEmbeds } from '@clustercord/ui';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('terminal')
    .setDescription('Manage terminal sessions')
    .addSubcommand(subcommand =>
      subcommand
        .setName('exec')
        .setDescription('Start a terminal session')
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
        .addStringOption(option =>
          option
            .setName('container')
            .setDescription('Container name')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('shell')
            .setDescription('Shell to use')
            .setRequired(false)
            .addChoices(
              { name: '/bin/sh', value: '/bin/sh' },
              { name: '/bin/bash', value: '/bin/bash' },
              { name: '/bin/zsh', value: '/bin/zsh' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('verify')
        .setDescription('Verify OTP code')
        .addStringOption(option =>
          option
            .setName('code')
            .setDescription('6-digit verification code')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('kill')
        .setDescription('Kill a terminal session')
        .addStringOption(option =>
          option
            .setName('session')
            .setDescription('Session ID')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'exec':
          await handleExec(interaction);
          break;
        case 'verify':
          await handleVerify(interaction);
          break;
        case 'kill':
          await handleKill(interaction);
          break;
      }
    } catch (error: any) {
      console.error('[ERROR] Terminal command failed:', error);
      await interaction.reply({
        embeds: [ClusterCordEmbeds.error('Command Failed', error.message)],
        ephemeral: true
      });
    }
  }
};

async function handleExec(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const cluster = interaction.options.getString('cluster', true);
  const namespace = interaction.options.getString('namespace', true);
  const pod = interaction.options.getString('pod', true);
  const container = interaction.options.getString('container');
  const shell = interaction.options.getString('shell') || '/bin/sh';

  // Request terminal session from backend
  const response = await axios.post(`${BACKEND_URL}/api/terminal/start`, {
    discordUserId: interaction.user.id,
    cluster,
    namespace,
    pod,
    container,
    shell
  });

  const { requiresOTP, sessionId, expiresAt } = response.data;

  if (requiresOTP) {
    await interaction.editReply({
      embeds: [ClusterCordEmbeds.otpVerification(new Date(expiresAt))]
    });
  } else {
    // Send DM with terminal session info
    try {
      const dm = await interaction.user.createDM();
      await dm.send({
        embeds: [
          ClusterCordEmbeds.terminalSession({
            pod,
            namespace,
            container: container || undefined,
            expiresAt: new Date(expiresAt)
          })
        ]
      });

      await interaction.editReply({
        embeds: [
          ClusterCordEmbeds.success(
            'Terminal Session Started',
            `Check your DMs for the terminal interface.\n\nSession ID: \`${sessionId}\``
          )
        ]
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [
          ClusterCordEmbeds.error(
            'Failed to Open DM',
            'Please enable DMs from server members to use terminal sessions.'
          )
        ]
      });
    }
  }
}

async function handleVerify(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const code = interaction.options.getString('code', true);

  const response = await axios.post(`${BACKEND_URL}/api/terminal/verify`, {
    discordUserId: interaction.user.id,
    code
  });

  const { sessionId, expiresAt, pod, namespace, container } = response.data;

  // Send DM with terminal session info
  try {
    const dm = await interaction.user.createDM();
    await dm.send({
      embeds: [
        ClusterCordEmbeds.terminalSession({
          pod,
          namespace,
          container,
          expiresAt: new Date(expiresAt)
        })
      ]
    });

    await interaction.editReply({
      embeds: [
        ClusterCordEmbeds.success(
          'Verification Successful',
          `Check your DMs for the terminal interface.\n\nSession ID: \`${sessionId}\``
        )
      ]
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [
        ClusterCordEmbeds.error(
          'Failed to Open DM',
          'Please enable DMs from server members to use terminal sessions.'
        )
      ]
    });
  }
}

async function handleKill(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const sessionId = interaction.options.getString('session', true);

  await axios.post(`${BACKEND_URL}/api/terminal/kill`, {
    discordUserId: interaction.user.id,
    sessionId
  });

  await interaction.editReply({
    embeds: [ClusterCordEmbeds.success('Session Killed', `Session ${sessionId} has been terminated.`)]
  });
}

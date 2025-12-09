import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('🛠️ Initial setup wizard for ClusterCord');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Check if user already exists
    const response = await axios.get(`${BACKEND_URL}/api/users/${interaction.user.id}`, {
      headers: {
        Authorization: `Bearer ${interaction.user.id}`
      }
    }).catch(() => null);

    const userExists = response?.data?.user;

    if (userExists) {
      await showExistingUserSetup(interaction, userExists);
    } else {
      await showNewUserSetup(interaction);
    }
  } catch (error: any) {
    console.error('Error in setup:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Setup Failed')
      .setDescription('Failed to initialize setup. Please try again.')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function showNewUserSetup(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('👋 Welcome to ClusterCord!')
    .setDescription(
      '**Let\'s get you started!**\n\n' +
        'ClusterCord helps you manage Kubernetes clusters directly from Discord. ' +
        'This setup wizard will walk you through:\n\n' +
        '1️⃣ **Email Verification** - For OTP security\n' +
        '2️⃣ **Cluster Registration** - Connect your first cluster\n' +
        '3️⃣ **Namespace Setup** - Configure isolation\n\n' +
        '**Features you\'ll unlock:**\n' +
        '• 🎯 Multi-cluster management\n' +
        '• 💻 Real-time terminal access\n' +
        '• 🎨 One-click template deployments\n' +
        '• 📊 Resource optimization\n' +
        '• 🔐 Enterprise-grade security'
    )
    .setColor(0x00ff00)
    .addFields(
      {
        name: '📧 Step 1: Email Verification',
        value:
          'We\'ll send you a verification code to secure your terminal sessions.\n' +
          'Click **Start Setup** to begin!',
        inline: false
      }
    )
    .setFooter({ text: 'Setup takes about 2 minutes' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_start')
      .setLabel('Start Setup')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🚀'),
    new ButtonBuilder()
      .setCustomId('setup_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

async function showExistingUserSetup(
  interaction: ChatInputCommandInteraction,
  user: any
) {
  const embed = new EmbedBuilder()
    .setTitle('⚙️ Your ClusterCord Configuration')
    .setDescription('**Current Setup:**')
    .setColor(0x0099ff)
    .addFields(
      {
        name: '📧 Email',
        value: user.email || 'Not set',
        inline: true
      },
      {
        name: '✅ Verified',
        value: user.emailVerified ? 'Yes' : 'No',
        inline: true
      },
      {
        name: '🎯 Clusters',
        value: user.clusterCount?.toString() || '0',
        inline: true
      },
      {
        name: '📦 Namespace',
        value: user.assignedNamespace || 'Not assigned',
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
      name: '🛠️ Available Actions',
      value:
        '• `/config set` - Update email or settings\n' +
        '• `/cluster add` - Register a new cluster\n' +
        '• `/cluster bootstrap` - Setup namespace isolation\n' +
        '• `/help` - View all available commands',
      inline: false
    })
    .setFooter({ text: 'Last verified: ' + (user.lastVerifiedAt || 'Never') })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

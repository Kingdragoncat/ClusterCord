import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder
} from 'discord.js';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

export const data = new SlashCommandBuilder()
  .setName('about')
  .setDescription('ℹ️ About ClusterCord - features, version, and stats');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // Get bot stats from backend
    const response = await axios.get(`${BACKEND_URL}/api/stats`).catch(() => null);
    const stats = response?.data || {};

    const embed = new EmbedBuilder()
      .setTitle('🚀 ClusterCord')
      .setDescription(
        '**The most comprehensive Kubernetes management platform for Discord**\n\n' +
          'ClusterCord transforms Discord into a powerful command center for managing ' +
          'Kubernetes clusters with enterprise-grade security, intelligent automation, ' +
          'and effortless deployment capabilities.'
      )
      .setColor(0x0099ff)
      .setThumbnail(interaction.client.user?.displayAvatarURL() || '')
      .addFields(
        {
          name: '📊 Statistics',
          value:
            `**Total Users**: ${stats.totalUsers || 0}\n` +
            `**Clusters Managed**: ${stats.totalClusters || 0}\n` +
            `**Deployments Tracked**: ${stats.totalDeployments || 0}\n` +
            `**Terminal Sessions**: ${stats.totalSessions || 0}`,
          inline: true
        },
        {
          name: '🎯 Core Features',
          value:
            '• **60+ Production Features**\n' +
            '• Multi-cluster management\n' +
            '• Real-time terminal access\n' +
            '• Session recording & replay\n' +
            '• Homelab templates\n' +
            '• Resource optimization',
          inline: true
        }
      )
      .addFields({
        name: '🔐 Security Features',
        value:
          '• Smart error explanation (10 patterns)\n' +
          '• Secret redaction (25+ types)\n' +
          '• Approval flows for dangerous ops\n' +
          '• OTP verification\n' +
          '• Complete audit logging\n' +
          '• AES-256-GCM encryption',
        inline: false
      })
      .addFields({
        name: '🎨 Built-in Templates',
        value:
          '• 🎮 Minecraft Server\n' +
          '• 🎬 Plex Media Server\n' +
          '• 🦊 GitLab CE\n' +
          '• 📊 Prometheus + Grafana\n' +
          '• 🐘 PostgreSQL HA',
        inline: true
      })
      .addFields({
        name: '🧪 Advanced Capabilities',
        value:
          '• Chaos engineering (7 types)\n' +
          '• Deployment analytics\n' +
          '• Cost optimization\n' +
          '• Policy enforcement\n' +
          '• GitOps integration',
        inline: true
      })
      .addFields({
        name: '📦 Technology Stack',
        value:
          '• **Node.js** 18+ with TypeScript\n' +
          '• **Discord.js** 14\n' +
          '• **Fastify** REST API\n' +
          '• **PostgreSQL** + Prisma ORM\n' +
          '• **Kubernetes** client-node',
        inline: false
      })
      .addFields({
        name: '🔗 Links',
        value:
          '[GitHub](https://github.com/clustercord) • ' +
          '[Documentation](https://github.com/clustercord/docs) • ' +
          '[Support](https://discord.gg/clustercord) • ' +
          '[Website](https://clustercord.dev)',
        inline: false
      })
      .addFields({
        name: '⚖️ License',
        value: 'MIT License - Open Source',
        inline: true
      })
      .addFields({
        name: '📝 Version',
        value: process.env.npm_package_version || '1.0.0',
        inline: true
      })
      .setFooter({
        text: 'Made with ❤️ for the DevOps community | Use /help to get started'
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error fetching about info:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('ℹ️ ClusterCord')
      .setDescription(
        'The most comprehensive Kubernetes management platform for Discord.\n\n' +
          'Use `/help` to see available commands!'
      )
      .setColor(0x0099ff);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('📚 Get help and view available commands')
  .addStringOption((option) =>
    option
      .setName('category')
      .setDescription('Command category to view')
      .setRequired(false)
      .addChoices(
        { name: '🎯 Cluster Management', value: 'cluster' },
        { name: '📦 Pod Operations', value: 'pod' },
        { name: '💻 Terminal & Recording', value: 'terminal' },
        { name: '🎨 Templates & Deployment', value: 'templates' },
        { name: '🔧 Optimization & Analytics', value: 'optimization' },
        { name: '🛠️ Setup & Configuration', value: 'setup' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const category = interaction.options.getString('category');

  if (!category) {
    await showMainHelp(interaction);
  } else {
    await showCategoryHelp(interaction, category);
  }
}

async function showMainHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('📚 ClusterCord Help')
    .setDescription(
      '**Welcome to ClusterCord!**\n\n' +
        'ClusterCord is the most comprehensive Kubernetes management bot for Discord. ' +
        'Manage clusters, deploy templates, track deployments, and optimize resources - all from Discord!\n\n' +
        '**Choose a category below to see available commands:**'
    )
    .setColor(0x0099ff)
    .addFields(
      {
        name: '🎯 Cluster Management',
        value: 'Register clusters, manage namespaces, view cluster info',
        inline: true
      },
      {
        name: '📦 Pod Operations',
        value: 'List pods, view logs, describe resources, delete pods',
        inline: true
      },
      {
        name: '💻 Terminal & Recording',
        value: 'Interactive terminal access, session recording & replay',
        inline: true
      },
      {
        name: '🎨 Templates & Deployment',
        value: 'One-click homelab deployments (Minecraft, Plex, GitLab)',
        inline: true
      },
      {
        name: '🔧 Optimization & Analytics',
        value: 'Resource optimization, deployment tracking, cost analysis',
        inline: true
      },
      {
        name: '🛠️ Setup & Configuration',
        value: 'Bot configuration, user settings, cluster setup',
        inline: true
      }
    )
    .addFields({
      name: '🚀 Quick Start',
      value:
        '1. `/setup` - Initial bot configuration\n' +
        '2. `/cluster add` - Register your first cluster\n' +
        '3. `/template list` - Browse available templates\n' +
        '4. `/help category:cluster` - View cluster commands',
      inline: false
    })
    .addFields({
      name: '🔗 Useful Links',
      value:
        '[Documentation](https://github.com/clustercord/docs) • ' +
        '[GitHub](https://github.com/clustercord) • ' +
        '[Support Server](https://discord.gg/clustercord)',
      inline: false
    })
    .setFooter({ text: 'Use /help category:<name> for detailed command info' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function showCategoryHelp(
  interaction: ChatInputCommandInteraction,
  category: string
) {
  const embeds: Record<string, EmbedBuilder> = {
    cluster: new EmbedBuilder()
      .setTitle('🎯 Cluster Management Commands')
      .setColor(0x00ff00)
      .setDescription('Manage your Kubernetes clusters')
      .addFields(
        {
          name: '/cluster add',
          value:
            '**Register a new cluster**\n' +
            '```\n/cluster add name:prod context:minikube\n```\n' +
            'Upload your kubeconfig when prompted.',
          inline: false
        },
        {
          name: '/cluster list',
          value: '**List all registered clusters**\n```\n/cluster list\n```',
          inline: false
        },
        {
          name: '/cluster remove',
          value:
            '**Remove a cluster**\n' +
            '```\n/cluster remove cluster:prod\n```\n' +
            '⚠️ Requires approval',
          inline: false
        },
        {
          name: '/cluster bootstrap',
          value:
            '**Setup namespace isolation**\n```\n/cluster bootstrap cluster:prod\n```',
          inline: false
        }
      ),

    pod: new EmbedBuilder()
      .setTitle('📦 Pod Operations Commands')
      .setColor(0x0099ff)
      .setDescription('Manage pods and view logs')
      .addFields(
        {
          name: '/pod list',
          value:
            '**List all pods**\n' +
            '```\n/pod list cluster:prod namespace:default\n```',
          inline: false
        },
        {
          name: '/pod logs',
          value:
            '**View pod logs**\n' +
            '```\n/pod logs pod:web-123 tail:100 follow:true\n```',
          inline: false
        },
        {
          name: '/pod describe',
          value: '**Describe a pod**\n```\n/pod describe pod:web-123\n```',
          inline: false
        },
        {
          name: '/pod delete',
          value:
            '**Delete a pod**\n' +
            '```\n/pod delete pod:web-123\n```\n' +
            '⚠️ Requires approval',
          inline: false
        }
      ),

    terminal: new EmbedBuilder()
      .setTitle('💻 Terminal & Recording Commands')
      .setColor(0xff9900)
      .setDescription('Interactive shell access with recording')
      .addFields(
        {
          name: '/terminal start',
          value:
            '**Start interactive terminal**\n' +
            '```\n/terminal start pod:web-123 container:app\n```\n' +
            'Opens WebSocket terminal session with OTP verification.',
          inline: false
        },
        {
          name: '/terminal kill',
          value:
            '**Kill active session**\n```\n/terminal kill session:abc-123\n```',
          inline: false
        },
        {
          name: '/recording list',
          value: '**List all recordings**\n```\n/recording list limit:10\n```',
          inline: false
        },
        {
          name: '/recording view',
          value: '**View recording details**\n```\n/recording view id:abc-123\n```',
          inline: false
        },
        {
          name: '/recording replay',
          value:
            '**Replay session in Discord**\n```\n/recording replay id:abc-123\n```',
          inline: false
        }
      ),

    templates: new EmbedBuilder()
      .setTitle('🎨 Templates & Deployment Commands')
      .setColor(0xff00ff)
      .setDescription('One-click deployments for common applications')
      .addFields(
        {
          name: '/template list',
          value:
            '**Browse templates by category**\n' +
            '```\n/template list category:gaming\n```\n' +
            'Categories: gaming, media, cicd, monitoring, databases',
          inline: false
        },
        {
          name: '/template deploy',
          value:
            '**Deploy a template**\n' +
            '```\n/template deploy template:minecraft namespace:games\n```\n' +
            'Built-in templates: Minecraft, Plex, GitLab, Monitoring, PostgreSQL',
          inline: false
        },
        {
          name: '/template info',
          value:
            '**Get template details**\n```\n/template info template:minecraft\n```',
          inline: false
        }
      ),

    optimization: new EmbedBuilder()
      .setTitle('🔧 Optimization & Analytics Commands')
      .setColor(0x00ffff)
      .setDescription('Optimize resources and track deployments')
      .addFields(
        {
          name: '/optimize analyze',
          value:
            '**Analyze namespace for optimization**\n' +
            '```\n/optimize analyze cluster:prod namespace:default\n```\n' +
            'Detects: over-provisioning, missing limits, waste percentage',
          inline: false
        },
        {
          name: '/optimize presets',
          value:
            '**View optimization presets**\n```\n/optimize presets\n```\n' +
            'Presets: micro-service, api-backend, web-frontend, database, worker, batch',
          inline: false
        },
        {
          name: '/deployment stats',
          value:
            '**View deployment statistics**\n' +
            '```\n/deployment stats cluster:prod namespace:default\n```\n' +
            'Shows: success rate, average duration, failure reasons',
          inline: false
        },
        {
          name: '/deployment history',
          value:
            '**View deployment history**\n' +
            '```\n/deployment history deployment:api limit:10\n```',
          inline: false
        },
        {
          name: '/deployment report',
          value:
            '**Generate deployment report**\n```\n/deployment report namespace:prod\n```',
          inline: false
        }
      ),

    setup: new EmbedBuilder()
      .setTitle('🛠️ Setup & Configuration Commands')
      .setColor(0xffff00)
      .setDescription('Configure bot and user settings')
      .addFields(
        {
          name: '/setup',
          value:
            '**Initial bot configuration**\n' +
            '```\n/setup\n```\n' +
            'Walks you through email verification, cluster registration, and namespace setup.',
          inline: false
        },
        {
          name: '/config view',
          value: '**View current configuration**\n```\n/config view\n```',
          inline: false
        },
        {
          name: '/config set',
          value:
            '**Update configuration**\n' +
            '```\n/config set key:email value:user@example.com\n```',
          inline: false
        },
        {
          name: '/about',
          value:
            '**About ClusterCord**\n```\n/about\n```\nView version, features, and stats.',
          inline: false
        },
        {
          name: '/status',
          value:
            '**Bot status & health**\n```\n/status\n```\nCheck backend connectivity and cluster health.',
          inline: false
        }
      )
  };

  const embed = embeds[category];
  if (!embed) {
    await interaction.reply({
      content: '❌ Invalid category',
      ephemeral: true
    });
    return;
  }

  embed.setFooter({ text: 'Use /help to see all categories' });
  embed.setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType
} from 'discord.js';
import axios from 'axios';

const API_BASE = process.env.BACKEND_URL || 'http://localhost:3000';

export const data = new SlashCommandBuilder()
  .setName('template')
  .setDescription('Deploy homelab templates to your cluster')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('List available templates')
      .addStringOption((option) =>
        option
          .setName('category')
          .setDescription('Filter by category')
          .setRequired(false)
          .addChoices(
            { name: 'Gaming', value: 'GAMING' },
            { name: 'Media', value: 'MEDIA' },
            { name: 'Development', value: 'DEVELOPMENT' },
            { name: 'Monitoring', value: 'MONITORING' },
            { name: 'Databases', value: 'DATABASES' },
            { name: 'CI/CD', value: 'CICD' }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('deploy')
      .setDescription('Deploy a template to your cluster')
      .addStringOption((option) =>
        option
          .setName('template')
          .setDescription('Template name')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Target cluster name')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Target namespace')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('info')
      .setDescription('Get detailed information about a template')
      .addStringOption((option) =>
        option
          .setName('template')
          .setDescription('Template name or ID')
          .setRequired(true)
      )
  );

export async function execute(interaction: CommandInteraction) {
  const subcommand = interaction.options.data[0].name;

  try {
    switch (subcommand) {
      case 'list':
        await handleList(interaction);
        break;
      case 'deploy':
        await handleDeploy(interaction);
        break;
      case 'info':
        await handleInfo(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
    }
  } catch (error: any) {
    console.error('Template command error:', error);
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

  const category = interaction.options.get('category')?.value as string | undefined;

  const params = new URLSearchParams();
  if (category) params.append('category', category);

  const response = await axios.get(`${API_BASE}/api/templates?${params.toString()}`);
  const templates = response.data;

  if (templates.length === 0) {
    await interaction.editReply('No templates found.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎯 Homelab Templates${category ? ` - ${category}` : ''}`)
    .setDescription('One-click deployments for your homelab cluster')
    .setColor(0x5865f2)
    .setTimestamp();

  // Group by category
  const grouped: Record<string, any[]> = {};
  for (const template of templates) {
    if (!grouped[template.category]) {
      grouped[template.category] = [];
    }
    grouped[template.category].push(template);
  }

  for (const [cat, temps] of Object.entries(grouped)) {
    const categoryIcon = getCategoryIcon(cat);
    const templateList = temps
      .map((t) => {
        const verified = t.verified ? '✅' : '';
        const popularity = '⭐'.repeat(Math.min(Math.floor(t.popularity / 10), 5));
        return `${verified} **${t.name}** ${popularity}\n   ${t.description}`;
      })
      .join('\n\n');

    embed.addFields({
      name: `${categoryIcon} ${cat}`,
      value: templateList || 'No templates',
      inline: false
    });
  }

  embed.setFooter({
    text: `${templates.length} templates available • Use /template deploy to install`
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleDeploy(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const templateName = interaction.options.get('template', true).value as string;
  const cluster = interaction.options.get('cluster', true).value as string;
  const namespace = interaction.options.get('namespace', true).value as string;

  // Find template by name
  const templatesResponse = await axios.get(`${API_BASE}/api/templates`);
  const template = templatesResponse.data.find(
    (t: any) => t.name.toLowerCase() === templateName.toLowerCase()
  );

  if (!template) {
    await interaction.editReply(`❌ Template "${templateName}" not found.`);
    return;
  }

  // Check if template requires variables
  const variables: Record<string, any> = {};

  // For now, use default values
  // TODO: Implement interactive variable collection
  if (template.name === 'Minecraft Server') {
    variables.VERSION = '1.20.4';
    variables.MEMORY = '2G';
    variables.DIFFICULTY = 'normal';
    variables.MAX_PLAYERS = '20';
  } else if (template.name === 'Plex Media Server') {
    variables.TIMEZONE = 'America/New_York';
    variables.PLEX_CLAIM = '';
    variables.MEDIA_PATH = '/media';
  } else if (template.name === 'GitLab CE') {
    variables.EXTERNAL_URL = 'http://gitlab.local';
  } else if (template.name === 'Full Monitoring Stack') {
    variables.GRAFANA_PASSWORD = 'admin';
  }

  const embed = new EmbedBuilder()
    .setTitle('🚀 Deploying Template')
    .setDescription(`Deploying **${template.name}** to cluster **${cluster}**`)
    .setColor(0xffa500)
    .addFields(
      { name: 'Cluster', value: cluster, inline: true },
      { name: 'Namespace', value: namespace, inline: true },
      { name: 'Template', value: template.name, inline: true }
    );

  await interaction.editReply({ embeds: [embed] });

  // Deploy template
  const deployResponse = await axios.post(`${API_BASE}/api/templates/${template.id}/deploy`, {
    discordUserId: interaction.user.id,
    cluster,
    namespace,
    variables
  });

  const results = deployResponse.data.results;
  const successCount = results.filter((r: any) => r.status === 'applied').length;
  const failCount = results.filter((r: any) => r.status === 'failed').length;

  const resultEmbed = new EmbedBuilder()
    .setTitle(failCount > 0 ? '⚠️ Deployment Partially Complete' : '✅ Deployment Successful')
    .setDescription(`**${template.name}** has been deployed to **${cluster}/${namespace}**`)
    .setColor(failCount > 0 ? 0xffa500 : 0x00ff00)
    .addFields(
      { name: 'Success', value: successCount.toString(), inline: true },
      { name: 'Failed', value: failCount.toString(), inline: true },
      { name: 'Deployment ID', value: deployResponse.data.deploymentId, inline: true }
    );

  // Add detailed results
  const manifestResults = results
    .filter((r: any) => r.type === 'manifest')
    .map((r: any) => `${r.status === 'applied' ? '✅' : '❌'} ${r.kind}/${r.name}`)
    .join('\n');

  if (manifestResults) {
    resultEmbed.addFields({
      name: 'Resources Deployed',
      value: manifestResults || 'None',
      inline: false
    });
  }

  await interaction.editReply({ embeds: [resultEmbed] });
}

async function handleInfo(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const templateName = interaction.options.get('template', true).value as string;

  // Find template by name
  const templatesResponse = await axios.get(`${API_BASE}/api/templates`);
  const template = templatesResponse.data.find(
    (t: any) => t.name.toLowerCase() === templateName.toLowerCase() || t.id === templateName
  );

  if (!template) {
    await interaction.editReply(`❌ Template "${templateName}" not found.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📦 ${template.name}`)
    .setDescription(template.description)
    .setColor(0x5865f2)
    .addFields(
      { name: 'Category', value: template.category, inline: true },
      { name: 'Popularity', value: template.popularity.toString(), inline: true },
      { name: 'Verified', value: template.verified ? '✅ Yes' : '❌ No', inline: true }
    );

  // Add manifest info
  const manifestCount = (template.manifests as any[]).length;
  const helmChartCount = ((template.helmCharts as any[]) || []).length;

  embed.addFields({
    name: 'Resources',
    value: `${manifestCount} Kubernetes manifests\n${helmChartCount} Helm charts`,
    inline: false
  });

  // List resource types
  const resourceTypes = (template.manifests as any[])
    .map((m: any) => m.kind)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');

  if (resourceTypes) {
    embed.addFields({
      name: 'Resource Types',
      value: resourceTypes,
      inline: false
    });
  }

  // Add deployment command
  embed.addFields({
    name: 'Deploy',
    value: `/template deploy template:${template.name} cluster:YOUR_CLUSTER namespace:default`,
    inline: false
  });

  embed.setFooter({
    text: `Template ID: ${template.id}`
  });

  await interaction.editReply({ embeds: [embed] });
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    GAMING: '🎮',
    MEDIA: '🎬',
    DEVELOPMENT: '💻',
    MONITORING: '📊',
    DATABASES: '🗄️',
    MESSAGING: '📨',
    CICD: '🔄',
    STORAGE: '💾',
    NETWORKING: '🌐',
    SECURITY: '🔒'
  };
  return icons[category] || '📦';
}

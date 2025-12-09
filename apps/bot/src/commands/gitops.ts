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
  .setName('gitops')
  .setDescription('🔄 Manage GitOps applications (ArgoCD / Flux)')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('detect')
      .setDescription('Auto-detect GitOps type in cluster')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('List all GitOps applications')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('GitOps type')
          .setRequired(true)
          .addChoices(
            { name: 'ArgoCD', value: 'ARGOCD' },
            { name: 'Flux', value: 'FLUX' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace (default: argocd or flux-system)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('status')
      .setDescription('Get application sync status')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('GitOps type')
          .setRequired(true)
          .addChoices(
            { name: 'ArgoCD', value: 'ARGOCD' },
            { name: 'Flux', value: 'FLUX' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Application name')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('sync')
      .setDescription('Sync application')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('GitOps type')
          .setRequired(true)
          .addChoices(
            { name: 'ArgoCD', value: 'ARGOCD' },
            { name: 'Flux', value: 'FLUX' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Application name')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace')
          .setRequired(true)
      )
      .addBooleanOption((option) =>
        option
          .setName('prune')
          .setDescription('Prune resources no longer in Git')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('diff')
      .setDescription('Show drift (changes not in Git)')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Application name')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace (default: argocd)')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'detect':
      await handleDetect(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    case 'status':
      await handleStatus(interaction);
      break;
    case 'sync':
      await handleSync(interaction);
      break;
    case 'diff':
      await handleDiff(interaction);
      break;
  }
}

async function handleDetect(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);

  await interaction.deferReply();

  try {
    const response = await axios.get(
      `${BACKEND_URL}/api/gitops/detect?clusterId=${clusterId}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const { gitopsType, detected } = response.data;

    const embed = new EmbedBuilder()
      .setTitle('🔍 GitOps Detection')
      .setColor(detected ? 0x00ff00 : 0xffaa00);

    if (detected) {
      embed.setDescription(
        `**Detected GitOps Type**: ${gitopsType === 'ARGOCD' ? '🦊 ArgoCD' : '🌊 Flux'}\n\n` +
          `Your cluster is running **${gitopsType}**! You can now use GitOps commands to manage your applications.`
      );

      embed.addFields({
        name: '📚 Next Steps',
        value:
          `• Use \`/gitops list\` to see all applications\n` +
          `• Use \`/gitops status\` to check sync status\n` +
          `• Use \`/gitops sync\` to trigger deployments`,
        inline: false
      });
    } else {
      embed.setDescription(
        '**No GitOps platform detected**\n\n' +
          'Neither ArgoCD nor Flux was found in your cluster.\n\n' +
          '**To install:**\n' +
          '• ArgoCD: `kubectl create namespace argocd && kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml`\n' +
          '• Flux: `flux install`'
      );
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error detecting GitOps:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Detection Failed')
      .setDescription(error.response?.data?.error || 'Failed to detect GitOps type')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const type = interaction.options.getString('type', true);
  const namespace = interaction.options.getString('namespace');

  await interaction.deferReply();

  try {
    const params = new URLSearchParams({
      clusterId,
      type
    });
    if (namespace) params.append('namespace', namespace);

    const response = await axios.get(
      `${BACKEND_URL}/api/gitops/apps?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const { apps, count } = response.data;

    const typeEmoji = type === 'ARGOCD' ? '🦊' : '🌊';
    const embed = new EmbedBuilder()
      .setTitle(`${typeEmoji} ${type} Applications`)
      .setDescription(`Found **${count}** application${count !== 1 ? 's' : ''}`)
      .setColor(0x0099ff)
      .setTimestamp();

    if (apps.length === 0) {
      embed.addFields({
        name: 'No Applications',
        value: 'No GitOps applications found in this cluster.',
        inline: false
      });
    } else {
      for (const app of apps.slice(0, 25)) {
        const syncEmoji = app.syncStatus === 'Synced' ? '✅' : '⚠️';
        const healthEmoji =
          app.healthStatus === 'Healthy' ? '💚' : app.healthStatus === 'Progressing' ? '🟡' : '❌';

        embed.addFields({
          name: `${syncEmoji} ${app.name}`,
          value:
            `**Namespace**: ${app.namespace}\n` +
            `**Sync**: ${app.syncStatus}\n` +
            `**Health**: ${healthEmoji} ${app.healthStatus}`,
          inline: true
        });
      }

      if (apps.length > 25) {
        embed.setFooter({ text: `Showing 25 of ${apps.length} applications` });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error listing apps:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to List Applications')
      .setDescription(error.response?.data?.error || 'Failed to list GitOps applications')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const type = interaction.options.getString('type', true);
  const name = interaction.options.getString('name', true);
  const namespace = interaction.options.getString('namespace', true);

  await interaction.deferReply();

  try {
    const params = new URLSearchParams({
      clusterId,
      type,
      name,
      namespace
    });

    const response = await axios.get(
      `${BACKEND_URL}/api/gitops/status?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const { status } = response.data;

    const syncEmoji = status.status === 'Synced' ? '✅' : '⚠️';
    const healthEmoji =
      status.health === 'Healthy'
        ? '💚'
        : status.health === 'Progressing'
        ? '🟡'
        : '❌';

    const embed = new EmbedBuilder()
      .setTitle(`${type === 'ARGOCD' ? '🦊' : '🌊'} ${name}`)
      .setDescription(`Namespace: **${namespace}**`)
      .setColor(status.status === 'Synced' && status.health === 'Healthy' ? 0x00ff00 : 0xffaa00)
      .addFields(
        {
          name: `${syncEmoji} Sync Status`,
          value: status.status,
          inline: true
        },
        {
          name: `${healthEmoji} Health Status`,
          value: status.health,
          inline: true
        },
        {
          name: '📦 Synced Revision',
          value: status.syncedRevision || 'N/A',
          inline: true
        },
        {
          name: '🎯 Target Revision',
          value: status.targetRevision || 'N/A',
          inline: true
        },
        {
          name: '🕐 Last Synced',
          value: status.lastSyncedAt
            ? new Date(status.lastSyncedAt).toLocaleString()
            : 'Never',
          inline: true
        }
      )
      .setTimestamp();

    if (status.conditions && status.conditions.length > 0) {
      const conditionsText = status.conditions
        .map((c: any) => `• **${c.type}**: ${c.status} - ${c.message || 'N/A'}`)
        .join('\n');

      embed.addFields({
        name: '📋 Conditions',
        value: conditionsText,
        inline: false
      });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`gitops_sync_${name}`)
        .setLabel('Sync Now')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId(`gitops_diff_${name}`)
        .setLabel('Show Diff')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊')
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error: any) {
    console.error('Error getting status:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Get Status')
      .setDescription(error.response?.data?.error || 'Failed to get application status')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleSync(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const type = interaction.options.getString('type', true);
  const name = interaction.options.getString('name', true);
  const namespace = interaction.options.getString('namespace', true);
  const prune = interaction.options.getBoolean('prune') || false;

  await interaction.deferReply();

  try {
    await axios.post(
      `${BACKEND_URL}/api/gitops/sync`,
      {
        clusterId,
        type,
        name,
        namespace,
        prune
      },
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const embed = new EmbedBuilder()
      .setTitle('🔄 Sync Triggered')
      .setDescription(
        `Successfully triggered sync for **${name}**\n\n` +
          `The application will reconcile with the Git repository shortly.`
      )
      .setColor(0x00ff00)
      .addFields(
        {
          name: 'Application',
          value: name,
          inline: true
        },
        {
          name: 'Namespace',
          value: namespace,
          inline: true
        },
        {
          name: 'Prune',
          value: prune ? 'Yes' : 'No',
          inline: true
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error syncing app:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Sync Failed')
      .setDescription(error.response?.data?.error || 'Failed to sync application')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleDiff(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const name = interaction.options.getString('name', true);
  const namespace = interaction.options.getString('namespace') || 'argocd';

  await interaction.deferReply();

  try {
    const params = new URLSearchParams({
      clusterId,
      name,
      namespace
    });

    const response = await axios.get(
      `${BACKEND_URL}/api/gitops/diff?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const { diff } = response.data;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Drift Detection: ${name}`)
      .setDescription(
        diff.drifted
          ? '⚠️ **Drift detected** - Cluster state differs from Git'
          : '✅ **In sync** - No drift detected'
      )
      .setColor(diff.drifted ? 0xffaa00 : 0x00ff00)
      .setTimestamp();

    if (diff.resources.length > 0) {
      const resourceText = diff.resources
        .slice(0, 20)
        .map(
          (r: any) =>
            `${r.status === 'InSync' ? '✅' : '⚠️'} **${r.kind}/${r.name}** (${r.namespace || 'cluster-scoped'})`
        )
        .join('\n');

      embed.addFields({
        name: `Resources (${diff.resources.length} total)`,
        value: resourceText || 'No resources',
        inline: false
      });

      if (diff.resources.length > 20) {
        embed.setFooter({ text: `Showing 20 of ${diff.resources.length} resources` });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error showing diff:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Show Diff')
      .setDescription(error.response?.data?.error || 'Failed to detect drift')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

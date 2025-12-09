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
  .setName('helm')
  .setDescription('📦 Helm chart management - install, upgrade, rollback charts')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('search')
      .setDescription('Search ArtifactHub for Helm charts')
      .addStringOption((option) =>
        option
          .setName('query')
          .setDescription('Search query (e.g., prometheus, nginx)')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('limit')
          .setDescription('Number of results (default: 10)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('List installed Helm releases')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace (optional, default: all)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('status')
      .setDescription('Get Helm release status')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('release')
          .setDescription('Release name')
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
      .setName('install')
      .setDescription('Install Helm chart')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('release')
          .setDescription('Release name')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('chart')
          .setDescription('Chart (e.g., bitnami/nginx)')
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
          .setName('create-namespace')
          .setDescription('Create namespace if it doesn\'t exist')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('upgrade')
      .setDescription('Upgrade Helm release')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('release')
          .setDescription('Release name')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('chart')
          .setDescription('Chart (e.g., bitnami/nginx)')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('version')
          .setDescription('Chart version (optional)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('rollback')
      .setDescription('Rollback Helm release')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('release')
          .setDescription('Release name')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('revision')
          .setDescription('Revision number (optional, default: previous)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('uninstall')
      .setDescription('Uninstall Helm release')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('release')
          .setDescription('Release name')
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
          .setName('keep-history')
          .setDescription('Keep release history')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('values')
      .setDescription('Get Helm release values')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('release')
          .setDescription('Release name')
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
      .setName('history')
      .setDescription('Get Helm release history')
      .addStringOption((option) =>
        option
          .setName('cluster')
          .setDescription('Cluster ID')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('release')
          .setDescription('Release name')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('namespace')
          .setDescription('Namespace')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'search':
      await handleSearch(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    case 'status':
      await handleStatus(interaction);
      break;
    case 'install':
      await handleInstall(interaction);
      break;
    case 'upgrade':
      await handleUpgrade(interaction);
      break;
    case 'rollback':
      await handleRollback(interaction);
      break;
    case 'uninstall':
      await handleUninstall(interaction);
      break;
    case 'values':
      await handleValues(interaction);
      break;
    case 'history':
      await handleHistory(interaction);
      break;
  }
}

async function handleSearch(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true);
  const limit = interaction.options.getInteger('limit') || 10;

  await interaction.deferReply();

  try {
    const response = await axios.get(
      `${BACKEND_URL}/api/helm/search?query=${encodeURIComponent(query)}&limit=${limit}`
    );

    const { results, count } = response.data;

    const embed = new EmbedBuilder()
      .setTitle(`📦 Helm Chart Search: "${query}"`)
      .setDescription(`Found **${count}** charts`)
      .setColor(0x0099ff)
      .setTimestamp();

    if (results.length === 0) {
      embed.addFields({
        name: 'No Results',
        value: `No charts found for "${query}". Try a different search term.`,
        inline: false
      });
    } else {
      for (const chart of results.slice(0, 10)) {
        embed.addFields({
          name: `📦 ${chart.name}`,
          value:
            `**Version**: ${chart.version}\n` +
            `**App Version**: ${chart.appVersion}\n` +
            `**Description**: ${chart.description.substring(0, 100)}${chart.description.length > 100 ? '...' : ''}\n` +
            `**Install**: \`/helm install release:${chart.name.split('/').pop()} chart:${chart.name} namespace:default\``,
          inline: false
        });
      }

      if (results.length > 10) {
        embed.setFooter({ text: `Showing 10 of ${results.length} results` });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error searching charts:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Search Failed')
      .setDescription(error.response?.data?.error || 'Failed to search Helm charts')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const namespace = interaction.options.getString('namespace');

  await interaction.deferReply();

  try {
    const params = new URLSearchParams({ clusterId });
    if (namespace) params.append('namespace', namespace);

    const response = await axios.get(
      `${BACKEND_URL}/api/helm/releases?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const { releases, count } = response.data;

    const embed = new EmbedBuilder()
      .setTitle('📦 Helm Releases')
      .setDescription(
        `Found **${count}** release${count !== 1 ? 's' : ''}` +
        (namespace ? ` in namespace **${namespace}**` : ' across all namespaces')
      )
      .setColor(0x0099ff)
      .setTimestamp();

    if (releases.length === 0) {
      embed.addFields({
        name: 'No Releases',
        value: 'No Helm releases found in this cluster.',
        inline: false
      });
    } else {
      for (const release of releases.slice(0, 25)) {
        const statusEmoji = release.status === 'deployed' ? '✅' : '⚠️';

        embed.addFields({
          name: `${statusEmoji} ${release.name}`,
          value:
            `**Namespace**: ${release.namespace}\n` +
            `**Chart**: ${release.chart}\n` +
            `**Version**: ${release.appVersion}\n` +
            `**Revision**: ${release.revision}\n` +
            `**Status**: ${release.status}\n` +
            `**Updated**: ${new Date(release.updated).toLocaleDateString()}`,
          inline: true
        });
      }

      if (releases.length > 25) {
        embed.setFooter({ text: `Showing 25 of ${releases.length} releases` });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error listing releases:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to List Releases')
      .setDescription(error.response?.data?.error || 'Failed to list Helm releases')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const releaseName = interaction.options.getString('release', true);
  const namespace = interaction.options.getString('namespace', true);

  await interaction.deferReply();

  try {
    const params = new URLSearchParams({ clusterId, namespace });

    const response = await axios.get(
      `${BACKEND_URL}/api/helm/releases/${releaseName}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const { release } = response.data;

    const statusEmoji = release.status === 'deployed' ? '✅' : '⚠️';

    const embed = new EmbedBuilder()
      .setTitle(`${statusEmoji} Helm Release: ${release.name}`)
      .setDescription(`Namespace: **${release.namespace}**`)
      .setColor(release.status === 'deployed' ? 0x00ff00 : 0xffaa00)
      .addFields(
        {
          name: '📦 Chart',
          value: release.chart,
          inline: true
        },
        {
          name: '🏷️ Version',
          value: release.appVersion,
          inline: true
        },
        {
          name: '🔄 Revision',
          value: release.revision,
          inline: true
        },
        {
          name: '📊 Status',
          value: release.status,
          inline: true
        },
        {
          name: '🕐 Updated',
          value: new Date(release.updated).toLocaleString(),
          inline: true
        }
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`helm_upgrade_${releaseName}`)
        .setLabel('Upgrade')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⬆️'),
      new ButtonBuilder()
        .setCustomId(`helm_rollback_${releaseName}`)
        .setLabel('Rollback')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⏪'),
      new ButtonBuilder()
        .setCustomId(`helm_values_${releaseName}`)
        .setLabel('Show Values')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📄')
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error: any) {
    console.error('Error getting release status:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Get Status')
      .setDescription(error.response?.data?.error || 'Failed to get Helm release status')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleInstall(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const releaseName = interaction.options.getString('release', true);
  const chart = interaction.options.getString('chart', true);
  const namespace = interaction.options.getString('namespace', true);
  const createNamespace = interaction.options.getBoolean('create-namespace') ?? true;

  await interaction.deferReply();

  try {
    await axios.post(
      `${BACKEND_URL}/api/helm/install`,
      {
        clusterId,
        releaseName,
        chart,
        namespace,
        createNamespace
      },
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const embed = new EmbedBuilder()
      .setTitle('✅ Helm Chart Installed')
      .setDescription(`Successfully installed **${chart}** as **${releaseName}**`)
      .setColor(0x00ff00)
      .addFields(
        {
          name: 'Release',
          value: releaseName,
          inline: true
        },
        {
          name: 'Namespace',
          value: namespace,
          inline: true
        },
        {
          name: 'Chart',
          value: chart,
          inline: true
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error installing chart:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Installation Failed')
      .setDescription(error.response?.data?.error || 'Failed to install Helm chart')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleUpgrade(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const releaseName = interaction.options.getString('release', true);
  const chart = interaction.options.getString('chart', true);
  const namespace = interaction.options.getString('namespace', true);
  const version = interaction.options.getString('version');

  await interaction.deferReply();

  try {
    const response = await axios.put(
      `${BACKEND_URL}/api/helm/upgrade`,
      {
        clusterId,
        releaseName,
        chart,
        namespace,
        version
      },
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const { revision } = response.data;

    const embed = new EmbedBuilder()
      .setTitle('✅ Helm Release Upgraded')
      .setDescription(`Successfully upgraded **${releaseName}** to revision **${revision}**`)
      .setColor(0x00ff00)
      .addFields(
        {
          name: 'Release',
          value: releaseName,
          inline: true
        },
        {
          name: 'Namespace',
          value: namespace,
          inline: true
        },
        {
          name: 'New Revision',
          value: revision,
          inline: true
        }
      )
      .setTimestamp();

    if (version) {
      embed.addFields({
        name: 'Version',
        value: version,
        inline: true
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error upgrading release:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Upgrade Failed')
      .setDescription(error.response?.data?.error || 'Failed to upgrade Helm release')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleRollback(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const releaseName = interaction.options.getString('release', true);
  const namespace = interaction.options.getString('namespace', true);
  const revision = interaction.options.getInteger('revision');

  await interaction.deferReply();

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/helm/rollback`,
      {
        clusterId,
        releaseName,
        namespace,
        revision
      },
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const { revision: currentRevision } = response.data;

    const embed = new EmbedBuilder()
      .setTitle('⏪ Helm Release Rolled Back')
      .setDescription(
        `Successfully rolled back **${releaseName}**` +
        (revision ? ` to revision **${revision}**` : ' to previous revision')
      )
      .setColor(0x00ff00)
      .addFields(
        {
          name: 'Release',
          value: releaseName,
          inline: true
        },
        {
          name: 'Namespace',
          value: namespace,
          inline: true
        },
        {
          name: 'Current Revision',
          value: currentRevision,
          inline: true
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error rolling back release:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Rollback Failed')
      .setDescription(error.response?.data?.error || 'Failed to rollback Helm release')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleUninstall(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const releaseName = interaction.options.getString('release', true);
  const namespace = interaction.options.getString('namespace', true);
  const keepHistory = interaction.options.getBoolean('keep-history') ?? false;

  await interaction.deferReply();

  try {
    await axios.delete(
      `${BACKEND_URL}/api/helm/releases/${releaseName}`,
      {
        data: {
          clusterId,
          namespace,
          keepHistory
        },
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Helm Release Uninstalled')
      .setDescription(`Successfully uninstalled **${releaseName}**`)
      .setColor(0x00ff00)
      .addFields(
        {
          name: 'Release',
          value: releaseName,
          inline: true
        },
        {
          name: 'Namespace',
          value: namespace,
          inline: true
        },
        {
          name: 'History Kept',
          value: keepHistory ? 'Yes' : 'No',
          inline: true
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error uninstalling release:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Uninstall Failed')
      .setDescription(error.response?.data?.error || 'Failed to uninstall Helm release')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleValues(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const releaseName = interaction.options.getString('release', true);
  const namespace = interaction.options.getString('namespace', true);

  await interaction.deferReply();

  try {
    const params = new URLSearchParams({ clusterId, namespace });

    const response = await axios.get(
      `${BACKEND_URL}/api/helm/releases/${releaseName}/values?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const { values } = response.data;

    const yaml = require('js-yaml');
    const valuesYaml = yaml.dump(values);

    const embed = new EmbedBuilder()
      .setTitle(`📄 Values: ${releaseName}`)
      .setDescription(`Namespace: **${namespace}**`)
      .setColor(0x0099ff)
      .setTimestamp();

    // Split into chunks if too long
    if (valuesYaml.length < 1900) {
      embed.addFields({
        name: 'Values',
        value: `\`\`\`yaml\n${valuesYaml}\n\`\`\``,
        inline: false
      });
    } else {
      const truncated = valuesYaml.substring(0, 1850);
      embed.addFields({
        name: 'Values (truncated)',
        value: `\`\`\`yaml\n${truncated}...\n\`\`\``,
        inline: false
      });
      embed.setFooter({ text: 'Values truncated. Use kubectl to see full values.' });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error getting values:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Get Values')
      .setDescription(error.response?.data?.error || 'Failed to get Helm values')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleHistory(interaction: ChatInputCommandInteraction) {
  const clusterId = interaction.options.getString('cluster', true);
  const releaseName = interaction.options.getString('release', true);
  const namespace = interaction.options.getString('namespace', true);

  await interaction.deferReply();

  try {
    const params = new URLSearchParams({ clusterId, namespace });

    const response = await axios.get(
      `${BACKEND_URL}/api/helm/releases/${releaseName}/history?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${interaction.user.id}`
        }
      }
    );

    const { history } = response.data;

    const embed = new EmbedBuilder()
      .setTitle(`📜 History: ${releaseName}`)
      .setDescription(`Namespace: **${namespace}**`)
      .setColor(0x0099ff)
      .setTimestamp();

    if (history.length === 0) {
      embed.addFields({
        name: 'No History',
        value: 'No revision history found for this release.',
        inline: false
      });
    } else {
      for (const rev of history.slice(0, 10).reverse()) {
        const statusEmoji = rev.status === 'deployed' ? '✅' : '⚠️';

        embed.addFields({
          name: `${statusEmoji} Revision ${rev.revision}`,
          value:
            `**Status**: ${rev.status}\n` +
            `**Updated**: ${new Date(rev.updated).toLocaleString()}\n` +
            `**Description**: ${rev.description || 'N/A'}`,
          inline: false
        });
      }

      if (history.length > 10) {
        embed.setFooter({ text: `Showing last 10 of ${history.length} revisions` });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error getting history:', error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Get History')
      .setDescription(error.response?.data?.error || 'Failed to get Helm history')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';

export class ClusterCordComponents {
  /**
   * Create confirmation buttons
   */
  static confirmButtons(customIdPrefix = ''): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${customIdPrefix}confirm`)
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${customIdPrefix}cancel`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    );
  }

  /**
   * Create terminal control buttons
   */
  static terminalControls(sessionId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`terminal_pause_${sessionId}`)
        .setLabel('⏸️ Pause')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`terminal_resume_${sessionId}`)
        .setLabel('▶️ Resume')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`terminal_kill_${sessionId}`)
        .setLabel('🛑 Kill')
        .setStyle(ButtonStyle.Danger)
    );
  }

  /**
   * Create cluster selection menu
   */
  static clusterSelect(
    clusters: Array<{ id: string; name: string; endpoint: string }>
  ): ActionRowBuilder<StringSelectMenuBuilder> {
    const options = clusters.map(cluster =>
      new StringSelectMenuOptionBuilder()
        .setLabel(cluster.name)
        .setValue(cluster.id)
        .setDescription(cluster.endpoint)
    );

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('cluster_select')
        .setPlaceholder('Select a cluster')
        .addOptions(options)
    );
  }

  /**
   * Create namespace selection menu
   */
  static namespaceSelect(
    namespaces: string[]
  ): ActionRowBuilder<StringSelectMenuBuilder> {
    const options = namespaces.map(ns =>
      new StringSelectMenuOptionBuilder().setLabel(ns).setValue(ns)
    );

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('namespace_select')
        .setPlaceholder('Select a namespace')
        .addOptions(options)
    );
  }

  /**
   * Create pod selection menu
   */
  static podSelect(
    pods: Array<{ name: string; status: string }>
  ): ActionRowBuilder<StringSelectMenuBuilder> {
    const options = pods.slice(0, 25).map(pod =>
      new StringSelectMenuOptionBuilder()
        .setLabel(pod.name)
        .setValue(pod.name)
        .setDescription(`Status: ${pod.status}`)
    );

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('pod_select')
        .setPlaceholder('Select a pod')
        .addOptions(options)
    );
  }

  /**
   * Create action buttons for pod management
   */
  static podActions(podName: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`pod_logs_${podName}`)
        .setLabel('📄 Logs')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`pod_describe_${podName}`)
        .setLabel('📋 Describe')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pod_exec_${podName}`)
        .setLabel('🖥️ Terminal')
        .setStyle(ButtonStyle.Success)
    );
  }

  /**
   * Create audit export buttons
   */
  static auditExportButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('audit_export_24h')
        .setLabel('Last 24 Hours')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('audit_export_7d')
        .setLabel('Last 7 Days')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('audit_export_30d')
        .setLabel('Last 30 Days')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('audit_export_all')
        .setLabel('All Time')
        .setStyle(ButtonStyle.Secondary)
    );
  }
}

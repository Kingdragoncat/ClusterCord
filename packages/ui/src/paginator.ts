import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ButtonInteraction,
  Message
} from 'discord.js';

export interface PaginatorOptions {
  embeds: EmbedBuilder[];
  timeout?: number;
}

export class Paginator {
  private embeds: EmbedBuilder[];
  private currentPage: number;
  private timeout: number;

  constructor(options: PaginatorOptions) {
    this.embeds = options.embeds;
    this.currentPage = 0;
    this.timeout = options.timeout || 120000; // 2 minutes default
  }

  /**
   * Get the current page embed
   */
  private getCurrentEmbed(): EmbedBuilder {
    const embed = this.embeds[this.currentPage];
    embed.setFooter({ text: `Page ${this.currentPage + 1} of ${this.embeds.length}` });
    return embed;
  }

  /**
   * Create navigation buttons
   */
  private createButtons(disabled = false): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('first')
        .setLabel('⏮️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || this.currentPage === 0),
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('◀️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || this.currentPage === 0),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || this.currentPage === this.embeds.length - 1),
      new ButtonBuilder()
        .setCustomId('last')
        .setLabel('⏭️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || this.currentPage === this.embeds.length - 1),
      new ButtonBuilder()
        .setCustomId('stop')
        .setLabel('🛑')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    );
  }

  /**
   * Start the paginator
   */
  async start(interaction: any): Promise<void> {
    if (this.embeds.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setDescription('No pages to display.')
        ],
        ephemeral: true
      });
      return;
    }

    if (this.embeds.length === 1) {
      await interaction.reply({
        embeds: [this.getCurrentEmbed()],
        ephemeral: true
      });
      return;
    }

    const message = await interaction.reply({
      embeds: [this.getCurrentEmbed()],
      components: [this.createButtons()],
      ephemeral: true,
      fetchReply: true
    });

    const collector = message.createMessageComponentCollector({
      filter: (i: ButtonInteraction) => i.user.id === interaction.user.id,
      time: this.timeout
    });

    collector.on('collect', async (i: ButtonInteraction) => {
      switch (i.customId) {
        case 'first':
          this.currentPage = 0;
          break;
        case 'prev':
          this.currentPage = Math.max(0, this.currentPage - 1);
          break;
        case 'next':
          this.currentPage = Math.min(this.embeds.length - 1, this.currentPage + 1);
          break;
        case 'last':
          this.currentPage = this.embeds.length - 1;
          break;
        case 'stop':
          collector.stop();
          await i.update({
            embeds: [this.getCurrentEmbed()],
            components: [this.createButtons(true)]
          });
          return;
      }

      await i.update({
        embeds: [this.getCurrentEmbed()],
        components: [this.createButtons()]
      });
    });

    collector.on('end', async () => {
      try {
        await message.edit({
          components: [this.createButtons(true)]
        });
      } catch (error) {
        // Message might have been deleted
      }
    });
  }

  /**
   * Create pages from an array of items
   */
  static createPages<T>(
    items: T[],
    itemsPerPage: number,
    formatPage: (items: T[], pageNum: number, totalPages: number) => EmbedBuilder
  ): EmbedBuilder[] {
    const pages: EmbedBuilder[] = [];
    const totalPages = Math.ceil(items.length / itemsPerPage);

    for (let i = 0; i < totalPages; i++) {
      const start = i * itemsPerPage;
      const end = start + itemsPerPage;
      const pageItems = items.slice(start, end);
      pages.push(formatPage(pageItems, i + 1, totalPages));
    }

    return pages;
  }
}

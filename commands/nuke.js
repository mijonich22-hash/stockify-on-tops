// commands/nuke.js
const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Nuke channel ini atau channel yang dipilih')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel yang ingin di-nuke (opsional)')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addBooleanOption(option =>
      option
        .setName('show_msg')
        .setDescription('Tampilkan pesan nuked ke publik? Default: true')
    ),

  async execute(interaction) {
    // Defer reply immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // permission check
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.editReply({
        content: '❌ You need Administrator permissions to do this.',
      });
    }

    // resolve options
    const channelOption = interaction.options.getChannel('channel');
    const showMsgOption = interaction.options.getBoolean('show_msg');
    const showMsg = showMsgOption === null ? true : showMsgOption;

    // target channel (ensure it's a text channel)
    const targetChannel = channelOption ?? interaction.channel;
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      return interaction.editReply({
        content: '❌ Target channel is not a text channel or cannot be found.',
      });
    }

    // Build confirmation container with Components V2
    const confirmContainer = new ContainerBuilder();

    confirmContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**⚠️ Nuke Confirmation**')
    );

    confirmContainer.addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true)
    );

    confirmContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Are you sure you want to **nuke** <#${targetChannel.id}> ?\n\n`
      )
    );

    confirmContainer.addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Large)
        .setDivider(true)
    );

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('nuke_confirm')
        .setLabel('💣 Continue')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('nuke_cancel')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    confirmContainer.addActionRowComponents(buttonRow);

    // Send confirmation with Components V2
    await interaction.editReply({
      components: [confirmContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    // Create collector for button interactions
    const filter = (i) => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ 
      filter, 
      time: 30_000, 
      max: 1 
    });

    collector.on('end', async (collected) => {
      // If nothing collected => timeout
      if (collected.size === 0) {
        const timeoutContainer = new ContainerBuilder();
        timeoutContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent('⌛ **Timeout**'),
          new TextDisplayBuilder().setContent('Nuke confirmation timed out.')
        );

        try {
          await interaction.editReply({
            components: [timeoutContainer],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (e) {
          // ignore edit errors
        }
        return;
      }

      const component = collected.first();

      if (component.customId === 'nuke_cancel') {
        // user cancelled
        const cancelContainer = new ContainerBuilder();
        cancelContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent('❌ **Nuke Cancelled**'),
          new TextDisplayBuilder().setContent('The nuke operation has been cancelled.')
        );

        try {
          await component.update({ 
            components: [cancelContainer], 
            flags: MessageFlags.IsComponentsV2 
          });
        } catch (e) {
          // fallback
          await interaction.editReply({ 
            components: [cancelContainer], 
            flags: MessageFlags.IsComponentsV2 
          }).catch(() => {});
        }
        return;
      }

      if (component.customId === 'nuke_confirm') {
        // Show processing message
        const processingContainer = new ContainerBuilder();
        processingContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent('💣 **Nuking Channel...**'),
          new TextDisplayBuilder().setContent('Please wait, this may take a moment...')
        );

        try {
          await component.update({ 
            components: [processingContainer], 
            flags: MessageFlags.IsComponentsV2 
          });
        } catch (e) {
          // ignore
        }

        // proceed to clone -> set position -> delete original
        try {
          const oldPosition = targetChannel.position;
          
          // clone the channel (keeps permissions, topic, etc. by default)
          const newChannel = await targetChannel.clone({ 
            reason: `Nuked by ${interaction.user.tag}` 
          });

          // set position to old position
          try {
            await newChannel.setPosition(oldPosition);
          } catch (posErr) {
            console.warn('Failed to set position of cloned channel:', posErr);
          }

          // delete original channel
          await targetChannel.delete(`Nuked by ${interaction.user.tag}`);

          // build final embed for the new channel
          const finalEmbed = new EmbedBuilder()
            .setDescription(
              `<a:SilenceX_Nuke:1345621460432982028> **Channel Nuked**\n` +
              `This channel has been nuked by \`${interaction.user.tag}\``
            )
            .setColor(0xff0000)
            .setFooter({ 
              text: interaction.user.username, 
              iconURL: interaction.user.displayAvatarURL() 
            });

          if (showMsg) {
            await newChannel.send({ embeds: [finalEmbed] }).catch(console.error);
          }
          
          // Don't use followUp - channel is deleted, webhook is broken
          // Success notification sent in new channel instead
        } catch (err) {
          console.error('Nuke failed:', err);
          
          // Only try editReply if channel still exists (error happened before delete)
          const errorContainer = new ContainerBuilder();
          errorContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('❌ **Nuke Failed**'),
            new TextDisplayBuilder().setContent(
              `Failed to nuke channel: ${err.message || 'Unknown error'}`
            )
          );

          try {
            await interaction.editReply({ 
              components: [errorContainer], 
              flags: MessageFlags.IsComponentsV2 
            }).catch(() => {});
          } catch {}
        }
      }
    });
  },
};
const { 
  SlashCommandBuilder, 
  EmbedBuilder,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType
} = require('discord.js');

// Storage untuk tracking current badge per user (in-memory)
const currentBadges = new Map();

// Re-read config untuk support file watcher
function getConfig() {
  try {
    delete require.cache[require.resolve('../configs/config.json')];
    return require('../configs/config.json');
  } catch (error) {
    console.error('[CONFIG ERROR]', error);
    return {
      'badge-hypersquad_componentsv2': false
    };
  }
}

// Fungsi untuk sensor token (6 karakter tengah)
function censorToken(token) {
  if (!token) return 'Invalid Token';
  
  const parts = token.split('.');
  if (parts.length !== 3) return token;
  
  // Sensor bagian tengah (6 karakter tengah jadi ******)
  const middle = parts[1];
  if (middle.length <= 6) {
    parts[1] = '*'.repeat(middle.length);
  } else {
    const start = middle.slice(0, Math.floor((middle.length - 6) / 2));
    const end = middle.slice(Math.ceil((middle.length + 6) / 2));
    parts[1] = start + '******' + end;
  }
  
  return parts.join('.');
}

// Fungsi untuk validasi token dan ambil user info
async function validateToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }

    const response = await fetch('https://discord.com/api/v10/users/@me', {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return { valid: false, error: `${response.status} ${response.statusText}` };
    }

    const userData = await response.json();

    // Detect current badge from public_flags
    const currentBadge = detectBadgeFromFlags(userData.public_flags || 0);

    return {
      valid: true,
      username: userData.username,
      discriminator: userData.discriminator,
      id: userData.id,
      tag: userData.discriminator === '0' ? userData.username : `${userData.username}#${userData.discriminator}`,
      currentBadge: currentBadge
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Detect badge from public_flags
function detectBadgeFromFlags(flags) {
  // HypeSquad Bravery = 64 (bit 6)
  // HypeSquad Brilliance = 128 (bit 7)
  // HypeSquad Balance = 256 (bit 8)
  
  if (flags & 256) return { id: 3, name: 'Balance (Green)', emoji: '<:SilenceX_Balance:1460928236031574068>' };
  if (flags & 128) return { id: 2, name: 'Brilliance (Red)', emoji: '<:SilenceX_Brilliance:1460928263139627114>' };
  if (flags & 64) return { id: 1, name: 'Bravery (Purple)', emoji: '<:SilenceX_Bravery:1460928084386648128>' };
  
  return null;
}

// Fungsi untuk set HyperSquad badge
async function setHyperSquadBadge(token, houseId) {
  try {
    // Mapping house ID sesuai dengan Discord API
    const houseIdMap = { 1: 1, 2: 2, 3: 3 };
    const apiHouseId = houseIdMap[houseId] || houseId;

    const response = await fetch('https://discord.com/api/v10/hypesquad/online', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ house_id: apiHouseId })
    });

    return {
      success: response.ok || response.status === 204,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Fungsi untuk remove HyperSquad badge
async function removeHyperSquadBadge(token) {
  try {
    const response = await fetch('https://discord.com/api/v10/hypesquad/online', {
      method: 'DELETE',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: response.ok || response.status === 204,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get house name
function getHouseName(houseId) {
  const houses = {
    1: 'Bravery (Purple)',
    2: 'Brilliance (Red)',
    3: 'Balance (Green)'
  };
  return houses[houseId] || 'Unknown';
}

// Get house emoji
function getHouseEmoji(houseId) {
  const emojis = {
    1: '<:SilenceX_Bravery:1460928084386648128>',
    2: '<:SilenceX_Brilliance:1460928263139627114>',
    3: '<:SilenceX_Balance:1460928236031574068>'
  };
  return emojis[houseId] || '⚪';
}

// Create checking embed/container
function createCheckingDisplay(useComponentsV2, username, censoredToken) {
  if (useComponentsV2) {
    const text = new TextDisplayBuilder()
      .setContent(`🔄 **Validating Token...**\n\n-# **User :** ${username}\n-# **Token :** \`${censoredToken}\`\n\n*Please wait while we validate your token...*`);
    
    const container = new ContainerBuilder()
      .setAccentColor(0xFFA500)
      .addTextDisplayComponents(text);
    
    return { componentsV2: true, container };
  } else {
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('🔄 Validating Token...')
      .setDescription(`-# **User :** ${username}\n-# **Token :** \`${censoredToken}\`\n\n*Please wait while we validate your token...*`)
      .setTimestamp();
    
    return { componentsV2: false, embed };
  }
}

// Create success display dengan dropdown dan button
function createSuccessDisplay(useComponentsV2, username, censoredToken, tokenOwner, currentBadge) {
  const badgeText = currentBadge 
    ? `${currentBadge.emoji} ${currentBadge.name}` 
    : 'None';

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('hypersquad_select')
    .setPlaceholder('HyperSquad House')
    .addOptions(
      {
        label: 'Bravery (Purple)',
        description: 'Join HyperSquad Bravery',
        value: '1',
        emoji: '<:SilenceX_Bravery:1460928084386648128>'
      },
      {
        label: 'Brilliance (Red)',
        description: 'Join HyperSquad Brilliance',
        value: '2',
        emoji: '<:SilenceX_Brilliance:1460928263139627114>'
      },
      {
        label: 'Balance (Green)',
        description: 'Join HyperSquad Balance',
        value: '3',
        emoji: '<:SilenceX_Balance:1460928236031574068>'
      }
    );

  const removeButton = new ButtonBuilder()
    .setCustomId('hypersquad_remove')
    .setLabel('Remove Badge')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🗑️');

  if (useComponentsV2) {
    const text = new TextDisplayBuilder()
      .setContent(`✅ **TOKEN VALID !**\n\n-# **User :** ${username}\n-# **Token :** \`${censoredToken}\`\n-# **Token Owner :** ||${tokenOwner}||\n-# **Current Badge :** ${badgeText}\n\n**Select HyperSquad house below :**`);
    
    const separator = new SeparatorBuilder().setDivider(true);
    
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const buttonRow = new ActionRowBuilder().addComponents(removeButton);
    
    const container = new ContainerBuilder()
      .setAccentColor(0x00FF00)
      .addTextDisplayComponents(text)
      .addSeparatorComponents(separator)
      .addActionRowComponents(selectRow)
      .addActionRowComponents(buttonRow);
    
    return { componentsV2: true, container, currentBadge };
  } else {
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ TOKEN VALID !')
      .setDescription(`-# **User :** ${username}\n-# **Token :** \`${censoredToken}\`\n-# **Token Owner :** ||${tokenOwner}||\n-# **Current Badge :** ${badgeText}\n\n**Select HyperSquad house below :**`)
      .setTimestamp();
    
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const buttonRow = new ActionRowBuilder().addComponents(removeButton);
    
    return { componentsV2: false, embed, components: [selectRow, buttonRow], currentBadge };
  }
}

// Create invalid token display
function createInvalidDisplay(useComponentsV2, username, censoredToken, error) {
  if (useComponentsV2) {
    const text = new TextDisplayBuilder()
      .setContent(`❌ **Invalid Token !**\n\n**User :** ${username}\n**Token :** \`${censoredToken}\`\n**Error :** ${error}\n\n*Please check your token and try again.*`);
    
    const container = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(text);
    
    return { componentsV2: true, container };
  } else {
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Invalid Token!')
      .setDescription(`**User :** ${username}\n**Token :** \`${censoredToken}\`\n**Error :** ${error}\n\n*Please check your token and try again.*`)
      .setTimestamp();
    
    return { componentsV2: false, embed };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('badge-hypersquad')
    .setDescription('Manage Discord HyperSquad badges')
    .addStringOption(option =>
      option.setName('token')
        .setDescription('Your Discord account token')
        .setRequired(true)),
  
  category: 'Discord',

  async execute(interaction) {
    const config = getConfig();
    const token = interaction.options.getString('token').trim();
    const userId = interaction.user.id;
    const username = interaction.user.tag;
    const useComponentsV2 = config['badge-hypersquad_componentsv2'] === true;

    const censoredToken = censorToken(token);

    // Show initial checking display
    const checkingDisplay = createCheckingDisplay(useComponentsV2, username, censoredToken);
    
    if (useComponentsV2) {
      await interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [checkingDisplay.container]
      });
    } else {
      await interaction.reply({
        embeds: [checkingDisplay.embed],
        ephemeral: true
      });
    }

    // Validate token
    const validation = await validateToken(token);

    if (!validation.valid) {
      // Show invalid token display
      const invalidDisplay = createInvalidDisplay(useComponentsV2, username, censoredToken, validation.error);
      
      if (useComponentsV2) {
        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [invalidDisplay.container]
        });
      } else {
        await interaction.editReply({
          embeds: [invalidDisplay.embed]
        });
      }
      return;
    }

    // Track current badge
    if (validation.currentBadge) {
      currentBadges.set(userId, validation.currentBadge.id);
    }

    // Update to success display with dropdown and button
    const successDisplay = createSuccessDisplay(useComponentsV2, username, censoredToken, validation.tag, validation.currentBadge);
    let currentDisplayedBadge = validation.currentBadge;
    
    if (useComponentsV2) {
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [successDisplay.container]
      });
    } else {
      await interaction.editReply({
        embeds: [successDisplay.embed],
        components: successDisplay.components
      });
    }

    // Fetch message untuk collector
    const message = await interaction.fetchReply();

    // Create collector untuk dropdown dan button
    const collector = message.createMessageComponentCollector({
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== userId) {
        const errorText = useComponentsV2 
          ? new TextDisplayBuilder().setContent('❌ This is not your interaction!')
          : null;
        
        if (useComponentsV2) {
          const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(errorText);
          
          return i.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [errorContainer]
          });
        } else {
          return i.reply({
            content: '❌ This is not your interaction!',
            ephemeral: true
          });
        }
      }

      // Handle dropdown selection
      if (i.customId === 'hypersquad_select') {
        const houseId = parseInt(i.values[0]);
        const houseName = getHouseName(houseId);
        const houseEmoji = getHouseEmoji(houseId);

        await i.deferUpdate();

        const result = await setHyperSquadBadge(token, houseId);

        if (result.success) {
          // Update current badge tracking
          currentBadges.set(userId, houseId);
          currentDisplayedBadge = { id: houseId, name: houseName, emoji: houseEmoji };

          // Update main embed to show new badge
          const updatedDisplay = createSuccessDisplay(useComponentsV2, username, censoredToken, validation.tag, currentDisplayedBadge);
          
          if (useComponentsV2) {
            await interaction.editReply({
              flags: MessageFlags.IsComponentsV2,
              components: [updatedDisplay.container]
            }).catch(() => {});
          } else {
            await interaction.editReply({
              embeds: [updatedDisplay.embed],
              components: updatedDisplay.components
            }).catch(() => {});
          }

          // Success message
          if (useComponentsV2) {
            const successText = new TextDisplayBuilder()
              .setContent(`✅ **Badge Set Successfully!**\n\n${houseEmoji} You have joined **${houseName}**!`);
            
            const successContainer = new ContainerBuilder()
              .setAccentColor(0x00FF00)
              .addTextDisplayComponents(successText);
            
            await i.followUp({
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
              components: [successContainer]
            });
          } else {
            await i.followUp({
              content: `✅ **Badge Set Successfully!**\n\n${houseEmoji} You have joined **${houseName}**!`,
              ephemeral: true
            });
          }
        } else {
          // Error message
          if (useComponentsV2) {
            const errorText = new TextDisplayBuilder()
              .setContent(`❌ **Failed to set badge!**\n\n**Error:** ${result.error || `${result.status} ${result.statusText}`}`);
            
            const errorContainer = new ContainerBuilder()
              .setAccentColor(0xFF0000)
              .addTextDisplayComponents(errorText);
            
            await i.followUp({
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
              components: [errorContainer]
            });
          } else {
            await i.followUp({
              content: `❌ **Failed to set badge!**\n\n**Error:** ${result.error || `${result.status} ${result.statusText}`}`,
              ephemeral: true
            });
          }
        }
      }

      // Handle remove button
      if (i.customId === 'hypersquad_remove') {
        await i.deferUpdate();

        const result = await removeHyperSquadBadge(token);

        if (result.success) {
          // Update current badge tracking (remove badge)
          currentBadges.delete(userId);
          currentDisplayedBadge = null;

          // Update main embed to show no badge
          const updatedDisplay = createSuccessDisplay(useComponentsV2, username, censoredToken, validation.tag, null);
          
          if (useComponentsV2) {
            await interaction.editReply({
              flags: MessageFlags.IsComponentsV2,
              components: [updatedDisplay.container]
            }).catch(() => {});
          } else {
            await interaction.editReply({
              embeds: [updatedDisplay.embed],
              components: updatedDisplay.components
            }).catch(() => {});
          }

          // Success message
          if (useComponentsV2) {
            const successText = new TextDisplayBuilder()
              .setContent(`✅ **Badge Removed Successfully!**\n\nYour HyperSquad badge has been removed.`);
            
            const successContainer = new ContainerBuilder()
              .setAccentColor(0x00FF00)
              .addTextDisplayComponents(successText);
            
            await i.followUp({
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
              components: [successContainer]
            });
          } else {
            await i.followUp({
              content: `✅ **Badge Removed Successfully!**\n\nYour HyperSquad badge has been removed.`,
              ephemeral: true
            });
          }
        } else {
          // Error message
          if (useComponentsV2) {
            const errorText = new TextDisplayBuilder()
              .setContent(`❌ **Failed to remove badge!**\n\n**Error:** ${result.error || `${result.status} ${result.statusText}`}`);
            
            const errorContainer = new ContainerBuilder()
              .setAccentColor(0xFF0000)
              .addTextDisplayComponents(errorText);
            
            await i.followUp({
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
              components: [errorContainer]
            });
          } else {
            await i.followUp({
              content: `❌ **Failed to remove badge!**\n\n**Error:** ${result.error || `${result.status} ${result.statusText}`}`,
              ephemeral: true
            });
          }
        }
      }
    });

    collector.on('end', async () => {
      // Disable components after timeout
      if (useComponentsV2) {
        const timeoutText = new TextDisplayBuilder()
          .setContent(`⏱️ **Interaction Timeout**\n\nThis interaction has expired. Please run the command again.`);
        
        const timeoutContainer = new ContainerBuilder()
          .setAccentColor(0x808080)
          .addTextDisplayComponents(timeoutText);
        
        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [timeoutContainer]
        }).catch(() => {});
      } else {
        const timeoutEmbed = new EmbedBuilder()
          .setColor('#808080')
          .setTitle('⏱️ Interaction Timeout')
          .setDescription('This interaction has expired. Please run the command again.')
          .setTimestamp();
        
        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: []
        }).catch(() => {});
      }
    });
  }
};
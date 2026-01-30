const { 
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  FileBuilder,
  AttachmentBuilder,
  ComponentType
} = require('discord.js');
const axios = require('axios');

// Re-read config untuk support file watcher
function getConfig() {
  try {
    delete require.cache[require.resolve('../configs/config.json')];
    return require('../configs/config.json');
  } catch (error) {
    console.error('[CONFIG ERROR]', error);
    return {
      'nitro-checker_componentsv2': false,
      'nitro-checker_ephemeral': true,
      'nitro-checker_api_port': 3000,
      'nitro-checker_max_codes': 50
    };
  }
}

// Extract gift codes from text
function extractGiftCodes(text) {
  const regex = /(?:discord\.gift|discordapp\.com\/gifts)\/([a-zA-Z0-9]+)|([a-zA-Z0-9]{16,})/g;
  const codes = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    codes.push(match[1] || match[2]);
  }
  
  return codes;
}

// Mask code for display
function maskCode(code) {
  if (code.length <= 8) return code;
  const start = code.slice(0, 5);
  const end = code.slice(-5);
  return `${start}••••••${end}`;
}

// Humanize gift type
function humanizeGiftType(data) {
  const giftStyle = data.gift_style;
  const name = (data.subscription_plan?.name || '').toLowerCase();

  if (name.includes('basic')) return 'NITRO BASIC';
  if (name.includes('boost') || name.includes('server boost')) return 'NITRO BOOST';
  if (name.includes('classic')) return 'NITRO CLASSIC';
  if (giftStyle === 4) return 'NITRO BOOST';
  if (giftStyle === 1) return 'NITRO BASIC';
  return 'UNKNOWN';
}

// Humanize interval
function humanizeInterval(interval) {
  if (typeof interval === 'string') return interval.toUpperCase();
  if (interval === 1) return 'MONTHLY';
  if (interval === 12) return 'YEARLY';
  return 'UNKNOWN';
}

// Get expiry status
function getExpiryStatus(expiresAt) {
  if (!expiresAt) return 'N/A';
  try {
    const expires = new Date(expiresAt);
    const now = new Date();
    const hoursLeft = Math.floor((expires - now) / (1000 * 60 * 60));
    if (hoursLeft <= 0) return 'EXPIRED';
    return `${hoursLeft}H`;
  } catch {
    return 'N/A';
  }
}

// Check gift code via local API
async function checkGiftCode(code, apiPort) {
  try {
    const response = await axios.post(`http://localhost:${apiPort}/check`, 
      { code },
      { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      }
    );

    return response.data;
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 500,
      error: error.message
    };
  }
}

// Create checking display
function createCheckingDisplay(useComponentsV2, total) {
  const content = `🎁 **Nitro Gift Checker**\n\n⏳ **Checking ${total} gift codes...**\n\nPlease wait...`;

  if (useComponentsV2) {
    const text = new TextDisplayBuilder().setContent(content);
    const container = new ContainerBuilder()
      .setAccentColor(0x5865F2)
      .addTextDisplayComponents(text);
    return { componentsV2: true, container };
  } else {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎁 Nitro Gift Checker')
      .setDescription(`⏳ **Checking ${total} gift codes...**\n\nPlease wait...`)
      .setTimestamp();
    return { componentsV2: false, embed };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checker-nitro')
    .setDescription('Check Discord Nitro gift codes validity')
    .addBooleanOption(option =>
      option.setName('send_in_dm')
        .setDescription('Send results in DM (true) or in channel (false)')
        .setRequired(false)
    ),
  
  category: 'Discord',

  async execute(interaction) {
    const config = getConfig();
    const userId = interaction.user.id;
    const username = interaction.user.tag;
    
    // Get send_in_dm option (default true jika tidak diisi)
    const sendInDM = interaction.options.getBoolean('send_in_dm') ?? true;

    // Show modal form
    const modal = new ModalBuilder()
      .setCustomId('nitro_checker_modal')
      .setTitle('🎁 Nitro Gift Checker');

    // Field 1: Gift Codes/Links (Required) - Primary
    const codesInput1 = new TextInputBuilder()
      .setCustomId('gift_codes_1')
      .setLabel('Nitro Gift Links/Codes (Primary)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('https://discord.gift/c1, https://discord.gift/c2\n( One per line or comma separated )')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(4000);

    // Field 2: Additional Codes/Links (Optional)
    const codesInput2 = new TextInputBuilder()
      .setCustomId('gift_codes_2')
      .setLabel('Additional Links/Codes (Optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('More codes if needed...')
      .setRequired(false)
      .setMaxLength(4000);

    // Field 3: More Codes/Links (Optional)
    const codesInput3 = new TextInputBuilder()
      .setCustomId('gift_codes_3')
      .setLabel('More Links/Codes (Optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Even more codes if needed...')
      .setRequired(false)
      .setMaxLength(4000);

    // Add fields to modal
    const codesRow1 = new ActionRowBuilder().addComponents(codesInput1);
    const codesRow2 = new ActionRowBuilder().addComponents(codesInput2);
    const codesRow3 = new ActionRowBuilder().addComponents(codesInput3);

    modal.addComponents(codesRow1, codesRow2, codesRow3);

    await interaction.showModal(modal);

    // Handle modal submit
    const filter = (i) => i.customId === 'nitro_checker_modal' && i.user.id === userId;
    
    try {
      const modalSubmit = await interaction.awaitModalSubmit({ filter, time: 300000 });
      
      // IMMEDIATE DEFER
      try {
        if (!modalSubmit.replied && !modalSubmit.deferred) {
          await modalSubmit.deferReply({ ephemeral: config['nitro-checker_ephemeral'] !== false });
        }
      } catch (deferError) {
        console.log('[NITRO CHECKER] Defer skipped - already acknowledged');
      }
      
      const codesText1 = modalSubmit.fields.getTextInputValue('gift_codes_1');
      const codesText2 = modalSubmit.fields.getTextInputValue('gift_codes_2') || '';
      const codesText3 = modalSubmit.fields.getTextInputValue('gift_codes_3') || '';
      
      const codesText = `${codesText1}\n${codesText2}\n${codesText3}`;

      // Extract and process codes
      const allCodes = extractGiftCodes(codesText);
      const uniqueCodes = [...new Set(allCodes)];
      const duplicateCount = allCodes.length - uniqueCodes.length;

      if (uniqueCodes.length === 0) {
        return modalSubmit.editReply({
          content: '❌ No valid gift codes found in your input.'
        });
      }

      // Check max codes limit
      const maxCodes = config['nitro-checker_max_codes'] || 50;
      
      if (uniqueCodes.length > maxCodes) {
        return modalSubmit.editReply({
          content: `❌ **Code Limit Exceeded**\n\nYou can only check up to ${maxCodes} codes at once.\nYou provided ${uniqueCodes.length} unique codes.`
        });
      }

      const useComponentsV2 = config['nitro-checker_componentsv2'] === true;
      const apiPort = config['nitro-checker_api_port'] || 3000;

      // Initial checking display
      const checkingDisplay = createCheckingDisplay(useComponentsV2, uniqueCodes.length);
      
      if (useComponentsV2) {
        await modalSubmit.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [checkingDisplay.container]
        });
      } else {
        await modalSubmit.editReply({
          embeds: [checkingDisplay.embed]
        });
      }

      // Process codes
      const results = [];
      const stats = {
        valid: 0,
        invalid: 0,
        claimed: 0,
        duplicate: duplicateCount,
        nitroBoost: 0,
        nitroBasic: 0,
        monthly: 0,
        yearly: 0
      };
      
      for (let i = 0; i < uniqueCodes.length; i++) {
        const code = uniqueCodes[i];
        const masked = maskCode(code);
        
        const result = await checkGiftCode(code, apiPort);
        
        if (result.success && result.status === 200 && result.data) {
          const data = result.data;
          const giftType = humanizeGiftType(data);
          const interval = humanizeInterval(data.subscription_plan?.interval);
          const isClaimed = (data.redeemed || false) || (data.uses || 0) > 0;
          const expiresAt = data.expires_at;
          const claimTime = isClaimed ? 'CLAIMED' : getExpiryStatus(expiresAt);

          const symbol = isClaimed ? '⚠️' : '✅';
          results.push(`${symbol} [${giftType}] [${interval}] [${claimTime}] - https://discord.gift/${masked}`);

          if (!isClaimed) {
            stats.valid++;
            if (giftType === 'NITRO BOOST') stats.nitroBoost++;
            if (giftType === 'NITRO BASIC') stats.nitroBasic++;
            if (interval === 'MONTHLY') stats.monthly++;
            if (interval === 'YEARLY') stats.yearly++;
          } else {
            stats.claimed++;
          }
        } else if (result.status === 404) {
          stats.invalid++;
          results.push(`❌ [INVALID] - https://discord.gift/${masked}`);
        } else if (result.status === 429) {
          results.push(`⚠️ [RATE LIMITED] - https://discord.gift/${masked}`);
        } else {
          console.error(`[NITRO CHECKER] Error checking ${masked}:`, result);
          results.push(`⚠️ [ERROR: ${result.status || 'UNKNOWN'}] - https://discord.gift/${masked}`);
        }
      }

      // Create file attachment with results
      const resultsData = {
        checker: 'Nitro Gift Checker',
        timestamp: new Date().toISOString(),
        user: username,
        summary: {
          total_codes: allCodes.length,
          unique_codes: uniqueCodes.length,
          duplicates: duplicateCount,
          valid: stats.valid,
          invalid: stats.invalid,
          claimed: stats.claimed,
          nitro_boost: stats.nitroBoost,
          nitro_basic: stats.nitroBasic,
          monthly: stats.monthly,
          yearly: stats.yearly
        },
        results: results.map(r => r.replace(/discord\.gift\//g, ''))
      };
      
      const buffer = Buffer.from(JSON.stringify(resultsData, null, 2));
      const attachment = new AttachmentBuilder(buffer, { name: 'nitro-checker-results.json' });
      
      // Create result content string
      const resultText = results.length > 0 ? results.join('\n') : 'No results';
      const summaryText = `━━━━━━━━━━━━━━━━━━━━\n**Summary:**\n` +
        `🎁 Nitro Boost: ${stats.nitroBoost}\n` +
        `🎁 Nitro Basic: ${stats.nitroBasic}\n` +
        `📆 Monthly: ${stats.monthly}\n` +
        `📆 Yearly: ${stats.yearly}\n` +
        `✅ Valid: ${stats.valid}\n` +
        `❌ Invalid: ${stats.invalid}\n` +
        `⚠️ Claimed: ${stats.claimed}\n` +
        `🔁 Duplicate: ${stats.duplicate}\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
      const fullContent = `🎁 **Nitro Gift Checker**\n\n${resultText}\n\n${summaryText}\n\n_Requested by ${username}_`;
      
      try {
        if (sendInDM) {
          // Send to DM
          if (useComponentsV2) {
            const fileComponent = new FileBuilder().setURL('attachment://nitro-checker-results.json');
            const dmText = new TextDisplayBuilder().setContent(fullContent);
            const dmSeparator = new SeparatorBuilder().setDivider(true);
            
            const dmContainer = new ContainerBuilder()
              .setAccentColor(0x00FF00)
              .addTextDisplayComponents(dmText)
              .addSeparatorComponents(dmSeparator)
              .addFileComponents(fileComponent);
            
            await interaction.user.send({
              flags: MessageFlags.IsComponentsV2,
              components: [dmContainer],
              files: [attachment]
            });
          } else {
            const dmEmbed = new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle('🎁 Nitro Gift Checker')
              .setDescription(`${resultText}\n\n${summaryText}`)
              .setFooter({ text: `Requested by ${username}` })
              .setTimestamp();
            
            await interaction.user.send({ 
              embeds: [dmEmbed],
              files: [attachment]
            });
          }
          
          // Update to completion message
          const completionContent = `✅ **Nitro Checker Complete !**\n\n` +
            `📬 Results have been sent to your DM.\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `**Summary :**\n` +
            `✅ Valid : ${stats.valid}\n` +
            `❌ Invalid : ${stats.invalid}\n` +
            `⚠️ Claimed : ${stats.claimed}\n` +
            `🔁 Duplicate : ${stats.duplicate}\n` +
            `━━━━━━━━━━━━━━━━━━━━`;

          if (useComponentsV2) {
            const completionText = new TextDisplayBuilder().setContent(completionContent);
            const separator = new SeparatorBuilder().setDivider(true);
            const completionContainer = new ContainerBuilder()
              .setAccentColor(0x00FF00)
              .addTextDisplayComponents(completionText)
              .addSeparatorComponents(separator);
            
            await modalSubmit.editReply({
              flags: MessageFlags.IsComponentsV2,
              components: [completionContainer]
            });
          } else {
            const completionEmbed = new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle('✅ Nitro Checker Complete !')
              .setDescription(completionContent)
              .setTimestamp();
            
            await modalSubmit.editReply({ embeds: [completionEmbed] });
          }
        } else {
          // Send in channel
          if (useComponentsV2) {
            const fileComponent = new FileBuilder().setURL('attachment://nitro-checker-results.json');
            const channelText = new TextDisplayBuilder().setContent(fullContent);
            const channelSeparator = new SeparatorBuilder().setDivider(true);
            
            const channelContainer = new ContainerBuilder()
              .setAccentColor(0x00FF00)
              .addTextDisplayComponents(channelText)
              .addSeparatorComponents(channelSeparator)
              .addFileComponents(fileComponent);
            
            await modalSubmit.editReply({
              flags: MessageFlags.IsComponentsV2,
              components: [channelContainer],
              files: [attachment]
            });
          } else {
            const channelEmbed = new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle('🎁 Nitro Gift Checker')
              .setDescription(`${resultText}\n\n${summaryText}`)
              .setFooter({ text: `Requested by ${username}` })
              .setTimestamp();
            
            await modalSubmit.editReply({ 
              embeds: [channelEmbed],
              files: [attachment]
            });
          }
        }
      } catch (error) {
        console.error('[NITRO CHECKER] DM/Channel send error:', error);
        
        const errorContent = sendInDM 
          ? `⚠️ **Could not send DM**\n\nPlease enable DMs from this server.`
          : `⚠️ **Could not send results**\n\nPlease check bot permissions.`;
        
        if (useComponentsV2) {
          const errorText = new TextDisplayBuilder().setContent(errorContent);
          const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(errorText);
          
          await modalSubmit.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [errorContainer]
          });
        } else {
          const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⚠️ Error')
            .setDescription(errorContent)
            .setTimestamp();
          
          await modalSubmit.editReply({ 
            embeds: [errorEmbed]
          });
        }
      }

    } catch (error) {
      console.error('[NITRO CHECKER ERROR]', error);
    }
  }
};
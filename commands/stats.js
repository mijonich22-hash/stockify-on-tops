const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ConsoleUI = require('../utils/consoleUI');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Lihat statistik bot'),
    
    async execute(interaction) {
        const stats = ConsoleUI.getStats();
        const uptime = ConsoleUI.formatUptime(Date.now() - stats.startTime);
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📊 Bot Statistics')
            .setDescription('Real-time bot performance and usage statistics')
            .addFields(
                { 
                    name: '⏱️ Uptime', 
                    value: `\`${uptime}\``, 
                    inline: true 
                },
                { 
                    name: '💾 Memory', 
                    value: `\`${memoryUsage} MB\``, 
                    inline: true 
                },
                { 
                    name: '🖥️ Node.js', 
                    value: `\`${process.version}\``, 
                    inline: true 
                },
                { 
                    name: '📊 Servers', 
                    value: `\`${interaction.client.guilds.cache.size}\``, 
                    inline: true 
                },
                { 
                    name: '👥 Users', 
                    value: `\`${interaction.client.users.cache.size}\``, 
                    inline: true 
                },
                { 
                    name: '⚡ Commands', 
                    value: `\`${interaction.client.commands.size}\``, 
                    inline: true 
                },
                { 
                    name: '🎯 Commands Executed', 
                    value: `\`${stats.commandsExecuted}\``, 
                    inline: true 
                },
                { 
                    name: '🔘 Button Clicks', 
                    value: `\`${stats.interactions.buttons}\``, 
                    inline: true 
                },
                { 
                    name: '📋 Select Menus', 
                    value: `\`${stats.interactions.selectMenus}\``, 
                    inline: true 
                },
                { 
                    name: '❌ Errors', 
                    value: `\`${stats.errors}\``, 
                    inline: true 
                },
                { 
                    name: '🏓 API Latency', 
                    value: `\`${Math.round(interaction.client.ws.ping)}ms\``, 
                    inline: true 
                },
                { 
                    name: '📡 Ping', 
                    value: `\`${Date.now() - interaction.createdTimestamp}ms\``, 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ 
                text: `Requested by ${interaction.user.tag}`, 
                iconURL: interaction.user.displayAvatarURL() 
            });

        await interaction.reply({ embeds: [embed] });
    },
};
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');

// Initialize SQLite database
const dbPath = path.join(__dirname, '../data/auto-react.db');
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS auto_react (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        added_by TEXT NOT NULL,
        added_at TEXT NOT NULL
    )
`);

// Helper function untuk generate ID unik
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('react')
        .setDescription('Manage auto-react settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add auto-react to a channel')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel to add auto-react')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('emoji')
                        .setDescription('Emoji to react with (supports custom/nitro emoji)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove auto-react from a channel')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('ID of the auto-react to remove (get from /react config)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('View all auto-react configurations')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            await handleAdd(interaction);
        } else if (subcommand === 'remove') {
            await handleRemove(interaction);
        } else if (subcommand === 'config') {
            await handleConfig(interaction);
        }
    },

    // Event handler untuk auto-react ketika ada message baru
    async handleMessage(message) {
        if (message.author.bot) return;

        const guildId = message.guild.id;
        const channelId = message.channel.id;

        // Get all auto-react untuk channel ini
        const stmt = db.prepare('SELECT emoji FROM auto_react WHERE guild_id = ? AND channel_id = ?');
        const reacts = stmt.all(guildId, channelId);

        for (const react of reacts) {
            try {
                await message.react(react.emoji);
            } catch (error) {
                console.error(`Failed to react with ${react.emoji}:`, error);
            }
        }
    }
};

async function handleAdd(interaction) {
    const channel = interaction.options.getChannel('channel');
    const emoji = interaction.options.getString('emoji');
    const guildId = interaction.guild.id;

    // Validasi emoji
    let emojiToSave = emoji;
    const customEmojiMatch = emoji.match(/<a?:\w+:(\d+)>/);
    
    if (customEmojiMatch) {
        emojiToSave = emoji;
    } else {
        emojiToSave = emoji.trim();
    }

    // Test apakah emoji bisa digunakan
    try {
        const testMsg = await interaction.channel.send('Testing emoji...');
        await testMsg.react(emojiToSave);
        await testMsg.delete();
    } catch (error) {
        return interaction.reply({
            content: `❌ Emoji tidak valid atau bot tidak bisa menggunakan emoji tersebut!\n\`\`\`${error.message}\`\`\``,
            ephemeral: true
        });
    }

    // Generate unique ID
    const id = generateId();

    // Save to database
    try {
        const stmt = db.prepare(`
            INSERT INTO auto_react (id, guild_id, channel_id, channel_name, emoji, added_by, added_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            id,
            guildId,
            channel.id,
            channel.name,
            emojiToSave,
            interaction.user.id,
            new Date().toISOString()
        );

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Auto-React Added')
            .setDescription(`Auto-react berhasil ditambahkan!`)
            .addFields(
                { name: 'Channel', value: `<#${channel.id}>`, inline: true },
                { name: 'Emoji', value: emojiToSave, inline: true },
                { name: 'ID', value: `\`${id}\``, inline: true }
            )
            .setFooter({ text: `Added by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Database error:', error);
        await interaction.reply({
            content: '❌ Gagal menyimpan ke database!',
            ephemeral: true
        });
    }
}

async function handleRemove(interaction) {
    const id = interaction.options.getString('id');
    const guildId = interaction.guild.id;

    // Get data sebelum dihapus
    const getStmt = db.prepare('SELECT * FROM auto_react WHERE id = ? AND guild_id = ?');
    const reactData = getStmt.get(id, guildId);

    if (!reactData) {
        return interaction.reply({
            content: '❌ ID auto-react tidak ditemukan! Gunakan `/react config` untuk melihat daftar ID yang tersedia.',
            ephemeral: true
        });
    }

    // Hapus dari database
    try {
        const deleteStmt = db.prepare('DELETE FROM auto_react WHERE id = ? AND guild_id = ?');
        deleteStmt.run(id, guildId);

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🗑️ Auto-React Removed')
            .setDescription(`Auto-react berhasil dihapus!`)
            .addFields(
                { name: 'Channel', value: `<#${reactData.channel_id}>`, inline: true },
                { name: 'Emoji', value: reactData.emoji, inline: true },
                { name: 'ID', value: `\`${id}\``, inline: true }
            )
            .setFooter({ text: `Removed by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Database error:', error);
        await interaction.reply({
            content: '❌ Gagal menghapus dari database!',
            ephemeral: true
        });
    }
}

async function handleConfig(interaction) {
    const guildId = interaction.guild.id;

    // Get all auto-react untuk guild ini
    const stmt = db.prepare('SELECT * FROM auto_react WHERE guild_id = ? ORDER BY channel_id, added_at');
    const reacts = stmt.all(guildId);

    if (reacts.length === 0) {
        return interaction.reply({
            content: '📋 Belum ada auto-react yang terkonfigurasi untuk server ini.',
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('⚙️ Auto-React Configuration')
        .setDescription(`Total: **${reacts.length}** auto-react${reacts.length > 1 ? 's' : ''}`)
        .setFooter({ text: `${interaction.guild.name}` })
        .setTimestamp();

    // Group by channel
    const channelGroups = {};
    reacts.forEach(react => {
        if (!channelGroups[react.channel_id]) {
            channelGroups[react.channel_id] = [];
        }
        channelGroups[react.channel_id].push(react);
    });

    for (const [channelId, reactList] of Object.entries(channelGroups)) {
        const reactInfo = reactList.map(r => 
            `${r.emoji} - ID: \`${r.id}\``
        ).join('\n');

        embed.addFields({
            name: `<#${channelId}>`,
            value: reactInfo,
            inline: false
        });
    }

    await interaction.reply({ embeds: [embed] });
}
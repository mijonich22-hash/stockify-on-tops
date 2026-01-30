const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Menampilkan embed backup'),

  async execute(interaction) {
    try {
      // Pastikan interaction.member ada
      if (!interaction.member) {
        return interaction.reply({
          content: 'Tidak dapat mengakses data member.',
          ephemeral: true
        });
      }

      // Cek apakah user adalah server owner atau memiliki permission MANAGE_GUILD
      const isOwner = interaction.guild.ownerId === interaction.user.id;
      const hasManageGuildPerm = interaction.member.permissions.has('MANAGE_GUILD') || interaction.member.permissions.has('ADMINISTRATOR');

      if (!isOwner && !hasManageGuildPerm) {
        return interaction.reply({
          content: 'Kamu tidak memiliki izin untuk menggunakan command ini. Dibutuhkan permission "Manage Guild" atau menjadi server owner.',
          ephemeral: true
        });
      }

      // Path ke file backup.json
      const filePath = path.join(__dirname, '../configs/backup.json');

      // Pastikan file ada
      if (!fs.existsSync(filePath)) {
        return interaction.reply({
          content: 'File konfigurasi backup tidak ditemukan!',
          ephemeral: true
        });
      }

      // Membaca file JSON
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Membuat embed
      const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setDescription(data.description)
        .setFooter({ text: data.footer })
        .setTimestamp();

      // Kirim embed
      await interaction.reply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Terjadi error:', error);
      return interaction.reply({
        content: 'Terjadi error saat menjalankan command ini!',
        ephemeral: true
      });
    }
  }
};


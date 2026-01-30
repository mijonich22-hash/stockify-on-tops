const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roblox-tax')
    .setDescription('Calculate Roblox tax with price estimation')
    .addIntegerOption(option =>
      option.setName('robux')
        .setDescription('Amount of Robux')
        .setRequired(true)
        .setMinValue(1))
    .addNumberOption(option =>
      option.setName('rate')
        .setDescription('Rate in MYR per 1 Robux (optional, e.g: 0.019)')
        .setRequired(false)
        .setMinValue(0.001)),

  async execute(interaction) {
    const robuxAmount = interaction.options.getInteger('robux');
    const ratePerRobux = interaction.options.getNumber('rate');

    await interaction.deferReply();

    try {
      let USD_RATE = 4.70; // fallback MYR rate

      if (ratePerRobux) {
        try {
          const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
          const data = await res.json();
          if (data?.rates?.MYR) {
            USD_RATE = parseFloat(data.rates.MYR.toFixed(2));
          }
        } catch {
          console.log('Failed to fetch exchange rate, using fallback');
        }
      }

      const TAX_RATE = 0.30;

      const afterTax = Math.floor(robuxAmount * (1 - TAX_RATE));
      const taxAmount = robuxAmount - afterTax;

      const beforeTax = Math.ceil(robuxAmount / (1 - TAX_RATE));
      const beforeTaxAmount = beforeTax - robuxAmount;

      let afterTaxMYR, beforeTaxMYR, afterTaxUSD, beforeTaxUSD;

      if (ratePerRobux) {
        afterTaxMYR = afterTax * ratePerRobux;
        beforeTaxMYR = robuxAmount * ratePerRobux;
        afterTaxUSD = afterTaxMYR / USD_RATE;
        beforeTaxUSD = beforeTaxMYR / USD_RATE;
      }

      const formatNumber = (n) => n.toLocaleString('en-US');
      const formatMYR = (n) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
      const formatUSD = (n) => `$${n.toFixed(2)}`;

      // 🧱 COMPONENTS V2 CONTAINER
      const container = new ContainerBuilder();

      // Title
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## 🧮 Roblox Tax Calculator')
      );

      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      );

      // Basic Info
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Amount :** ${formatNumber(robuxAmount)} R$\n` +
          (ratePerRobux ? `**Rate :** ${formatMYR(ratePerRobux)}/R$\n` : '') +
          `**Tax Rate :** 30%`
        )
      );

      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Large)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### 📉 After Tax\n` +
          `**Robux :** ${formatNumber(beforeTax)} R$ 🎯\n` +
          `**Tax Amount :** -${formatNumber(beforeTaxAmount)} R$\n` +
          (ratePerRobux
            ? `**Estimasi Harga :** ${formatNumber(robuxAmount)} x ${formatMYR(ratePerRobux)} = ${formatMYR(beforeTaxMYR)} (${formatUSD(beforeTaxUSD)})`
            : '')
        )
      );

      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Large)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### 📈 Before Tax\n` +
          `**Robux :** ${formatNumber(afterTax)} R$ ✅\n` +
          `**Tax Amount :** -${formatNumber(taxAmount)} R$\n` +
          (ratePerRobux
            ? `**Estimasi Harga :** ${formatNumber(afterTax)} x ${formatMYR(ratePerRobux)} = ${formatMYR(afterTaxMYR)} (${formatUSD(afterTaxUSD)})`
            : '')
        )
      );

      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      );

      // Footer style text
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          ratePerRobux
            ? `🕒 Requested by **${interaction.user.tag}** | 1 USD ≈ RM ${USD_RATE.toFixed(2)}`
            : `🕒 Requested by **${interaction.user.tag}**`
        )
      );

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

    } catch (error) {
      console.error('Error in roblox-tax command:', error);
      await interaction.editReply({
        content: '❌ Failed to calculate tax. Please try again later.',
      });
    }
  }
};
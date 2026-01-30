const ConsoleUI = require('../utils/consoleUI');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Track interaction types
        if (interaction.isChatInputCommand()) {
            ConsoleUI.incrementStat('commands');
        }
        
        if (interaction.isButton()) {
            ConsoleUI.incrementStat('buttons');
            ConsoleUI.logEvent('Button', `${interaction.user.tag} clicked: ${interaction.customId}`, 'info');
        }
        
        if (interaction.isStringSelectMenu()) {
            ConsoleUI.incrementStat('selectMenus');
            ConsoleUI.logEvent('Select Menu', `${interaction.user.tag} selected: ${interaction.values.join(', ')}`, 'info');
        }
    },
};
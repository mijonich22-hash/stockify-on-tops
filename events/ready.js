const { ActivityType } = require('discord.js');
const ConsoleUI = require('../utils/consoleUI');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        ConsoleUI.logEvent('Ready', `${client.user.tag} is online!`, 'success');
        
        // Set bot status
        client.user.setPresence({
            activities: [{ 
                name: 'slash commands', 
                type: ActivityType.Listening 
            }],
            status: 'online',
        });
    },
};
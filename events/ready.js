const { ActivityType } = require('discord.js');
const ConsoleUI = require('../utils/consoleUI');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        ConsoleUI.logEvent('Ready', `${client.user.tag} is online!`, 'success');
        
        // Set bot status to streaming
        client.user.setPresence({
            activities: [{ 
                name: 'V2 | .gg/stockifyy',  // This is the message your bot will show
                type: ActivityType.Streaming,  // Set the type to 'STREAMING'
                url: 'https://www.twitch.tv/'  // Replace this with your actual stream URL
            }],
            status: 'online',  // The bot's status (online, idle, dnd, etc.)
        });
    },
};

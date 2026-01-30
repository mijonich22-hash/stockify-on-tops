const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ConsoleUI = require('./utils/consoleUI');

// Load config
const config = require('./configs/config.json');

// Create client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Initialize commands collection
client.commands = new Collection();

// Function to load commands
function loadCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsPath)) {
        fs.mkdirSync(commandsPath, { recursive: true });
        ConsoleUI.warning('Commands directory created');
        return commands;
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);

            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
                ConsoleUI.success(`Loaded command: ${command.data.name}`);
            } else {
                ConsoleUI.warning(`Command ${file} is missing "data" or "execute" property`);
            }
        } catch (error) {
            ConsoleUI.error(`Error loading command ${file}`, error);
        }
    }

    return commands;
}

// Function to load events
function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    
    if (!fs.existsSync(eventsPath)) {
        fs.mkdirSync(eventsPath, { recursive: true });
        ConsoleUI.warning('Events directory created');
        return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        try {
            delete require.cache[require.resolve(filePath)];
            const event = require(filePath);

            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
            ConsoleUI.success(`Loaded event: ${event.name}`);
        } catch (error) {
            ConsoleUI.error(`Error loading event ${file}`, error);
        }
    }
}

// Function to register slash commands
async function registerCommands() {
    const commands = loadCommands();
    
    if (commands.length === 0) {
        ConsoleUI.warning('No commands to register');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(config.token);
    const loading = ConsoleUI.loading(`Registering ${commands.length} slash commands...`);

    try {
        if (config.guildId) {
            await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commands }
            );
            ConsoleUI.stopLoading(loading, `Successfully registered ${commands.length} guild commands`, true);
        } else {
            await rest.put(
                Routes.applicationCommands(config.clientId),
                { body: commands }
            );
            ConsoleUI.stopLoading(loading, `Successfully registered ${commands.length} global commands`, true);
            ConsoleUI.info('Global commands may take up to 1 hour to appear');
        }
    } catch (error) {
        ConsoleUI.stopLoading(loading, 'Failed to register commands', false);
        ConsoleUI.error('Error registering commands', error);
    }
}

// Handle interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        ConsoleUI.error(`No command matching ${interaction.commandName} was found`);
        return;
    }

    try {
        await command.execute(interaction);
        ConsoleUI.logCommand(
            interaction.user.tag,
            interaction.commandName,
            interaction.guild?.name,
            true
        );
        ConsoleUI.incrementStat('commandsExecuted');
    } catch (error) {
        ConsoleUI.logCommand(
            interaction.user.tag,
            interaction.commandName,
            interaction.guild?.name,
            false
        );
        ConsoleUI.error(`Error executing ${interaction.commandName}`, error);
        
        const errorMessage = { 
            content: '❌ Terjadi error saat menjalankan command ini!', 
            ephemeral: true 
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

const autoReactCommand = require('./commands/auto-react.js');

client.on('messageCreate', async (message) => {
    await autoReactCommand.handleMessage(message);
});

// Ready event
client.once('ready', () => {
    ConsoleUI.printDashboard(client);
    
    // Auto-refresh dashboard every 3 seconds
    setInterval(() => {
        ConsoleUI.printDashboard(client);
    }, 3000);
});

// Initialize bot
async function init() {
    ConsoleUI.clear();
    ConsoleUI.printBanner();
    ConsoleUI.divider('═', 70);
    ConsoleUI.info('Starting Discord Bot...\n');
    
    // Load events first
    ConsoleUI.box('Loading Events', 'Scanning events directory...', 'info');
    loadEvents();
    
    // Register commands
    ConsoleUI.box('Loading Commands', 'Scanning commands directory...', 'info');
    await registerCommands();
    
    // Login to Discord
    const loading = ConsoleUI.loading('Connecting to Discord...');
    client.login(config.token)
        .then(() => {
            ConsoleUI.stopLoading(loading, 'Successfully connected to Discord!', true);
        })
        .catch(error => {
            ConsoleUI.stopLoading(loading, 'Failed to connect to Discord', false);
            ConsoleUI.error('Login error', error);
            process.exit(1);
        });
}

// Handle process termination
process.on('SIGINT', () => {
    ConsoleUI.box('Shutdown', 'Bot is shutting down gracefully...', 'warning');
    client.destroy();
    process.exit(0);
});

process.on('unhandledRejection', error => {
    ConsoleUI.error('Unhandled promise rejection', error);
});

// Start the bot
init();

module.exports = client;
const chalk = require('chalk');
const Table = require('cli-table3');
const figlet = require('figlet');
const gradient = require('gradient-string');

// Color theme
const colors = {
    primary: chalk.hex('#5865F2'),
    success: chalk.hex('#57F287'),
    warning: chalk.hex('#FEE75C'),
    error: chalk.hex('#ED4245'),
    info: chalk.hex('#00D9FF'),
    muted: chalk.hex('#99AAB5'),
    white: chalk.white,
    bold: chalk.bold
};

// Stats tracking
const stats = {
    startTime: Date.now(),
    commandsExecuted: 0,
    messagesProcessed: 0,
    errors: 0,
    interactions: {
        commands: 0,
        buttons: 0,
        selectMenus: 0
    }
};

class ConsoleUI {
    // Clear console
    static clear() {
        console.clear();
    }

    // Print banner
    static printBanner() {
        const banner = figlet.textSync('DISCORD BOT', {
            font: 'Standard',
            horizontalLayout: 'default'
        });
        console.log(gradient.pastel.multiline(banner));
        console.log(colors.muted('  Modern Discord Bot with Slash Commands\n'));
    }

    // Print section divider
    static divider(char = '─', length = 60) {
        console.log(colors.muted(char.repeat(length)));
    }

    // Print box message
    static box(title, content, type = 'info') {
        const colorMap = {
            info: colors.info,
            success: colors.success,
            warning: colors.warning,
            error: colors.error
        };
        const color = colorMap[type] || colors.info;
        
        const icon = {
            info: 'ℹ',
            success: '✓',
            warning: '⚠',
            error: '✗'
        }[type] || 'ℹ';

        console.log(`\n${color('┌─')} ${color.bold(icon + ' ' + title)}`);
        content.split('\n').forEach(line => {
            console.log(`${color('│')}  ${line}`);
        });
        console.log(`${color('└' + '─'.repeat(50))}\n`);
    }

    // Print bot info table
    static printBotInfo(client) {
        const table = new Table({
            head: [colors.primary.bold('Property'), colors.primary.bold('Value')],
            colWidths: [25, 35],
            style: {
                head: [],
                border: ['grey']
            }
        });

        const uptime = this.formatUptime(Date.now() - stats.startTime);
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        table.push(
            [colors.info('Bot Tag'), colors.white(client.user.tag)],
            [colors.info('Bot ID'), colors.muted(client.user.id)],
            [colors.info('Servers'), colors.success(client.guilds.cache.size.toString())],
            [colors.info('Users'), colors.success(client.users.cache.size.toString())],
            [colors.info('Commands'), colors.success(client.commands.size.toString())],
            [colors.info('Uptime'), colors.warning(uptime)],
            [colors.info('Memory Usage'), colors.warning(memoryUsage + ' MB')],
            [colors.info('Node Version'), colors.muted(process.version)],
            [colors.info('Discord.js'), colors.muted(require('discord.js').version)]
        );

        console.log(table.toString());
    }

    // Print statistics table
    static printStatistics() {
        const table = new Table({
            head: [colors.primary.bold('Statistic'), colors.primary.bold('Count')],
            colWidths: [30, 20],
            style: {
                head: [],
                border: ['grey']
            }
        });

        table.push(
            [colors.info('Total Commands Executed'), colors.success(stats.commandsExecuted.toString())],
            [colors.info('Messages Processed'), colors.success(stats.messagesProcessed.toString())],
            [colors.info('Button Interactions'), colors.success(stats.interactions.buttons.toString())],
            [colors.info('Select Menu Interactions'), colors.success(stats.interactions.selectMenus.toString())],
            [colors.info('Errors Encountered'), stats.errors > 0 ? colors.error(stats.errors.toString()) : colors.success('0')]
        );

        console.log('\n' + table.toString());
    }

    // Print command execution log
    static logCommand(username, commandName, guildName, success = true) {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        const icon = success ? colors.success('✓') : colors.error('✗');
        const user = colors.primary(username);
        const cmd = colors.warning('/' + commandName);
        const guild = colors.muted(guildName || 'DM');
        
        // Don't log to console during dashboard, save to buffer instead
        // This prevents logs from interfering with dashboard updates
    }

    // Print event log
    static logEvent(eventName, message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        const icons = {
            info: colors.info('ℹ'),
            success: colors.success('✓'),
            warning: colors.warning('⚠'),
            error: colors.error('✗')
        };
        
        const icon = icons[type] || icons.info;
        const event = colors.primary(eventName);
        
        // Don't log during dashboard updates
    }

    // Print loading animation
    static loading(message) {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        
        return setInterval(() => {
            process.stdout.write(`\r${colors.info(frames[i])} ${message}`);
            i = (i + 1) % frames.length;
        }, 80);
    }

    // Stop loading
    static stopLoading(interval, finalMessage, success = true) {
        clearInterval(interval);
        const icon = success ? colors.success('✓') : colors.error('✗');
        process.stdout.write(`\r${icon} ${finalMessage}\n`);
    }

    // Print error
    static error(message, error = null) {
        console.log(`\n${colors.error('✗')} ${colors.error.bold('ERROR:')} ${message}`);
        if (error) {
            console.log(colors.muted('  ' + error.message));
            if (error.stack) {
                console.log(colors.muted('  Stack: ' + error.stack.split('\n')[1].trim()));
            }
        }
        stats.errors++;
    }

    // Print success
    static success(message) {
        console.log(`${colors.success('✓')} ${message}`);
    }

    // Print warning
    static warning(message) {
        console.log(`${colors.warning('⚠')} ${message}`);
    }

    // Print info
    static info(message) {
        console.log(`${colors.info('ℹ')} ${message}`);
    }

    // Format uptime
    static formatUptime(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));

        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    }

    // Print dashboard (updated in-place)
    static printDashboard(client) {
        // Clear screen untuk refresh
        console.clear();
        
        this.printBanner();
        this.divider('═', 70);
        console.log(colors.bold('\n📊 BOT INFORMATION\n'));
        this.printBotInfo(client);
        console.log(colors.bold('\n📈 STATISTICS\n'));
        this.printStatistics();
        this.divider('═', 70);
        console.log(colors.muted('\nPress CTRL+C to stop the bot\n'));
        console.log(colors.info(`Last Updated: ${new Date().toLocaleTimeString('id-ID')}`));
    }

    // Update stats
    static incrementStat(statName) {
        if (stats[statName] !== undefined) {
            stats[statName]++;
        } else if (stats.interactions[statName] !== undefined) {
            stats.interactions[statName]++;
        }
    }

    // Get stats
    static getStats() {
        return stats;
    }
}

module.exports = ConsoleUI;
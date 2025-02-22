const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { sendStatusEmbed } = require('./commands/status');

const configPath = path.resolve(__dirname, '../../config/config.yml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

const commands = [
    {
        name: 'status',
        description: 'Shows the current status of all services'
    }
];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

async function deployCommands() {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

client.on('ready', () => {
    console.log(`Bot is ready as ${client.user.tag}`);
    deployCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'status') {
        await sendStatusEmbed(interaction, {
            settings: config.discord.settings,
            client
        });
    }
});

client.login(config.discord.token);

module.exports = client;
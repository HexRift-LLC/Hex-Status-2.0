const { REST, Routes } = require('discord.js');
const config = require('../config/config.yml');

const commands = [
    {
        name: 'status',
        description: 'Shows the current status of all services'
    }
];

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
            { body: commands }
        );
        console.log('Slash commands registered!');
    } catch (error) {
        console.error(error);
    }
})();

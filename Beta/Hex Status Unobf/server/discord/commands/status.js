const { EmbedBuilder } = require('discord.js');
const { Service } = require('../../models');
const { generateStatsGraph } = require('../../utils/charts');
const { calculateStatusMetrics, createEnhancedStatusEmbed, startStatusUpdates } = require('../utils/statusUtils');
const { getServices } = require('../../services/monitor');
const fs = require('fs');
const path = require('path');

const statusMessagesFilePath = path.join(__dirname, '../../data/statusMessages.json');

async function sendStatusEmbed(interaction, { settings, client }) {
    await interaction.deferReply();
    
    const services = await getServices();
    const graphBuffer = await generateStatsGraph(services, settings, 'status');
    const statusData = calculateStatusMetrics(services);
    
    const statusEmbed = createEnhancedStatusEmbed(statusData, settings);
    const reply = await interaction.editReply({
        embeds: [statusEmbed],
        files: [{ attachment: graphBuffer, name: 'status-graph.png' }]
    });

    const statusMessage = {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageId: reply.id,
        timestamp: new Date()
    };

    let statusMessages = [];
    if (fs.existsSync(statusMessagesFilePath)) {
        statusMessages = JSON.parse(fs.readFileSync(statusMessagesFilePath, 'utf8'));
    } else {
        // Ensure the directory exists
        fs.mkdirSync(path.dirname(statusMessagesFilePath), { recursive: true });
    }

    const existingIndex = statusMessages.findIndex(msg => msg.guildId === interaction.guildId);
    if (existingIndex !== -1) {
        statusMessages[existingIndex] = statusMessage;
    } else {
        statusMessages.push(statusMessage);
    }

    fs.writeFileSync(statusMessagesFilePath, JSON.stringify(statusMessages, null, 2));

    startStatusUpdates(client, interaction.channel, reply, settings);
}

module.exports = { sendStatusEmbed };
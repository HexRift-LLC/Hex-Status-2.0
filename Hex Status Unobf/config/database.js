const mongoose = require('mongoose');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const config = yaml.load(fs.readFileSync(path.join(__dirname, 'config.yml'), 'utf8'));


const ServiceSchema = new mongoose.Schema({
    name: String,
    status: String,
    ping: [Number],
    uptime: Number,
    lastCheck: Date,
    downtimes: [{
        start: Date,
        end: Date
    }],
    healthScore: Number,
    responseTime: [{
        time: String,
        value: Number
    }]
});

const BotStateSchema = new mongoose.Schema({
    lastMessageId: String,
    serviceHistoryData: Map,
    lastUpdate: Date
});

const Service = mongoose.model('Service', ServiceSchema);
const BotState = mongoose.model('BotState', BotStateSchema);

module.exports = {
    connect: async () => {
        await mongoose.connect(config.database.url, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    },
    Service,
    BotState
};

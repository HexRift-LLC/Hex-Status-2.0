const axios = require('axios');
const { Service } = require('../models');

async function checkService(service) {
    const startTime = Date.now();
    try {
        const response = await axios.get(service.url, { timeout: 5000 });
        const responseTime = Date.now() - startTime;
        
        await Service.findByIdAndUpdate(service._id, {
            $set: {
                status: response.status === 200,
                responseTime,
                lastCheck: new Date()
            },
            $inc: { 
                uptime: 1,
                checks: 1 
            },
            $push: {
                history: {
                    status: response.status === 200,
                    responseTime,
                    timestamp: new Date()
                }
            }
        });
    } catch (error) {
        await Service.findByIdAndUpdate(service._id, {
            $set: {
                status: false,
                responseTime: 0,
                lastCheck: new Date()
            },
            $inc: { checks: 1 },
            $push: {
                history: {
                    status: false,
                    responseTime: 0,
                    timestamp: new Date()
                }
            }
        });
    }
}

// Check services every 30 seconds
const MONITOR_INTERVAL = 30000;

function startMonitoring() {
    setInterval(async () => {
        const services = await Service.find();
        await Promise.all(services.map(checkService));
        console.log('Services checked:', new Date().toISOString());
    }, MONITOR_INTERVAL);
}

module.exports = { startMonitoring };
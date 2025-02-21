const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, '../../config/config.yml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

let services = config.services.map(service => ({
  ...service,
  status: true,
  responseTime: 0,
  lastCheck: new Date(),
  uptime: 100,
  history: []
}));

const checkService = async (service) => {
  const startTime = Date.now();
  try {
    await axios.get(service.url, { timeout: 5000 });
    return { status: true, responseTime: Date.now() - startTime };
  } catch (error) {
    return { status: false, responseTime: 0 };
  }
};

const { updateServicesState } = require('../shared/services');

const monitorServices = async () => {
  services = await Promise.all(services.map(async (service) => {
    const result = await checkService(service);
    const updatedService = {
      ...service,
      status: result.status,
      responseTime: result.responseTime,
      lastCheck: new Date()
    };
    return updatedService;
  }));
  
  // Make sure we're updating the shared state
  updateServicesState(services);
  return services;
};
const getServices = () => services;

module.exports = { monitorServices, getServices };

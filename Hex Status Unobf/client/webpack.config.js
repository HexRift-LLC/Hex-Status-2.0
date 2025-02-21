module.exports = {
  // ... other config
  module: {
    rules: [
      {
        test: /\.ya?ml$/,
        use: 'yaml-loader'
      }
      // ... other rules
    ]
  }
};

import config from '../utils/configLoader';

// Server-side usage
const port = config.server.port;

// Client-side usage
const apiUrl = config.server.api.baseUrl;
const themeColors = config.theme;

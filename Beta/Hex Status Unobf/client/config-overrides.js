const webpack = require('webpack');

module.exports = function override(config) {
  config.resolve.fallback = {
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser')
  };
  
  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    })
  );

  return config;
}

module.exports = {
  webpack: {
    configure: {
      module: {
        rules: [
          {
            test: /\.ya?ml$/,
            use: 'raw-loader'
          }
        ]
      }
    }
  }
};

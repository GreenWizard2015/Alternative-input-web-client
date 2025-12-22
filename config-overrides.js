module.exports = function override(config) {
  // Add rule for worker files using worker-loader
  // This must come BEFORE other JS/TS rules to take precedence
  config.module.rules.unshift({
    test: /\.worker\.(ts|js)$/,
    use: {
      loader: 'worker-loader',
      options: {
        filename: '[name].worker.js',
        esModule: true
      }
    }
  });

  return config;
};

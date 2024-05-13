const WorkerPlugin = require('worker-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = {
  webpack: (config, { isServer }) => {
    config.plugins.push(new WorkerPlugin());
    // and worker-loader for web workers
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      use: { loader: 'worker-loader' },
      exclude: /node_modules/,
    });
    return config;
  }
};
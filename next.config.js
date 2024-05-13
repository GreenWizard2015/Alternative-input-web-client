const WorkerPlugin = require('worker-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = {
  webpack: (config, { isServer }) => {
    config.plugins.push(new WorkerPlugin());
    return config;
  }
};
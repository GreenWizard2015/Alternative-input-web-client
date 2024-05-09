/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = {
  ...nextConfig,
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.txt$/i,
      use: ['raw-loader'],
    });
    config.module.rules.push({
      test: /\.svg$/i,
      use: ['raw-loader'],
    });

    return config;
  }
};
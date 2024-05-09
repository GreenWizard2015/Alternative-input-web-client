// next.config.js

module.exports = {
  distDir: 'build',
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    }
  }
};

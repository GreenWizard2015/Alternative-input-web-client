// next.config.js
const path = require('path');

module.exports = {
  distDir: 'build',
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'], // Указываете расширения файлов, которые должны рассматриваться как страницы
  webpack(config, options) {
    config.resolve.modules.push(path.resolve('./src')); // Добавляет src в модульные пути
    return config;
  },  
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    }
  }
};

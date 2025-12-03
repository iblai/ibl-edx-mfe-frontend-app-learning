const path = require('path');
const { createConfig } = require('@openedx/frontend-build');

const config = createConfig('webpack-dev');

config.resolve.alias = {
  ...config.resolve.alias,
  '@src': path.resolve(__dirname, 'src'),
  // Use local frontend-platform instead of npm package
  '@edx/frontend-platform': path.resolve('/openedx/frontend-platform/dist'),
};

module.exports = config;

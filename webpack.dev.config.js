const path = require('path');
const { createConfig } = require('@openedx/frontend-build');

const config = createConfig('webpack-dev');

config.resolve.alias = {
  ...config.resolve.alias,
  '@src': path.resolve(__dirname, 'src'),
  // Option B: treat analytics-shim as the canonical analytics module at build time
  '@edx/frontend-platform/analytics': path.resolve(__dirname, 'src/utils/analytics-shim.js'),
};

module.exports = config;

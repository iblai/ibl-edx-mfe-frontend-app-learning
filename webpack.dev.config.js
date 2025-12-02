const path = require('path');
const { createConfig } = require('@openedx/frontend-build');

const config = createConfig('webpack-dev');

config.resolve.alias = {
  ...config.resolve.alias,
  '@src': path.resolve(__dirname, 'src'),
  // PHASE 3, STEP 6: Mock analytics module in minimal render mode
  // Redirect @edx/frontend-platform/analytics to our shim when MINIMAL_RENDER_MODE is enabled
  ...(process.env.MINIMAL_RENDER_MODE !== 'false' ? {
    '@edx/frontend-platform/analytics': path.resolve(__dirname, 'src/utils/analytics-shim.js'),
  } : {}),
};

module.exports = config;

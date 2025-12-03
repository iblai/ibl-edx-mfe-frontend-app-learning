const path = require('path');
const { createConfig } = require('@openedx/frontend-build');
const CopyPlugin = require('copy-webpack-plugin');

const config = createConfig('webpack-prod');

config.plugins.push(
  new CopyPlugin({
    patterns: [
      {
        from: path.resolve(__dirname, './public/static'),
        to: path.resolve(__dirname, './dist/static'),
      },
    ],
  }),
);

config.resolve.alias = {
  ...config.resolve.alias,
  '@src': path.resolve(__dirname, 'src'),
  // Use analytics shim so analytics is always available even if initialize() fails
  // This prevents sendTrackEvent errors when APP_INIT_ERROR fires before APP_READY
  '@edx/frontend-platform/analytics': path.resolve(__dirname, 'src/utils/analytics-shim.js'),
};

module.exports = config;

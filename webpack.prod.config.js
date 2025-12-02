const path = require('path');
const { createConfig } = require('@openedx/frontend-build');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

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
  // PHASE 3, STEP 6: Mock analytics module in minimal render mode
  // Always redirect @edx/frontend-platform/analytics to our shim
  // This ensures sendTrackEvent is always available
  '@edx/frontend-platform/analytics': path.resolve(__dirname, 'src/utils/analytics-shim.js'),
};

// Also use NormalModuleReplacementPlugin as backup
config.plugins.push(
  new webpack.NormalModuleReplacementPlugin(
    /^@edx\/frontend-platform\/analytics$/,
    path.resolve(__dirname, 'src/utils/analytics-shim.js')
  )
);

module.exports = config;

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

// Use local frontend-platform instead of npm package
const frontendPlatformPath = path.resolve('/openedx/frontend-platform/dist');

config.resolve.alias = {
  ...config.resolve.alias,
  '@src': path.resolve(__dirname, 'src'),
  // Ensure React resolves from node_modules (not from frontend-platform)
  // This prevents React from resolving to null when imported in frontend-platform components
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  // Alias @edx/frontend-platform modules to use local build instead of npm package
  // Only alias the specific @edx/frontend-platform modules, not all modules
  '@edx/frontend-platform': frontendPlatformPath,
  '@edx/frontend-platform/i18n': path.join(frontendPlatformPath, 'i18n'),
  '@edx/frontend-platform/analytics': path.join(frontendPlatformPath, 'analytics'),
  '@edx/frontend-platform/auth': path.join(frontendPlatformPath, 'auth'),
  '@edx/frontend-platform/logging': path.join(frontendPlatformPath, 'logging'),
  '@edx/frontend-platform/react': path.join(frontendPlatformPath, 'react'),
};

module.exports = config;

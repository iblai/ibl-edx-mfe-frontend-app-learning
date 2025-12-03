const path = require('path');
const { createConfig } = require('@openedx/frontend-build');

const config = createConfig('webpack-dev');

// Use local frontend-platform instead of npm package
const frontendPlatformPath = path.resolve('/openedx/frontend-platform/dist');

config.resolve.alias = {
  ...config.resolve.alias,
  '@src': path.resolve(__dirname, 'src'),
  // Ensure React and React Router resolve from node_modules (not from frontend-platform)
  // This prevents React from resolving to null when imported in frontend-platform components
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  'react-router': path.resolve(__dirname, 'node_modules/react-router'),
  'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom'),
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

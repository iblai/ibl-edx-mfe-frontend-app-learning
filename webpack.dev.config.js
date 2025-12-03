const path = require('path');
const { createConfig } = require('@openedx/frontend-build');

const config = createConfig('webpack-dev');

// Use local frontend-platform instead of npm package
const frontendPlatformPath = path.resolve('/openedx/frontend-platform/dist');

// Add the frontend-platform dist directory to module resolution
// This allows webpack to find @edx/frontend-platform and its submodules
config.resolve.modules = [
  path.resolve('/openedx/frontend-platform/dist'),
  ...(config.resolve.modules || ['node_modules']),
];

config.resolve.alias = {
  ...config.resolve.alias,
  '@src': path.resolve(__dirname, 'src'),
  // Alias the base module - webpack will resolve submodules relative to this
  '@edx/frontend-platform': frontendPlatformPath,
  // Explicitly alias submodules to ensure they resolve correctly
  '@edx/frontend-platform/i18n': path.join(frontendPlatformPath, 'i18n'),
  '@edx/frontend-platform/analytics': path.join(frontendPlatformPath, 'analytics'),
  '@edx/frontend-platform/auth': path.join(frontendPlatformPath, 'auth'),
  '@edx/frontend-platform/logging': path.join(frontendPlatformPath, 'logging'),
  '@edx/frontend-platform/react': path.join(frontendPlatformPath, 'react'),
};

module.exports = config;

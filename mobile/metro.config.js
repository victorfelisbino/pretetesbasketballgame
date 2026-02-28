const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'src');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(projectRoot, '..', 'node_modules'),
];
// Allow importing .js files from shared src/
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;

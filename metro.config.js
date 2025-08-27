const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'geojson' to asset extensions
config.resolver.assetExts.push('geojson');

module.exports = config;

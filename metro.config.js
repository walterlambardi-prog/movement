const { getDefaultConfig } = require("expo/metro-config");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

module.exports = wrapWithReanimatedMetroConfig(defaultConfig);

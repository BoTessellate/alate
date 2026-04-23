// Metro config for Expo — extended to handle SVGs as React components
// via `react-native-svg-transformer`. Lets us `import Heading from
// './heading.svg'` and render it as <Heading />, instead of loading
// SVGs through <Image> (which would rasterise them).

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Hand SVG imports to the transformer; strip .svg from assets so they
// don't double-register, and add .svg to source extensions.
const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

module.exports = config;

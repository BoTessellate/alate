// Jest stub for .svg imports. react-native-svg-transformer turns SVGs
// into React components at Metro bundle time; jest doesn't run that
// transform, so imports like `import Heading from './foo.svg'` would
// blow up. This stub returns a minimal component that satisfies the
// HeadingImage caller (accepts width/height).

const React = require('react');
const { View } = require('react-native');

const SvgStub = (props) => React.createElement(View, props);
module.exports = { __esModule: true, default: SvgStub };

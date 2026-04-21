// Ambient module declaration — lets TypeScript accept `import Heading
// from './heading.svg'` as a React component prop, matching what
// react-native-svg-transformer produces at bundle time.

declare module '*.svg' {
  import * as React from 'react';
  import { SvgProps } from 'react-native-svg';
  const Component: React.FC<SvgProps>;
  export default Component;
}

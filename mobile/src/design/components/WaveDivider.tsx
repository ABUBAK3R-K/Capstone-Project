import { View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface WaveDividerProps {
  /** Fill colour — usually the section that follows, since the wave "cuts into" it. */
  color: string;
  height?: number;
  /** Flip vertically, for a wave that opens upward instead of downward. */
  flip?: boolean;
  style?: ViewStyle;
}

/**
 * A single, gentle wave crest used as a section transition. This is the app's
 * one literal coastal motif — used sparingly (a couple of places per screen at
 * most), never as a repeating pattern or border, so it reads as a deliberate
 * accent rather than a texture slapped on everything.
 */
export function WaveDivider({ color, height = 32, flip = false, style }: WaveDividerProps) {
  return (
    <View style={[{ height, transform: [{ scaleY: flip ? -1 : 1 }] }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 1440 100" preserveAspectRatio="none">
        <Path
          d="M0,32 C240,90 480,0 720,28 C960,56 1200,96 1440,40 L1440,100 L0,100 Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

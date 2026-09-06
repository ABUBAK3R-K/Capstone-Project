import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, spacing } from '../tokens';

interface ScreenProps {
  children: React.ReactNode;
  /** Apply the top safe-area inset. Off for screens with their own hero/map. */
  edges?: { top?: boolean; bottom?: boolean };
  background?: string;
  style?: ViewStyle;
}

export function Screen({ children, edges = { top: true }, background = palette.canvas, style }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: background,
          paddingTop: edges.top ? insets.top : 0,
          paddingBottom: edges.bottom ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});

/** Horizontal gutter used by every scrolling screen. */
export const screenGutter = spacing.xl;

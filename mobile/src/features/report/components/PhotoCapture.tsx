import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/design/typography';
import { gradients, palette, radius, spacing } from '@/design/tokens';

interface PhotoCaptureProps {
  uri: string | null;
  onCapture: () => void;
  onPickFromLibrary: () => void;
  onClear: () => void;
  disabled?: boolean;
}

/**
 * The photo is the anchor of a report, so it gets the largest target on the
 * screen and stays tappable-to-replace once filled.
 */
export function PhotoCapture({
  uri,
  onCapture,
  onPickFromLibrary,
  onClear,
  disabled = false,
}: PhotoCaptureProps) {
  if (uri) {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.frame}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <LinearGradient
          colors={gradients.photoControls}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.overlayBar}>
          <Pressable onPress={onClear} disabled={disabled} style={styles.overlayButton} hitSlop={8}>
            <Ionicons name="trash-outline" size={15} color={palette.inkInverse} />
            <Text variant="caption" weight="semibold" tone="inverse">
              Remove
            </Text>
          </Pressable>

          <Pressable onPress={onCapture} disabled={disabled} style={styles.overlayButton} hitSlop={8}>
            <Ionicons name="camera-reverse-outline" size={15} color={palette.inkInverse} />
            <Text variant="caption" weight="semibold" tone="inverse">
              Retake
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <View style={styles.empty}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Take a photo of the issue"
        onPress={onCapture}
        disabled={disabled}
        style={({ pressed }) => [styles.captureZone, pressed && styles.pressed]}
      >
        <View style={styles.cameraWell}>
          <Ionicons name="camera" size={26} color={palette.primary} />
        </View>
        <View style={styles.captureCopy}>
          <Text variant="subheading" weight="semibold" align="center">
            Take a photo
          </Text>
          <Text variant="label" tone="muted" align="center">
            A picture is what lets the city verify and prioritise the issue.
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={onPickFromLibrary} disabled={disabled} style={styles.libraryLink} hitSlop={8}>
        <Ionicons name="images-outline" size={15} color={palette.inkMuted} />
        <Text variant="label" weight="medium" tone="muted">
          Choose from library
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 260,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: palette.canvasSunken,
    justifyContent: 'flex-end',
  },
  overlayBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  overlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: palette.onImageSurface,
  },
  empty: { gap: spacing.md },
  captureZone: {
    height: 220,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.primaryBorder,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  pressed: { opacity: 0.8 },
  cameraWell: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureCopy: { gap: spacing.xs },
  libraryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});

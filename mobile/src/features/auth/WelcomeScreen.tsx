import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Text } from '@/design/typography';
import { gradients, motion, palette, radius, shadows, spacing } from '@/design/tokens';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/**
 * The very first screen an unauthenticated visitor sees. Customer and
 * business are deliberately two full-screen destinations, not a toggle on
 * one form — the two products diverge from here on (see CLAUDE.md's
 * business-accounts navigation notes).
 */
export function WelcomeScreen() {
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={gradients.inkHero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.root, { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Animated.View entering={FadeInDown.duration(motion.slow)} style={styles.brand}>
        <View style={styles.mark}>
          <Ionicons name="navigate" size={20} color={palette.inkInverse} />
        </View>
        <Text variant="label" weight="semibold" tone="inverse" uppercase style={styles.wordmark}>
          CityGuide
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(motion.slow)} style={styles.heroCopy}>
        <Text variant="display" weight="bold" tone="inverse">
          Discover your city, or grow your business in it
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(120).duration(motion.slow)} style={styles.choices}>
        <ChoiceCard
          icon="compass"
          title="I'm a customer"
          subtitle="Browse local places, book appointments, report issues"
          onPress={() => navigation.navigate('Auth')}
        />
        <ChoiceCard
          icon="storefront"
          title="I'm a business owner"
          subtitle="List your business and manage bookings"
          onPress={() => navigation.navigate('BusinessAuth')}
        />
      </Animated.View>
    </LinearGradient>
  );
}

function ChoiceCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadows.md, pressed && styles.cardPressed]}
    >
      <View style={styles.cardIcon}>
        <Ionicons name={icon} size={22} color={palette.primary} />
      </View>
      <View style={styles.cardCopy}>
        <Text variant="heading" weight="semibold">
          {title}
        </Text>
        <Text variant="body" tone="muted">
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={palette.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { letterSpacing: 1.6 },
  heroCopy: { marginTop: spacing.huge },
  choices: { gap: spacing.lg, marginBottom: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardPressed: { opacity: 0.85 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1, gap: spacing.xxs },
});

import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/design/components/Button';
import { Text } from '@/design/typography';
import { screenGutter } from '@/design/components/Screen';
import { gradients, palette, radius, spacing } from '@/design/tokens';

export function BusinessProfileScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);

  const email = user?.email ?? 'Business account';
  const initial = (user?.email?.[0] ?? 'B').toUpperCase();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.inkHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + spacing.xxl }]}
        >
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text variant="title" weight="bold" tone="inverse">
                {initial}
              </Text>
            </View>
            <View style={styles.identityCopy}>
              <Text variant="heading" weight="semibold" tone="inverse" numberOfLines={1}>
                {email}
              </Text>
              <Text variant="caption" style={styles.identityMeta}>
                Business account
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Button
            label="Sign out"
            variant="secondary"
            icon="log-out-outline"
            fullWidth
            loading={signingOut}
            onPress={async () => {
              setSigningOut(true);
              try {
                await signOut();
              } finally {
                setSigningOut(false);
              }
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingBottom: spacing.huge },
  header: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing.xxxl,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: palette.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: { flex: 1, gap: spacing.xxs },
  identityMeta: { color: palette.onInkFaint },
  section: { marginTop: spacing.xxxl, paddingHorizontal: screenGutter, gap: spacing.lg },
});

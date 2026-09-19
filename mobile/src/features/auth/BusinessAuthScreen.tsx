import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/design/components/Button';
import { Text } from '@/design/typography';
import { gradients, motion, palette, radius, spacing } from '@/design/tokens';
import { Field } from './components/Field';

type Mode = 'signin' | 'signup';

const COPY: Record<Mode, { title: string; subtitle: string; cta: string; switchTo: string }> = {
  signin: {
    title: 'Welcome back',
    subtitle: 'Sign in to manage your listing and bookings.',
    cta: 'Sign in',
    switchTo: 'New business? Create an account',
  },
  signup: {
    title: 'List your business',
    subtitle: 'Get discovered by nearby customers and manage bookings in one place.',
    cta: 'Create business account',
    switchTo: 'Already have an account? Sign in',
  },
};

/**
 * The business counterpart of AuthScreen — same email/password mechanics,
 * but signs up with account_type: 'business' (migration 008) so
 * RootNavigator routes into BusinessTabNavigator instead of the customer
 * tabs. The business's name/category/etc. are collected later, when they
 * create their listing on the dashboard — not here.
 */
export function BusinessAuthScreen() {
  const { signIn, signUp } = useAuth();
  const navigation = useNavigation();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const insets = useSafeAreaInsets();
  const copy = COPY[mode];

  const validate = () => {
    if (!email.includes('@')) return 'Enter a valid email address.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  const submit = async () => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password, { accountType: 'business' });
        if (needsConfirmation) {
          setNotice('Check your inbox to confirm your email, then sign in.');
          setMode('signin');
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode((current) => (current === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setNotice(null);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradients.inkHero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.huge }]}
      >
        <Animated.View entering={FadeInDown.duration(motion.slow)} style={styles.brandRow}>
          {navigation.canGoBack() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={18} color={palette.inkInverse} />
            </Pressable>
          ) : null}
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Ionicons name="storefront" size={20} color={palette.inkInverse} />
            </View>
            <Text variant="label" weight="semibold" tone="inverse" uppercase style={styles.wordmark}>
              CityGuide Business
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(motion.slow)} style={styles.heroCopy}>
          <Text variant="display" weight="bold" tone="inverse">
            {copy.title}
          </Text>
          <Text variant="body" style={styles.heroSubtitle}>
            {copy.subtitle}
          </Text>
        </Animated.View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.formWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={12}
      >
        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + spacing.xxxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.duration(motion.slow)} style={styles.fields}>
            <Field
              label="Email"
              icon="mail-outline"
              placeholder="owner@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
            />
            <Field
              label="Password"
              icon="lock-closed-outline"
              placeholder="At least 6 characters"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              secure
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </Animated.View>

          {mode === 'signup' ? (
            <View style={styles.noticeInline}>
              <Ionicons name="information-circle-outline" size={16} color={palette.inkMuted} />
              <Text variant="caption" tone="muted" style={styles.noticeInlineText}>
                After signing up you'll set up your listing and submit verification documents for
                review — your business won't appear to customers until it's approved.
              </Text>
            </View>
          ) : null}

          {notice ? (
            <Animated.View entering={FadeIn} style={[styles.banner, styles.bannerInfo]}>
              <Ionicons name="mail-open-outline" size={16} color={palette.accent} />
              <Text variant="label" tone="accent" style={styles.bannerText}>
                {notice}
              </Text>
            </Animated.View>
          ) : null}

          {error ? (
            <Animated.View entering={FadeIn} style={[styles.banner, styles.bannerError]}>
              <Ionicons name="alert-circle-outline" size={16} color={palette.danger} />
              <Text variant="label" tone="danger" style={styles.bannerText}>
                {error}
              </Text>
            </Animated.View>
          ) : null}

          <Button
            label={copy.cta}
            onPress={submit}
            loading={submitting}
            size="lg"
            fullWidth
            icon="arrow-forward"
            iconPosition="trailing"
          />

          <Pressable onPress={switchMode} hitSlop={8} style={styles.switch}>
            <Text variant="label" tone="muted" align="center">
              {copy.switchTo}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  hero: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
    borderBottomLeftRadius: radius.xxl + 8,
    borderBottomRightRadius: radius.xxl + 8,
    gap: spacing.xxxl,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: palette.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { letterSpacing: 1.2 },
  heroCopy: { gap: spacing.sm },
  heroSubtitle: { color: palette.onInkMuted, maxWidth: 300 },
  formWrap: { flex: 1 },
  form: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    gap: spacing.xl,
  },
  fields: { gap: spacing.lg },
  noticeInline: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xxs },
  noticeInlineText: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  bannerInfo: { backgroundColor: palette.accentSoft },
  bannerError: { backgroundColor: palette.dangerSoft },
  bannerText: { flex: 1 },
  switch: { paddingVertical: spacing.sm },
});

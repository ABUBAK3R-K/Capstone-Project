import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/design/components/Button';
import { Chip } from '@/design/components/Chip';
import { EmptyState } from '@/design/components/EmptyState';
import { Screen, screenGutter } from '@/design/components/Screen';
import { Eyebrow, Text } from '@/design/typography';
import { fontFamily, palette, radius, shadows, spacing, typeScale } from '@/design/tokens';
import { PLACE_CATEGORIES } from '@/constants/categories';
import { useContributePlace } from '@/hooks/usePlaces';
import { getPreciseLocation } from '@/lib/location';
import type { LatLng } from '@/lib/geo';
import { Field } from '@/features/auth/components/Field';
import { LocationTag } from '@/features/report/components/LocationTag';
import type { RootStackParamList } from '@/navigation/types';
import type { Place } from '@/types/place';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type AddPlaceRoute = RouteProp<RootStackParamList, 'AddPlace'>;

const MIN_NAME_LENGTH = 2;
const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Community curation: put a missing place on the map. The location is the
 * user's current GPS fix — "add a place you're standing at" — which keeps
 * contributions honest without a map-pin picker. RLS (migration 009) credits
 * the row to the caller and marks it `user_added`.
 */
export function AddPlaceScreen() {
  const navigation = useNavigation<Navigation>();
  const { params } = useRoute<AddPlaceRoute>();
  const { user, isGuest } = useAuth();
  const contribute = useContributePlace();

  const [name, setName] = useState(params?.name ?? '');
  const [category, setCategory] = useState<string>(PLACE_CATEGORIES[0].name);
  const [subcategory, setSubcategory] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(true);
  const [nameTouched, setNameTouched] = useState(false);
  const [created, setCreated] = useState<Place | null>(null);

  const captureLocation = useCallback(async () => {
    setResolvingLocation(true);
    try {
      setLocation(await getPreciseLocation());
    } catch {
      setLocation(null);
    } finally {
      setResolvingLocation(false);
    }
  }, []);

  useEffect(() => {
    void captureLocation();
  }, [captureLocation]);

  const reset = useCallback(() => {
    setName('');
    setSubcategory('');
    setAddress('');
    setDescription('');
    setNameTouched(false);
    setCreated(null);
    contribute.reset();
    void captureLocation();
  }, [captureLocation, contribute]);

  const nameError =
    nameTouched && name.trim().length < MIN_NAME_LENGTH ? `Use at least ${MIN_NAME_LENGTH} characters.` : null;
  const canSubmit = name.trim().length >= MIN_NAME_LENGTH && Boolean(location) && !contribute.isPending;

  const submit = useCallback(() => {
    setNameTouched(true);
    if (!user || !location || name.trim().length < MIN_NAME_LENGTH) return;

    contribute.mutate(
      { userId: user.id, name, category, subcategory, description, address, location },
      {
        onSuccess: (place) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCreated(place);
        },
        onError: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      },
    );
  }, [address, category, contribute, description, location, name, subcategory, user]);

  // ─── Guest ────────────────────────────────────────────────────────────────
  if (isGuest || !user) {
    return (
      <Screen>
        <View style={styles.centered}>
          <EmptyState
            icon="person-circle-outline"
            title="Sign in to add places"
            message="Contributions are credited to your account so the community can trust them."
          />
          <Button label="Go back" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  // ─── Success ──────────────────────────────────────────────────────────────
  if (created) {
    return (
      <Screen>
        <Animated.View entering={FadeIn.duration(280)} style={styles.centered}>
          <View style={styles.successMark}>
            <Ionicons name="checkmark" size={34} color={palette.inkInverse} />
          </View>
          <View style={styles.successCopy}>
            <Text variant="title" weight="bold" align="center">
              {created.name} is on the map
            </Text>
            <Text variant="body" tone="muted" align="center">
              Everyone nearby can find it now. Similar-place suggestions for it appear after the next
              recommendation refresh.
            </Text>
          </View>
          <View style={styles.successActions}>
            <Button label="Add another" onPress={reset} variant="secondary" />
            <Button
              label="View place"
              onPress={() => navigation.replace('PlaceDetail', { place: created })}
              icon="arrow-forward"
              iconPosition="trailing"
            />
          </View>
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={20} color={palette.ink} />
            </Pressable>
            <Eyebrow>Community</Eyebrow>
            <Text variant="display" weight="bold">
              Add a place
            </Text>
            <Text variant="body" tone="muted">
              Stand at the place you're adding — its location is taken from your GPS.
            </Text>
          </View>

          <Animated.View entering={FadeInUp.duration(300)} style={styles.block}>
            <LocationTag coords={location} resolving={resolvingLocation} onRetry={() => void captureLocation()} />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(60).duration(300)} style={styles.block}>
            <Field
              label="Name"
              icon="storefront-outline"
              value={name}
              onChangeText={setName}
              onBlur={() => setNameTouched(true)}
              placeholder="e.g. Sri Krishna Bakery"
              maxLength={120}
              error={nameError}
              editable={!contribute.isPending}
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(100).duration(300)} style={styles.block}>
            <Text variant="label" weight="semibold" tone="secondary">
              Category
            </Text>
            <View style={styles.chips}>
              {PLACE_CATEGORIES.map((meta) => (
                <Chip
                  key={meta.name}
                  label={meta.label}
                  icon={meta.icon}
                  accent={meta.color}
                  selected={category === meta.name}
                  onPress={() => setCategory(meta.name)}
                />
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(140).duration(300)} style={styles.block}>
            <Field
              label="Type (optional)"
              icon="pricetag-outline"
              value={subcategory}
              onChangeText={setSubcategory}
              placeholder="e.g. bakery, temple, pharmacy"
              maxLength={60}
              autoCapitalize="none"
              editable={!contribute.isPending}
            />
            <Field
              label="Address (optional)"
              icon="location-outline"
              value={address}
              onChangeText={setAddress}
              placeholder="Street, area"
              maxLength={200}
              editable={!contribute.isPending}
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(180).duration(300)} style={styles.block}>
            <Text variant="label" weight="semibold" tone="secondary">
              Description (optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              editable={!contribute.isPending}
              placeholder="What's it known for? Opening hours, landmarks…"
              placeholderTextColor={palette.inkFaint}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={MAX_DESCRIPTION_LENGTH}
              style={styles.textArea}
            />
            <Text variant="caption" tone="faint" align="right">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </Text>
          </Animated.View>

          {contribute.isError ? (
            <Animated.View entering={FadeIn} style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={17} color={palette.danger} />
              <View style={styles.errorCopy}>
                <Text variant="label" weight="semibold" tone="danger">
                  Could not add the place
                </Text>
                <Text variant="caption" tone="danger">
                  {contribute.error instanceof Error ? contribute.error.message : 'Please try again.'}
                </Text>
              </View>
            </Animated.View>
          ) : null}

          <View style={styles.submitBlock}>
            <Button
              label={contribute.isPending ? 'Adding…' : 'Add to CityGuide'}
              onPress={submit}
              disabled={!canSubmit}
              loading={contribute.isPending}
              size="lg"
              fullWidth
              icon="add-circle"
            />
            {!canSubmit && !contribute.isPending ? (
              <Text variant="caption" tone="faint" align="center">
                {!location ? 'Waiting for a location fix.' : 'Give the place a name to continue.'}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
    gap: spacing.xxl,
  },
  header: { gap: spacing.sm },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  block: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  textArea: {
    minHeight: 108,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.border,
    color: palette.ink,
    fontFamily: fontFamily.body,
    fontSize: typeScale.body.fontSize,
    lineHeight: typeScale.body.lineHeight,
  },
  errorBanner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.dangerSoft,
  },
  errorCopy: { flex: 1, gap: spacing.xxs },
  submitBlock: { gap: spacing.md },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: screenGutter,
    gap: spacing.xxl,
  },
  successMark: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: palette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCopy: { gap: spacing.sm, maxWidth: 320 },
  successActions: { flexDirection: 'row', gap: spacing.md },
});

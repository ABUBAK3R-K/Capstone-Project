import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/design/components/Button';
import { EmptyState } from '@/design/components/EmptyState';
import { Screen, screenGutter } from '@/design/components/Screen';
import { Eyebrow, Text } from '@/design/typography';
import { fontFamily, palette, radius, spacing, typeScale } from '@/design/tokens';
import { getPreciseLocation } from '@/lib/location';
import { submitReport } from '@/lib/reports';
import type { LatLng } from '@/lib/geo';
import type { RootStackParamList } from '@/navigation/types';
import { CategorySelect } from './components/CategorySelect';
import { LocationTag } from './components/LocationTag';
import { PhotoCapture } from './components/PhotoCapture';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.65,
  base64: true,
  allowsEditing: false,
  exif: false,
};

export function ReportScreen() {
  const { user, isGuest } = useAuth();
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [category, setCategory] = useState('Pothole');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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

  const handleAsset = useCallback(
    async (result: ImagePicker.ImagePickerResult) => {
      if (result.canceled || !result.assets[0]?.base64) return;

      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64!);
      setError(null);
      // GPS is captured the instant a photo lands, matching where the user is
      // standing rather than wherever they eventually hit submit.
      await captureLocation();
    },
    [captureLocation],
  );

  const openCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to photograph the issue.');
      return;
    }
    await handleAsset(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
  }, [handleAsset]);

  const openLibrary = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to attach an existing picture.');
      return;
    }
    await handleAsset(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
  }, [handleAsset]);

  const reset = useCallback(() => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setLocation(null);
    setDescription('');
    setCategory('Pothole');
    setError(null);
    setSubmitted(false);
  }, []);

  const submit = useCallback(async () => {
    if (!user || !photoBase64 || !location) return;

    setSubmitting(true);
    setError(null);
    try {
      await submitReport({
        userId: user.id,
        photoBase64,
        category,
        description,
        location,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void queryClient.invalidateQueries({ queryKey: ['visible-reports'] });
      setSubmitted(true);
    } catch (caught) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(caught instanceof Error ? caught.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [category, description, location, photoBase64, queryClient, user]);

  // ─── Guest ────────────────────────────────────────────────────────────────
  if (isGuest || !user) {
    return (
      <Screen>
        <View style={styles.centered}>
          <EmptyState
            icon="person-circle-outline"
            title="Sign in to report"
            message="Reports are tied to your account so the city can follow up with you."
          />
        </View>
      </Screen>
    );
  }

  // ─── Success ──────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <Screen>
        <Animated.View entering={FadeIn.duration(280)} style={styles.centered}>
          <View style={styles.successMark}>
            <Ionicons name="checkmark" size={34} color={palette.inkInverse} />
          </View>
          <View style={styles.successCopy}>
            <Text variant="title" weight="bold" align="center">
              Report submitted
            </Text>
            <Text variant="body" tone="muted" align="center">
              It is now visible to the authorities handling {category.toLowerCase()} issues. You can
              track its status on your Home feed.
            </Text>
          </View>
          <View style={styles.successActions}>
            <Button label="Report another" onPress={reset} variant="secondary" />
            <Button
              label="Back to home"
              onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
              icon="arrow-forward"
              iconPosition="trailing"
            />
          </View>
        </Animated.View>
      </Screen>
    );
  }

  const canSubmit = Boolean(photoBase64 && location) && !submitting;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Eyebrow>Civic report</Eyebrow>
            <Text variant="display" weight="bold">
              Report an issue
            </Text>
            <Text variant="body" tone="muted">
              Three steps: a photo, what kind of problem it is, and anything worth adding.
            </Text>
          </View>

          {/* Step 1 — photo */}
          <Animated.View entering={FadeInUp.duration(300)} style={styles.step}>
            <StepLabel index={1} title="Photograph the issue" done={Boolean(photoUri)} />
            <PhotoCapture
              uri={photoUri}
              onCapture={openCamera}
              onPickFromLibrary={openLibrary}
              onClear={() => {
                setPhotoUri(null);
                setPhotoBase64(null);
                setLocation(null);
              }}
              disabled={submitting}
            />
            {photoUri ? (
              <LocationTag
                coords={location}
                resolving={resolvingLocation}
                onRetry={() => void captureLocation()}
              />
            ) : null}
          </Animated.View>

          {/* Step 2 — category */}
          <Animated.View entering={FadeInUp.delay(60).duration(300)} style={styles.step}>
            <StepLabel index={2} title="What kind of problem?" done />
            <CategorySelect value={category} onChange={setCategory} disabled={submitting} />
          </Animated.View>

          {/* Step 3 — description */}
          <Animated.View entering={FadeInUp.delay(120).duration(300)} style={styles.step}>
            <StepLabel index={3} title="Add detail" optional done={description.trim().length > 0} />
            <TextInput
              value={description}
              onChangeText={setDescription}
              editable={!submitting}
              placeholder="Where exactly is it? How long has it been there?"
              placeholderTextColor={palette.inkFaint}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
              style={styles.textArea}
            />
            <Text variant="caption" tone="faint" align="right">
              {description.length}/500
            </Text>
          </Animated.View>

          {error ? (
            <Animated.View entering={FadeIn} style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={17} color={palette.danger} />
              <View style={styles.errorCopy}>
                <Text variant="label" weight="semibold" tone="danger">
                  Could not submit
                </Text>
                <Text variant="caption" tone="danger">
                  {error}
                </Text>
                <Text variant="caption" tone="muted">
                  Your photo and details are still here — try again.
                </Text>
              </View>
            </Animated.View>
          ) : null}

          <View style={styles.submitBlock}>
            <Button
              label={submitting ? 'Submitting…' : 'Submit report'}
              onPress={submit}
              disabled={!canSubmit}
              loading={submitting}
              size="lg"
              fullWidth
              icon="send"
            />
            {!canSubmit && !submitting ? (
              <Text variant="caption" tone="faint" align="center">
                {!photoBase64 ? 'Add a photo to continue.' : 'Waiting for a location fix.'}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function StepLabel({
  index,
  title,
  done = false,
  optional = false,
}: {
  index: number;
  title: string;
  done?: boolean;
  optional?: boolean;
}) {
  return (
    <View style={styles.stepLabel}>
      <View style={[styles.stepPip, done && styles.stepPipDone]}>
        {done ? (
          <Ionicons name="checkmark" size={12} color={palette.inkInverse} />
        ) : (
          <Text variant="caption" weight="semibold" tone="muted">
            {index}
          </Text>
        )}
      </View>
      <Text variant="subheading" weight="semibold" style={styles.flex}>
        {title}
      </Text>
      {optional ? (
        <Text variant="caption" tone="faint" weight="medium">
          Optional
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.xxxl,
  },
  header: { gap: spacing.sm },
  step: { gap: spacing.md },
  stepLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepPip: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: palette.canvasSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPipDone: { backgroundColor: palette.success },
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

import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/providers/AuthProvider';
import { useLocation } from '@/providers/LocationProvider';
import { Badge } from '@/design/components/Badge';
import { Button } from '@/design/components/Button';
import { Card } from '@/design/components/Card';
import { Screen, screenGutter } from '@/design/components/Screen';
import { SectionHeader } from '@/design/components/SectionHeader';
import { Text } from '@/design/typography';
import { fontFamily, palette, radius, spacing, typeScale } from '@/design/tokens';
import { base64ToBytes } from '@/lib/reports';
import {
  addVerificationDocument,
  createBusiness,
  updateBusiness,
  uploadVerificationDocument,
} from '@/lib/businesses';
import { useInvalidateBusiness, useOwnBusiness } from '@/hooks/useBusiness';
import type { Business, OperatingHours, VerificationStatus } from '@/types/business';
import { OperatingHoursEditor } from './components/OperatingHoursEditor';

const STATUS_META: Record<VerificationStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Pending review', color: palette.warning, icon: 'time-outline' },
  approved: { label: 'Approved — live', color: palette.success, icon: 'checkmark-circle' },
  rejected: { label: 'Rejected', color: palette.danger, icon: 'close-circle' },
};

export function BusinessDashboardScreen() {
  const { user } = useAuth();
  const { data: business, isLoading } = useOwnBusiness(user?.id);

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="display" weight="bold">
            {business ? business.name : 'Your business'}
          </Text>
          {business ? (
            <Badge
              label={STATUS_META[business.verification_status].label}
              color={STATUS_META[business.verification_status].color}
              icon={STATUS_META[business.verification_status].icon}
            />
          ) : null}
        </View>

        {business ? <BusinessEditor business={business} /> : <CreateBusinessForm />}
      </ScrollView>
    </Screen>
  );
}

// ─── Create ───────────────────────────────────────────────────────────────

function CreateBusinessForm() {
  const { user } = useAuth();
  const { center } = useLocation();
  const { invalidateOwnBusiness } = useInvalidateBusiness();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && category.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createBusiness({
        ownerId: user.id,
        name,
        category,
        description,
        address,
        contactPhone: phone,
        contactEmail: email,
        location: center,
      });
      await invalidateOwnBusiness(user.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create your listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader eyebrow="Get started" title="Create your listing" />
      <Card style={styles.formCard}>
        <LabeledInput label="Business name" value={name} onChangeText={setName} placeholder="Sunrise Barbershop" />
        <LabeledInput label="Category" value={category} onChangeText={setCategory} placeholder="Barber, Clinic, Dessert shop…" />
        <LabeledInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What makes your business worth a visit?"
          multiline
        />
        <LabeledInput label="Address" value={address} onChangeText={setAddress} placeholder="Street, area, city" />
        <LabeledInput label="Contact phone" value={phone} onChangeText={setPhone} placeholder="+1 555 0100" keyboardType="phone-pad" />
        <LabeledInput label="Contact email" value={email} onChangeText={setEmail} placeholder="owner@example.com" keyboardType="email-address" />

        <View style={styles.locationNote}>
          <Ionicons name="location-outline" size={15} color={palette.inkMuted} />
          <Text variant="caption" tone="muted" style={styles.locationNoteText}>
            Uses your current location as the listing's map location — {center.lat.toFixed(4)}, {center.lng.toFixed(4)}.
          </Text>
        </View>

        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}

        <Button label="Create listing" onPress={submit} disabled={!canSubmit} loading={submitting} fullWidth />
      </Card>
    </View>
  );
}

// ─── Edit ───────────────────────────────────────────────────────────────────

function BusinessEditor({ business }: { business: Business }) {
  const { invalidateOwnBusiness } = useInvalidateBusiness();

  const [name, setName] = useState(business.name);
  const [category, setCategory] = useState(business.category);
  const [description, setDescription] = useState(business.description ?? '');
  const [address, setAddress] = useState(business.address ?? '');
  const [phone, setPhone] = useState(business.contact_phone ?? '');
  const [email, setEmail] = useState(business.contact_email ?? '');
  const [offersText, setOffersText] = useState((business.offers ?? []).join(', '));
  const [hours, setHours] = useState<OperatingHours>(business.operating_hours);

  const [savingAbout, setSavingAbout] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync local edit state when the underlying row changes (e.g. after a save).
  useEffect(() => {
    setName(business.name);
    setCategory(business.category);
    setDescription(business.description ?? '');
    setAddress(business.address ?? '');
    setPhone(business.contact_phone ?? '');
    setEmail(business.contact_email ?? '');
    setOffersText((business.offers ?? []).join(', '));
    setHours(business.operating_hours);
  }, [business]);

  const saveAbout = async () => {
    setSavingAbout(true);
    setError(null);
    try {
      await updateBusiness(business.id, {
        name: name.trim(),
        category: category.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        contact_phone: phone.trim() || null,
        contact_email: email.trim() || null,
        offers: offersText
          .split(',')
          .map((offer) => offer.trim())
          .filter(Boolean),
      });
      await invalidateOwnBusiness(business.owner_id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save changes.');
    } finally {
      setSavingAbout(false);
    }
  };

  const saveHours = async () => {
    setSavingHours(true);
    setError(null);
    try {
      await updateBusiness(business.id, { operating_hours: hours });
      await invalidateOwnBusiness(business.owner_id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save hours.');
    } finally {
      setSavingHours(false);
    }
  };

  const uploadDocument = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to attach a document.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    setUploading(true);
    setError(null);
    try {
      const bytes = base64ToBytes(result.assets[0].base64);
      const path = await uploadVerificationDocument(business.id, bytes, 'jpg');
      await addVerificationDocument(business, path);
      await invalidateOwnBusiness(business.owner_id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.editorGap}>
      {business.verification_status === 'pending' ? (
        <View style={styles.section}>
          <Card style={styles.noticeCard}>
            <Ionicons name="hourglass-outline" size={18} color={palette.warning} />
            <Text variant="body" tone="muted" style={styles.noticeText}>
              Your listing is under review and won't appear to customers yet. Add verification
              documents below to help reviewers approve it faster.
            </Text>
          </Card>
        </View>
      ) : null}

      {business.verification_status === 'rejected' ? (
        <View style={styles.section}>
          <Card style={styles.noticeCardDanger}>
            <Ionicons name="alert-circle-outline" size={18} color={palette.danger} />
            <Text variant="body" tone="danger" style={styles.noticeText}>
              Your listing was rejected. Review your details and documents, then contact support if
              you believe this was in error.
            </Text>
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader eyebrow="Listing" title="About your business" />
        <Card style={styles.formCard}>
          <LabeledInput label="Business name" value={name} onChangeText={setName} />
          <LabeledInput label="Category" value={category} onChangeText={setCategory} />
          <LabeledInput label="Description" value={description} onChangeText={setDescription} multiline />
          <LabeledInput label="Address" value={address} onChangeText={setAddress} />
          <LabeledInput label="Contact phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <LabeledInput label="Contact email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <LabeledInput label="Offers (comma-separated)" value={offersText} onChangeText={setOffersText} placeholder="20% off first visit, Free consultation" />
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
          <Button label="Save changes" onPress={saveAbout} loading={savingAbout} fullWidth />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Schedule" title="Operating hours" />
        <Card style={styles.formCard}>
          <OperatingHoursEditor value={hours} onChange={setHours} disabled={savingHours} />
          <Button label="Save hours" onPress={saveHours} loading={savingHours} variant="secondary" fullWidth />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Compliance" title="Verification documents" />
        <Card style={styles.formCard}>
          {(business.verification_documents ?? []).length === 0 ? (
            <Text variant="body" tone="muted">
              No documents uploaded yet.
            </Text>
          ) : (
            (business.verification_documents ?? []).map((path) => (
              <View key={path} style={styles.docRow}>
                <Ionicons name="document-text-outline" size={16} color={palette.inkMuted} />
                <Text variant="label" tone="muted" numberOfLines={1} style={styles.docPath}>
                  {path}
                </Text>
              </View>
            ))
          )}
          <Button
            label="Upload document"
            icon="cloud-upload-outline"
            variant="secondary"
            onPress={uploadDocument}
            loading={uploading}
            fullWidth
          />
        </Card>
      </View>
    </View>
  );
}

function LabeledInput({
  label,
  multiline = false,
  style,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  style?: object;
}) {
  return (
    <View style={styles.field}>
      <Text variant="label" weight="semibold" tone="secondary">
        {label}
      </Text>
      <TextInput
        {...rest}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        placeholderTextColor={palette.inkFaint}
        style={[styles.input, multiline && styles.inputMultiline, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: screenGutter, paddingTop: spacing.xl, paddingBottom: spacing.huge, gap: spacing.xxxl },
  header: { gap: spacing.md },
  editorGap: { gap: spacing.xxxl },
  section: { gap: spacing.lg },
  formCard: { gap: spacing.lg },
  field: { gap: spacing.sm },
  input: {
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: palette.canvas,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.border,
    color: palette.ink,
    fontFamily: fontFamily.body,
    fontSize: typeScale.body.fontSize,
  },
  inputMultiline: { height: 88, paddingTop: spacing.md, textAlignVertical: 'top' },
  locationNote: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  locationNoteText: { flex: 1 },
  noticeCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: palette.warningSoft },
  noticeCardDanger: { flexDirection: 'row', gap: spacing.md, backgroundColor: palette.dangerSoft },
  noticeText: { flex: 1 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  docPath: { flex: 1 },
});

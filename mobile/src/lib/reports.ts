import { supabase } from './supabase';
import { toGeoJsonPoint, type LatLng } from './geo';

const BUCKET = 'reports';
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decodes base64 to bytes without relying on a global `atob`, which is not
 * guaranteed across Hermes versions. supabase-js uploads an ArrayBuffer
 * reliably on React Native, whereas passing a Blob or a file URI does not.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const byteLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk =
      (B64_ALPHABET.indexOf(clean[i]) << 18) |
      (B64_ALPHABET.indexOf(clean[i + 1]) << 12) |
      ((B64_ALPHABET.indexOf(clean[i + 2]) & 0x3f) << 6) |
      (B64_ALPHABET.indexOf(clean[i + 3]) & 0x3f);

    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = chunk & 0xff;
  }

  return bytes;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Uploads a report photo to the public `reports` bucket, retrying transient
 * failures. Storage RLS requires an authenticated user
 * (supabase/migrations/003_storage_bucket.sql).
 */
export async function uploadReportPhoto(
  base64: string,
  userId: string,
  attempts = 3,
): Promise<string> {
  const path = `public/${userId}-${Date.now()}.jpg`;
  const bytes = base64ToBytes(base64);

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

    if (!error) {
      return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    lastError = error;
    if (attempt < attempts) await wait(attempt * 800);
  }

  throw lastError instanceof Error ? lastError : new Error('Photo upload failed');
}

export interface SubmitReportInput {
  userId: string;
  photoBase64: string;
  category: string;
  description: string;
  location: LatLng;
}

/**
 * Uploads the photo, then inserts the row. The insert policy requires
 * `user_id = auth.uid()`, so the caller's own id must be passed through.
 */
export async function submitReport(input: SubmitReportInput): Promise<void> {
  const photoUrl = await uploadReportPhoto(input.photoBase64, input.userId);

  const { error } = await supabase.from('problem_reports').insert({
    user_id: input.userId,
    photo_url: photoUrl,
    category: input.category,
    location: toGeoJsonPoint(input.location),
    description: input.description.trim() || null,
    status: 'reported',
  });

  if (error) throw error;
}

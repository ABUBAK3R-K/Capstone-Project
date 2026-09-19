import { supabase } from './supabase';
import { parsePostgisPoint, toGeoJsonPoint, type LatLng } from './geo';
import type { Business, BusinessService, OperatingHours, ServiceType } from '@/types/business';

const BUSINESS_COLUMNS =
  'id, owner_id, name, category, description, location, address, operating_hours, contact_phone, contact_email, offers, verification_status, verification_documents, created_at';

function toBusiness(row: Record<string, unknown>): Business {
  const point = parsePostgisPoint(row.location);
  return {
    id: row.id as string,
    owner_id: row.owner_id as string,
    name: row.name as string,
    category: row.category as string,
    description: (row.description as string | null) ?? null,
    lat: point?.lat ?? 0,
    lng: point?.lng ?? 0,
    address: (row.address as string | null) ?? null,
    operating_hours: (row.operating_hours as OperatingHours | null) ?? {},
    contact_phone: (row.contact_phone as string | null) ?? null,
    contact_email: (row.contact_email as string | null) ?? null,
    offers: (row.offers as string[] | null) ?? null,
    verification_status: (row.verification_status as Business['verification_status']) ?? 'pending',
    verification_documents: (row.verification_documents as string[] | null) ?? null,
    created_at: row.created_at as string,
  };
}

/**
 * The signed-in business owner's own listing. RLS lets an owner read their
 * own row regardless of verification_status (supabase/migrations/008).
 */
export async function fetchOwnBusiness(ownerId: string): Promise<Business | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select(BUSINESS_COLUMNS)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) throw error;
  return data ? toBusiness(data) : null;
}

/**
 * A business by id, for the customer-facing place detail screen. RLS only
 * returns this for approved businesses (or the owner), so a null result
 * here means "not a business" or "not yet approved" — either way, render
 * the place as an ordinary place.
 */
export async function fetchBusinessById(id: string): Promise<Business | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select(BUSINESS_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? toBusiness(data) : null;
}

export interface CreateBusinessInput {
  ownerId: string;
  name: string;
  category: string;
  description: string;
  location: LatLng;
  address: string;
  contactPhone: string;
  contactEmail: string;
}

export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  const { data, error } = await supabase
    .from('businesses')
    .insert({
      owner_id: input.ownerId,
      name: input.name.trim(),
      category: input.category,
      description: input.description.trim() || null,
      location: toGeoJsonPoint(input.location),
      address: input.address.trim() || null,
      contact_phone: input.contactPhone.trim() || null,
      contact_email: input.contactEmail.trim() || null,
    })
    .select(BUSINESS_COLUMNS)
    .single();

  if (error) throw error;
  return toBusiness(data);
}

export type BusinessEditableFields = Partial<{
  name: string;
  category: string;
  description: string | null;
  location: LatLng;
  address: string | null;
  operating_hours: OperatingHours;
  contact_phone: string | null;
  contact_email: string | null;
  offers: string[] | null;
}>;

/** verification_status is intentionally not accepted here — see migration 008. */
export async function updateBusiness(id: string, patch: BusinessEditableFields): Promise<void> {
  const { location, ...rest } = patch;
  const payload: Record<string, unknown> = { ...rest };
  if (location) payload.location = toGeoJsonPoint(location);

  const { error } = await supabase.from('businesses').update(payload).eq('id', id);
  if (error) throw error;
}

/**
 * Appends a storage path to verification_documents. Uploading the file
 * itself (to the private `business-verification` bucket) happens first, in
 * the caller — this only records the resulting path.
 */
export async function addVerificationDocument(business: Business, path: string): Promise<void> {
  const documents = [...(business.verification_documents ?? []), path];
  const { error } = await supabase
    .from('businesses')
    .update({ verification_documents: documents })
    .eq('id', business.id);
  if (error) throw error;
}

export async function uploadVerificationDocument(
  businessId: string,
  bytes: Uint8Array,
  extension: string,
): Promise<string> {
  const path = `${businessId}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from('business-verification').upload(path, bytes, {
    upsert: false,
  });
  if (error) throw error;
  return path;
}

// ─── Services ───────────────────────────────────────────────────────────────

function toService(row: Record<string, unknown>): BusinessService {
  return {
    id: row.id as string,
    business_id: row.business_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    price: row.price == null ? null : Number(row.price),
    service_type: row.service_type as ServiceType,
    duration_minutes: (row.duration_minutes as number | null) ?? null,
    is_active: Boolean(row.is_active),
    created_at: row.created_at as string,
  };
}

/** All services for a business, including inactive ones — for the owner's own management screen. */
export async function fetchAllBusinessServices(businessId: string): Promise<BusinessService[]> {
  const { data, error } = await supabase
    .from('business_services')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toService);
}

/** Active services only — for the customer-facing booking/order flow. */
export async function fetchActiveBusinessServices(businessId: string): Promise<BusinessService[]> {
  const { data, error } = await supabase
    .from('business_services')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toService);
}

export interface UpsertServiceInput {
  businessId: string;
  name: string;
  description: string;
  price: string;
  serviceType: ServiceType;
  durationMinutes: string;
}

export async function createBusinessService(input: UpsertServiceInput): Promise<BusinessService> {
  const { data, error } = await supabase
    .from('business_services')
    .insert({
      business_id: input.businessId,
      name: input.name.trim(),
      description: input.description.trim() || null,
      price: input.price.trim() ? Number(input.price) : null,
      service_type: input.serviceType,
      duration_minutes:
        input.serviceType === 'appointment' && input.durationMinutes.trim()
          ? Number(input.durationMinutes)
          : null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return toService(data);
}

export async function setServiceActive(serviceId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('business_services')
    .update({ is_active: isActive })
    .eq('id', serviceId);
  if (error) throw error;
}

export async function deleteBusinessService(serviceId: string): Promise<void> {
  const { error } = await supabase.from('business_services').delete().eq('id', serviceId);
  if (error) throw error;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export interface DayHours {
  open: string;
  close: string;
}

/** businesses.operating_hours jsonb shape — see migration 008. */
export type OperatingHours = Partial<Record<DayKey, DayHours | null>>;

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  description: string | null;
  lat: number;
  lng: number;
  address: string | null;
  operating_hours: OperatingHours;
  contact_phone: string | null;
  contact_email: string | null;
  offers: string[] | null;
  verification_status: VerificationStatus;
  verification_documents: string[] | null;
  created_at: string;
}

export type ServiceType = 'appointment' | 'order';

export interface BusinessService {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number | null;
  service_type: ServiceType;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'completed';

export interface Booking {
  id: string;
  business_id: string;
  customer_id: string;
  service_id: string;
  service_type: ServiceType;
  requested_time: string | null;
  quantity: number;
  order_group_id: string | null;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
  responded_at: string | null;
  /** Joined for display — the service/business names as they were, not snapshotted. */
  service_name?: string;
  business_name?: string;
}

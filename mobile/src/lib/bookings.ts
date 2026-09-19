import { supabase } from './supabase';
import type { Booking, BookingStatus, BusinessService } from '@/types/business';

/**
 * Groups multiple order-type booking rows submitted together. Not a
 * cryptographic identifier — just needs to be unique enough to group rows,
 * so a small local generator avoids adding a dependency for this alone
 * (same reasoning as the manual base64 decoder in lib/reports.ts).
 */
function generateGroupId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toBooking(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    business_id: row.business_id as string,
    customer_id: row.customer_id as string,
    service_id: row.service_id as string,
    service_type: row.service_type as Booking['service_type'],
    requested_time: (row.requested_time as string | null) ?? null,
    quantity: Number(row.quantity ?? 1),
    order_group_id: (row.order_group_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: row.status as BookingStatus,
    created_at: row.created_at as string,
    responded_at: (row.responded_at as string | null) ?? null,
    service_name: (row.business_services as { name?: string } | null)?.name,
    business_name: (row.businesses as { name?: string } | null)?.name,
  };
}

/** A customer's own bookings/orders, newest first. */
export async function fetchCustomerBookings(customerId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, business_services(name), businesses(name)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toBooking);
}

/**
 * Bookings/orders placed against a business the caller owns. RLS
 * (supabase/migrations/008) does not let a business owner read the
 * `profiles` row of the customer who booked — profiles are only
 * self-readable — so the customer is only identifiable by id here, not name.
 */
export async function fetchBusinessBookings(businessId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, business_services(name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toBooking);
}

export interface SubmitAppointmentInput {
  businessId: string;
  customerId: string;
  service: BusinessService;
  requestedTime: string;
  notes: string;
}

export async function submitAppointment(input: SubmitAppointmentInput): Promise<void> {
  const { error } = await supabase.from('bookings').insert({
    business_id: input.businessId,
    customer_id: input.customerId,
    service_id: input.service.id,
    service_type: 'appointment',
    requested_time: input.requestedTime,
    quantity: 1,
    notes: input.notes.trim() || null,
  });
  if (error) throw error;
}

export interface OrderLine {
  service: BusinessService;
  quantity: number;
}

export interface SubmitOrderInput {
  businessId: string;
  customerId: string;
  lines: OrderLine[];
  notes: string;
}

/** Submits one row per basket line, sharing an order_group_id so they read as one order. */
export async function submitOrder(input: SubmitOrderInput): Promise<void> {
  const orderGroupId = generateGroupId();

  const { error } = await supabase.from('bookings').insert(
    input.lines.map((line) => ({
      business_id: input.businessId,
      customer_id: input.customerId,
      service_id: line.service.id,
      service_type: 'order' as const,
      quantity: line.quantity,
      order_group_id: orderGroupId,
      notes: input.notes.trim() || null,
    })),
  );
  if (error) throw error;
}

/** Business-owner action: accept/decline a pending booking, or mark a confirmed one completed. */
export async function updateBookingStatus(bookingId: string, status: BookingStatus): Promise<void> {
  const respondedAt = status === 'confirmed' || status === 'declined' ? new Date().toISOString() : undefined;

  const { error } = await supabase
    .from('bookings')
    .update({ status, ...(respondedAt ? { responded_at: respondedAt } : {}) })
    .eq('id', bookingId);
  if (error) throw error;
}

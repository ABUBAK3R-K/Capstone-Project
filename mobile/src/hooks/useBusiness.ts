import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchActiveBusinessServices,
  fetchAllBusinessServices,
  fetchBusinessById,
  fetchOwnBusiness,
} from '@/lib/businesses';
import { fetchBusinessBookings, fetchCustomerBookings } from '@/lib/bookings';

export function useOwnBusiness(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['own-business', ownerId],
    queryFn: () => fetchOwnBusiness(ownerId!),
    enabled: Boolean(ownerId),
    staleTime: 30 * 1000,
  });
}

/** Null result means "not a business, or not yet approved" — the caller renders a plain place. */
export function useBusinessDetail(placeId: string | undefined) {
  return useQuery({
    queryKey: ['business-detail', placeId],
    queryFn: () => fetchBusinessById(placeId!),
    enabled: Boolean(placeId),
    staleTime: 60 * 1000,
    retry: 0,
  });
}

export function useBusinessServices(businessId: string | undefined) {
  return useQuery({
    queryKey: ['business-services', businessId],
    queryFn: () => fetchAllBusinessServices(businessId!),
    enabled: Boolean(businessId),
    staleTime: 30 * 1000,
  });
}

/** Active-only services, for the customer-facing booking/order flow. */
export function useActiveBusinessServices(businessId: string | undefined) {
  return useQuery({
    queryKey: ['active-business-services', businessId],
    queryFn: () => fetchActiveBusinessServices(businessId!),
    enabled: Boolean(businessId),
    staleTime: 30 * 1000,
  });
}

/** Polls — this app has no push notifications, so "did I get a response?" is answered by refetching. */
export function useCustomerBookings(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-bookings', customerId],
    queryFn: () => fetchCustomerBookings(customerId!),
    enabled: Boolean(customerId),
    staleTime: 15 * 1000,
    refetchInterval: 20 * 1000,
  });
}

export function useBusinessBookings(businessId: string | undefined) {
  return useQuery({
    queryKey: ['business-bookings', businessId],
    queryFn: () => fetchBusinessBookings(businessId!),
    enabled: Boolean(businessId),
    staleTime: 15 * 1000,
    refetchInterval: 20 * 1000,
  });
}

export function useInvalidateBusiness() {
  const queryClient = useQueryClient();
  return {
    invalidateOwnBusiness: (ownerId: string) =>
      queryClient.invalidateQueries({ queryKey: ['own-business', ownerId] }),
    invalidateServices: (businessId: string) =>
      queryClient.invalidateQueries({ queryKey: ['business-services', businessId] }),
    invalidateCustomerBookings: (customerId: string) =>
      queryClient.invalidateQueries({ queryKey: ['customer-bookings', customerId] }),
    invalidateBusinessBookings: (businessId: string) =>
      queryClient.invalidateQueries({ queryKey: ['business-bookings', businessId] }),
  };
}

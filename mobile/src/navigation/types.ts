import type { NavigatorScreenParams } from '@react-navigation/native';

import type { Place } from '@/types/place';
import type { Business, BusinessService } from '@/types/business';

export type TabParamList = {
  Home: undefined;
  Map: { focusPlaceId?: string; category?: string } | undefined;
  Report: { prefillCategory?: string } | undefined;
  Profile: undefined;
};

export type BusinessTabParamList = {
  BusinessDashboard: undefined;
  BusinessServices: undefined;
  BusinessBookings: undefined;
  BusinessProfile: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Auth: undefined;
  BusinessAuth: undefined;
  Tabs: NavigatorScreenParams<TabParamList>;
  BusinessTabs: NavigatorScreenParams<BusinessTabParamList>;
  PlaceDetail: { place: Place };
  Search: undefined;
  /** `name` pre-fills the form, e.g. from a search that found nothing. */
  AddPlace: { name?: string } | undefined;
  BookingFlow: { business: Business; service: BusinessService };
  OrderFlow: { business: Business; services: BusinessService[] };
  MyBookings: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

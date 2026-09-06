import type { NavigatorScreenParams } from '@react-navigation/native';

import type { Place } from '@/types/place';

export type TabParamList = {
  Home: undefined;
  Map: { focusPlaceId?: string; category?: string } | undefined;
  Report: { prefillCategory?: string } | undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Tabs: NavigatorScreenParams<TabParamList>;
  PlaceDetail: { place: Place };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

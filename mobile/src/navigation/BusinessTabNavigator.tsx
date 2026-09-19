import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { BusinessDashboardScreen } from '@/features/business/BusinessDashboardScreen';
import { BusinessServicesScreen } from '@/features/business/BusinessServicesScreen';
import { BusinessBookingsScreen } from '@/features/business/BusinessBookingsScreen';
import { BusinessProfileScreen } from '@/features/business/BusinessProfileScreen';
import { palette, spacing } from '@/design/tokens';
import type { BusinessTabParamList } from './types';

const Tab = createBottomTabNavigator<BusinessTabParamList>();

const ICONS: Record<keyof BusinessTabParamList, { active: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap }> = {
  BusinessDashboard: { active: 'grid', idle: 'grid-outline' },
  BusinessServices: { active: 'pricetags', idle: 'pricetags-outline' },
  BusinessBookings: { active: 'calendar', idle: 'calendar-outline' },
  BusinessProfile: { active: 'person-circle', idle: 'person-circle-outline' },
};

const LABELS: Record<keyof BusinessTabParamList, string> = {
  BusinessDashboard: 'Dashboard',
  BusinessServices: 'Services',
  BusinessBookings: 'Bookings',
  BusinessProfile: 'Profile',
};

/**
 * The business-account counterpart of TabNavigator. Kept as a flatter,
 * icon+label bar (no lift animation) rather than mirroring the customer
 * tab bar's motion detail — this is a management surface, not the
 * showcase screen of the app.
 */
export function BusinessTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.inkFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabel: LABELS[route.name],
        // eslint-disable-next-line react/no-unstable-nested-components
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={focused ? ICONS[route.name].active : ICONS[route.name].idle} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="BusinessDashboard" component={BusinessDashboardScreen} />
      <Tab.Screen name="BusinessServices" component={BusinessServicesScreen} />
      <Tab.Screen name="BusinessBookings" component={BusinessBookingsScreen} />
      <Tab.Screen name="BusinessProfile" component={BusinessProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: palette.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.xs,
  },
});

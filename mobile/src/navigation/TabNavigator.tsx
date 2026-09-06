import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';

import { HomeScreen } from '@/features/home/HomeScreen';
import { MapScreen } from '@/features/map/MapScreen';
import { ReportScreen } from '@/features/report/ReportScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { Text } from '@/design/typography';
import { motion, palette, radius, spacing } from '@/design/tokens';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, { active: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'compass', idle: 'compass-outline' },
  Map: { active: 'map', idle: 'map-outline' },
  Report: { active: 'camera', idle: 'camera-outline' },
  Profile: { active: 'person-circle', idle: 'person-circle-outline' },
};

/**
 * Icon lifts and the label fades in on selection. Subtle, but it means the tab
 * bar responds to touch instead of just recolouring.
 */
function TabIcon({ name, focused }: { name: keyof TabParamList; focused: boolean }) {
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, motion.spring);
  }, [focused, lift]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * lift.value }, { scale: 1 + 0.06 * lift.value }],
  }));

  const pipStyle = useAnimatedStyle(() => ({
    opacity: lift.value,
    transform: [{ scale: 0.4 + 0.6 * lift.value }],
  }));

  return (
    <View style={styles.tabItem}>
      <Animated.View style={iconStyle}>
        <Ionicons
          name={focused ? ICONS[name].active : ICONS[name].idle}
          size={23}
          color={focused ? palette.primary : palette.inkFaint}
        />
      </Animated.View>
      <Text variant="caption" weight="semibold" tone={focused ? 'primary' : 'faint'} style={styles.tabLabel}>
        {name}
      </Text>
      <Animated.View style={[styles.pip, pipStyle]} />
    </View>
  );
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        // eslint-disable-next-line react/no-unstable-nested-components
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Report" component={ReportScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: palette.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    height: Platform.OS === 'ios' ? 84 : 68,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.sm,
  },
  tabBarItem: { paddingTop: spacing.xxs },
  tabItem: { alignItems: 'center', gap: spacing.xxs, width: 72 },
  tabLabel: { letterSpacing: 0.2 },
  pip: {
    position: 'absolute',
    bottom: -6,
    width: 16,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
  },
});

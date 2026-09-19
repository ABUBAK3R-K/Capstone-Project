import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@/providers/AuthProvider';
import { WelcomeScreen } from '@/features/auth/WelcomeScreen';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { BusinessAuthScreen } from '@/features/auth/BusinessAuthScreen';
import { PlaceDetailScreen } from '@/features/place/PlaceDetailScreen';
import { BookingFlowScreen } from '@/features/booking/BookingFlowScreen';
import { OrderFlowScreen } from '@/features/booking/OrderFlowScreen';
import { MyBookingsScreen } from '@/features/profile/MyBookingsScreen';
import { fontFamily, palette } from '@/design/tokens';
import { TabNavigator } from './TabNavigator';
import { BusinessTabNavigator } from './BusinessTabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: palette.primary,
    background: palette.canvas,
    card: palette.surface,
    text: palette.ink,
    border: palette.border,
    notification: palette.primary,
  },
  fonts: {
    regular: { fontFamily: fontFamily.body, fontWeight: '400' },
    medium: { fontFamily: fontFamily.bodyMedium, fontWeight: '500' },
    bold: { fontFamily: fontFamily.displayMedium, fontWeight: '600' },
    heavy: { fontFamily: fontFamily.display, fontWeight: '700' },
  },
};

export function RootNavigator() {
  const { user, initializing, loadingProfile, isGuest, accountType } = useAuth();

  // Under DEV_SKIP_AUTH there is no session and therefore no profile row to
  // wait for — only block on loadingProfile for a real signed-in user.
  if (initializing || (Boolean(user) && loadingProfile)) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  const isAuthenticated = Boolean(user) || isGuest;
  const isBusiness = isAuthenticated && accountType === 'business';

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // Slide-from-right on both platforms keeps push/pop feeling identical.
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: palette.canvas },
        }}
      >
        {isBusiness ? (
          <Stack.Screen name="BusinessTabs" component={BusinessTabNavigator} />
        ) : isAuthenticated ? (
          <>
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen
              name="PlaceDetail"
              component={PlaceDetailScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="BookingFlow" component={BookingFlowScreen} />
            <Stack.Screen name="OrderFlow" component={OrderFlowScreen} />
            <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="BusinessAuth" component={BusinessAuthScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
});

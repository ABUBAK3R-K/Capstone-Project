import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@/providers/AuthProvider';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { PlaceDetailScreen } from '@/features/place/PlaceDetailScreen';
import { fontFamily, palette } from '@/design/tokens';
import { TabNavigator } from './TabNavigator';
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
  const { user, initializing, isGuest } = useAuth();

  if (initializing) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  const isAuthenticated = Boolean(user) || isGuest;

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
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen
              name="PlaceDetail"
              component={PlaceDetailScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'fade' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
});

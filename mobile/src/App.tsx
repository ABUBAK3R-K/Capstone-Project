import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import {
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';

import { AuthProvider } from '@/providers/AuthProvider';
import { LocationProvider } from '@/providers/LocationProvider';
import { RootNavigator } from '@/navigation/RootNavigator';
import { palette } from '@/design/tokens';

void SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(palette.canvas);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      gcTime: 10 * 60 * 1000,
    },
  },
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    Fraunces_700Bold,
  });

  const onLayout = useCallback(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    // Never trap the user behind the splash if a font fails to download.
    if (fontError) console.warn('Font load failed, falling back to system faces', fontError);
  }, [fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayout}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LocationProvider>
              <StatusBar style="dark" />
              <View style={styles.root}>
                <RootNavigator />
              </View>
            </LocationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
});

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { loadAuth } from '../lib/auth';
import { loadLibrary } from '../lib/library';
import { useTheme } from '../lib/theme';

export default function RootLayout() {
  const t = useTheme();

  useEffect(() => {
    loadAuth();
    loadLibrary();
  }, []);

  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.surface },
          headerTintColor: t.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Library' }} />
        <Stack.Screen name="account" options={{ title: 'GitHub account' }} />
      </Stack>
    </>
  );
}

import { Stack } from 'expo-router';

import { color, text } from '@/theme';

export default function ProductsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.ground },
        headerTitleStyle: { ...text.heading, color: color.ink },
        headerShadowVisible: false,
        headerTintColor: color.primary700,
        contentStyle: { backgroundColor: color.ground },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Products' }} />
      <Stack.Screen name="new" options={{ title: 'Add product', presentation: 'modal' }} />
    </Stack>
  );
}

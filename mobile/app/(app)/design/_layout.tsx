import { Stack } from 'expo-router';

import { color, text } from '@/theme';

/**
 * Design is a stack, not a tab.
 *
 * It is reached from Settings and goes three levels deep — appearance, a page's
 * sections, one section's settings — which a tab bar cannot express. The four
 * tabs stay what a merchant does every day; redesigning the shop is something
 * they do on a quiet afternoon.
 */
export default function DesignLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.ground },
        headerTitleStyle: { ...text.heading, color: color.ink },
        headerTintColor: color.primary700,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: color.ground },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Design' }} />
      <Stack.Screen name="[page]" options={{ title: 'Sections' }} />
      <Stack.Screen name="section" options={{ title: 'Section' }} />
    </Stack>
  );
}

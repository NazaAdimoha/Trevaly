import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { ConfigProvider } from '@/api/config';
import { color, font, text } from '@/theme';

/**
 * Four tabs, deliberately.
 *
 * The app covers what a merchant does away from a desk: check orders, mark them
 * shipped, add a product they just photographed, see what is running out.
 * Coupons, delivery zones, CSV import and settings are desk tasks — they live on
 * the web and Settings deep-links out to them. Every screen added here is a
 * screen maintained twice, forever.
 *
 * Icons AND labels, never icons alone. The label is what makes a tab
 * unambiguous in a market where this may be someone's first app, so the icon
 * earns its place by making the bar scannable at a glance, not by replacing the
 * word. `@expo/vector-icons` ships with the Expo SDK, so this costs no new
 * runtime dependency and no SVG renderer.
 *
 * Outline when inactive, solid when active: the fill is a second, redundant
 * signal alongside the tint, so the current tab is still obvious to a merchant
 * who cannot easily distinguish the active colour from the inactive one.
 */

/** Inactive (outline) and active (solid) glyph for each tab. */
const TAB_ICON = {
  index: ['home-outline', 'home'],
  orders: ['receipt-outline', 'receipt'],
  products: ['pricetags-outline', 'pricetags'],
  settings: ['settings-outline', 'settings'],
} as const satisfies Record<
  string,
  readonly [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]
>;

function tabIcon(name: keyof typeof TAB_ICON) {
  const [outline, solid] = TAB_ICON[name];
  return function TabIcon({
    focused,
    color: tint,
    size,
  }: {
    focused: boolean;
    color: string;
    size: number;
  }) {
    return (
      <Ionicons name={focused ? solid : outline} size={size} color={tint} />
    );
  };
}

export default function AppLayout() {
  return (
    <ConfigProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: color.ground },
          headerTitleStyle: { ...text.heading, color: color.ink },
          headerShadowVisible: false,
          tabBarActiveTintColor: color.primary700,
          tabBarInactiveTintColor: color.muted,
          tabBarStyle: {
            backgroundColor: color.surface,
            borderTopColor: color.line,
          },
          tabBarLabelStyle: { fontSize: 11, fontFamily: font.medium },
          sceneStyle: { backgroundColor: color.ground },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: tabIcon('index') }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Orders',
            headerShown: false,
            tabBarIcon: tabIcon('orders'),
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: 'Products',
            headerShown: false,
            tabBarIcon: tabIcon('products'),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: 'Settings', tabBarIcon: tabIcon('settings') }}
        />

        {/* Reached FROM Settings, not from the tab bar.
            expo-router turns every file in a Tabs directory into a tab unless
            told otherwise, so without `href: null` these three appear as a
            seven-tab bar — which is both unusable at phone width and wrong:
            they are settings sub-pages, not top-level destinations. They stay
            fully navigable via router.push. */}
        <Tabs.Screen name="analytics" options={{ href: null, title: 'Analytics' }} />
        <Tabs.Screen
          name="notifications"
          options={{ href: null, title: 'Notifications' }}
        />
        <Tabs.Screen
          name="store-settings"
          options={{ href: null, title: 'Store settings' }}
        />
      </Tabs>
    </ConfigProvider>
  );
}

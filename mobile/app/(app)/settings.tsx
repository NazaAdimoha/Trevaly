import { useAuth, useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appConfigResponseSchema, myStoresResponseSchema } from '@core/api/contracts';

import { clearCache } from '@/api/cache';
import { APP_VERSION } from '@/api/client';
import { useQuery } from '@/api/hooks';
import { useActiveStore } from '@/store/active-store';
import { color, font, radius, space, text } from '@/theme';
import { Card, SettingsGroup, SettingsRow } from '@/ui';

/**
 * Settings, the store switcher, and the honest hand-off.
 *
 * The links out are the plan working as intended, not a gap: coupons, delivery
 * zones, CSV import and branding are desk tasks done once at setup, and every
 * screen added to this app is a screen maintained twice forever. Sending a
 * merchant to the web for them is cheaper than owning them here.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { slug, choose, clear } = useActiveStore();

  const stores = useQuery('/me/stores', myStoresResponseSchema);
  const config = useQuery('/app/config', appConfigResponseSchema);

  const dashboard = config.data?.webDashboardUrl ?? '';
  const openWeb = (path: string) => {
    if (!dashboard || !slug) return;
    void Linking.openURL(`${dashboard}/stores/${slug}${path}`);
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need your password to get back in.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clear();
          // Cached responses are not user-scoped, so they must not outlive the
          // session. A merchant handing the phone to staff who sign in as
          // themselves must not find the previous session's orders and revenue
          // painted on screen from cache.
          await clearCache();
          await signOut();
        },
      },
    ]);
  };

  const items = stores.data?.items ?? [];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>
          {user?.primaryEmailAddress?.emailAddress ?? '—'}
        </Text>
      </Card>

      {items.length > 1 ? (
        <Card style={styles.group}>
          <Text style={styles.label}>Your stores</Text>
          {items.map((store) => {
            const active = store.slug === slug;
            return (
              <Pressable
                key={store.id}
                onPress={() => void choose(store.slug)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.storeRow, active && styles.storeRowActive]}
              >
                <View style={styles.flex}>
                  <Text style={styles.storeName}>{store.name}</Text>
                  <Text style={styles.storeMeta}>{store.role.toLowerCase()}</Text>
                </View>
                {active ? <Text style={styles.current}>Current</Text> : null}
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {/* Grouped rows with an icon and a chevron, rather than a flat list of
          links. The reference app groups by what the merchant is trying to do,
          which is what makes a settings screen scannable once it has more than
          about five rows — and ours will. */}
      {/* Grouped the way the reference app groups: by what the merchant is
          trying to DO, not by which system owns the setting. Rows that leave
          the app carry a "Web" pill — a chevron that silently opens a browser
          is the most disorienting thing a settings screen can do. */}
      <SettingsGroup title="Store setup">
        <SettingsRow
          first
          icon="storefront-outline"
          label="Store details and logo"
          onPress={() => router.push('/(app)/store-settings')}
        />
        <SettingsRow
          icon="color-palette-outline"
          label="Storefront theme"
          web
          onPress={() => openWeb('/settings')}
        />
        <SettingsRow
          icon="globe-outline"
          label="Custom domain"
          web
          onPress={() => openWeb('/settings')}
        />
      </SettingsGroup>

      <SettingsGroup title="Reports">
        <SettingsRow
          first
          icon="bar-chart-outline"
          label="Analytics"
          onPress={() => router.push('/(app)/analytics')}
        />
        <SettingsRow
          icon="notifications-outline"
          label="Notifications"
          onPress={() => router.push('/(app)/notifications')}
        />
      </SettingsGroup>

      <SettingsGroup title="Sales and marketing">
        <SettingsRow
          first
          icon="ticket-outline"
          label="Coupon codes"
          web
          onPress={() => openWeb('/coupons')}
        />
        <SettingsRow
          icon="map-outline"
          label="Delivery areas"
          web
          onPress={() => openWeb('/delivery-zones')}
        />
      </SettingsGroup>

      <SettingsGroup title="Operations">
        <SettingsRow
          first
          icon="cloud-upload-outline"
          label="Import from a spreadsheet"
          web
          onPress={() => openWeb('/products/import')}
        />
        <SettingsRow
          icon="people-outline"
          label="Staff and roles"
          web
          onPress={() => openWeb('/settings')}
        />
      </SettingsGroup>

      {/* Where the reference app has a wallet. We hold no balance, so this
          explains the settlement path instead of inventing an account. */}
      <SettingsGroup title="Money">
        <SettingsRow
          first
          icon="shield-checkmark-outline"
          label="How you get paid"
          onPress={() =>
            Alert.alert(
              'How you get paid',
              'Paystack splits every payment at settlement and sends your share straight to the bank account in your own name. We never hold your money, so there is no balance here to withdraw.',
            )
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Account">
        <SettingsRow
          first
          icon="log-out-outline"
          label="Sign out"
          danger
          onPress={confirmSignOut}
        />
      </SettingsGroup>

      <View style={styles.versionPill}>
        <Text style={styles.versionText}>
          Version {APP_VERSION}
          {config.data ? ` · minimum ${config.data.minimumVersion}` : ''}
        </Text>
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  flex: { flex: 1 },
  group: { gap: space.sm },
  label: { ...text.label, color: color.muted, textTransform: 'uppercase' },
  value: { ...text.body, color: color.ink, marginTop: space.xs },
  hint: { ...text.small, color: color.muted },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
  },
  storeRowActive: { borderColor: color.primary, backgroundColor: color.primary50 },
  storeName: { ...text.body, color: color.ink, fontFamily: font.medium },
  storeMeta: { ...text.small, color: color.muted },
  current: { ...text.small, color: color.primary700, fontFamily: font.semibold },
  versionPill: {
    alignSelf: 'center',
    backgroundColor: color.primary50,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  versionText: { ...text.small, color: color.primary700, fontFamily: font.semibold },
});

// lib/components/web/WebSidebarShell.tsx
import { View, Text, Pressable } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';

export interface WebNavItem {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function initialsOf(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

// The content column's own max-width - wide enough to actually use laptop
// space (unlike the app-wide 640px WebFrame cap that applies pre-login),
// narrow enough that a plain mobile-first form/list still reads well
// instead of stretching to the sidebar's full remaining width.
const CONTENT_MAX_WIDTH = 1120;

/** Web-only desktop shell: a persistent left sidebar (the same sections as
 * the mobile bottom tabs, always visible) beside the actual screen content.
 * Mobile is untouched - each role's _layout.tsx only reaches for this on
 * Platform.OS === 'web', still rendering plain Tabs (bottom bar and all)
 * everywhere else. The Tabs navigator underneath keeps managing real
 * navigation state/headers/hidden routes exactly as before; this only adds
 * a parallel nav rail beside it and hides the now-redundant bottom bar. */
export function WebSidebarShell({
  items,
  roleLabel,
  children,
}: {
  items: WebNavItem[];
  roleLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const profile = useAuthStore((state) => state.profile);

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F9FAFB' }}>
      <View
        style={{
          width: 240,
          flexShrink: 0,
          backgroundColor: '#fff',
          borderRightWidth: 1,
          borderRightColor: '#E5E7EB',
          paddingVertical: 20,
          paddingHorizontal: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 28 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              backgroundColor: '#2563EB',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="construct" size={17} color="#fff" />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>Jageer Nepal</Text>
        </View>

        <View style={{ gap: 2 }}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href as any)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  backgroundColor: active ? '#EFF6FF' : 'transparent',
                }}
              >
                <Ionicons
                  name={active ? item.icon : (`${item.icon}-outline` as keyof typeof Ionicons.glyphMap)}
                  size={19}
                  color={active ? '#2563EB' : '#6B7280'}
                />
                <Text style={{ fontSize: 14, fontWeight: '600', color: active ? '#2563EB' : '#6B7280' }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flex: 1 }} />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingTop: 12,
            paddingHorizontal: 8,
            borderTopWidth: 1,
            borderTopColor: '#F3F4F6',
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              backgroundColor: '#2563EB',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{initialsOf(profile?.full_name)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
              {profile?.full_name ?? 'Account'}
            </Text>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{roleLabel}</Text>
          </View>
        </View>
      </View>

      {/* `alignItems: 'center'` here (rather than `marginHorizontal: 'auto'`
          on the capped child) made the capped child fall back to
          content-based sizing on react-native-web instead of filling the
          row's remaining space - `flex-row` children collapsed to a sliver
          just wide enough for one category icon, wrapping every subsequent
          word/icon onto its own line. Default `alignItems: 'stretch'` (by
          simply not setting it) lets the child fill available width first,
          then centers within that via auto margins. */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, marginHorizontal: 'auto' }}>
          {children}
        </View>
      </View>
    </View>
  );
}

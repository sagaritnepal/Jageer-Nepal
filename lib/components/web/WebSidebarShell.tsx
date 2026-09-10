// lib/components/web/WebSidebarShell.tsx
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, usePathname, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';

export interface WebNavItem {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  // Sub-links shown nested under this item, toggled open/closed by clicking
  // the parent row - for a section like Finance with several destinations
  // (Payment In, Purchase, Report, ...) that would otherwise mean going back
  // to a dashboard and re-picking a shortcut tile every time.
  children?: WebNavItem[];
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

// Below this viewport width, each _layout.tsx renders plain Tabs (bottom
// bar and all) instead of this shell - a phone browser hitting the website
// is still "web" (Platform.OS === 'web'), but a 240px sidebar plus content
// squeezed into a ~360-400px phone screen has nowhere near enough room and
// collapses into single characters per line. 768px comfortably fits the
// 240px sidebar plus a readable content column beside it.
export const WEB_SIDEBAR_MIN_WIDTH = 768;

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
  const searchParams = useGlobalSearchParams<Record<string, string>>();
  const profile = useAuthStore((state) => state.profile);
  // Explicit open/close per parent href, set only once the user has clicked
  // it - until then `isExpanded` below falls back to "open if a child route
  // is currently on screen" so landing straight on e.g. Payment In (a
  // refresh, a bookmark) doesn't hide the submenu it belongs to.
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});

  // Several Finance sub-links share one route with a different `type` query
  // param (Payment In/Out both go to quick-payment, Sales/Purchase/Expenses
  // all go to transactions) - usePathname() never includes the query
  // string, so a plain pathname match would light up both Payment In and
  // Payment Out together. Split the query off the href and compare it
  // against the real URL's params too, so only the one actually open highlights.
  //
  // usePathname() also strips route-group segments (e.g. "(reseller)"),
  // while every href here is written the way router.push needs it, group
  // segment included - comparing them as-is against pathname never matched
  // anything, so nothing in this sidebar (not just the new children) ever
  // actually highlighted. Strip the same segments from the href side before
  // comparing.
  function withoutGroups(path: string): string {
    return path.replace(/\/\([^/]+\)/g, '') || '/';
  }

  function isActive(href: string): boolean {
    const [hrefPathRaw, hrefQuery] = href.split('?');
    const hrefPath = withoutGroups(hrefPathRaw);
    const pathMatches = pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
    if (!pathMatches) return false;
    if (!hrefQuery) return true;
    return Array.from(new URLSearchParams(hrefQuery).entries()).every(
      ([key, value]) => (searchParams[key] ?? '') === value
    );
  }

  function isExpanded(item: WebNavItem): boolean {
    const override = openOverrides[item.href];
    if (override !== undefined) return override;
    return !!item.children?.some((child) => isActive(child.href));
  }

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
            const active = isActive(item.href);
            const expanded = !!item.children && isExpanded(item);
            // A parent with children (e.g. Finance) is "active" only by its
            // own href, not by whichever child route is open - the child
            // rows below carry their own highlight for that instead, so the
            // parent doesn't stay lit up while browsing an unrelated child.
            return (
              <View key={item.href}>
                <Pressable
                  onPress={() => {
                    if (item.children) {
                      setOpenOverrides((prev) => ({ ...prev, [item.href]: !expanded }));
                    }
                    router.push(item.href as any);
                  }}
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
                  <Text
                    style={{ flex: 1, fontSize: 14, fontWeight: '600', color: active ? '#2563EB' : '#6B7280' }}
                  >
                    {item.label}
                  </Text>
                  {!!item.children && (
                    <Ionicons
                      name={expanded ? 'chevron-down' : 'chevron-forward'}
                      size={14}
                      color={active ? '#2563EB' : '#9CA3AF'}
                    />
                  )}
                </Pressable>

                {expanded && !!item.children && (
                  <View style={{ marginTop: 2, marginBottom: 4, gap: 1 }}>
                    {item.children.map((child) => {
                      const childActive = isActive(child.href);
                      return (
                        <Pressable
                          key={child.href}
                          onPress={() => router.push(child.href as any)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            paddingVertical: 7,
                            paddingLeft: 34,
                            paddingRight: 14,
                            borderRadius: 8,
                            backgroundColor: childActive ? '#EFF6FF' : 'transparent',
                          }}
                        >
                          <Ionicons
                            name={childActive ? child.icon : (`${child.icon}-outline` as keyof typeof Ionicons.glyphMap)}
                            size={15}
                            color={childActive ? '#2563EB' : '#9CA3AF'}
                          />
                          <Text
                            numberOfLines={1}
                            style={{ fontSize: 13, fontWeight: '600', color: childActive ? '#2563EB' : '#6B7280' }}
                          >
                            {child.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
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

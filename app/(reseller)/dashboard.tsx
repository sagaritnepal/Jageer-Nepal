// app/(reseller)/dashboard.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { CategoryGrid, categoryColumnsFor } from '../../lib/components/CategoryGrid';
import { ServiceActionSheet } from '../../lib/components/ServiceActionSheet';
import { MyStorefront } from '../../lib/components/MyStorefront';
import { filterBySearch } from '../../lib/utils/search';
import { useMyEmployees } from '../../lib/hooks/useTechnicianEmployment';
import { WEB_SIDEBAR_MIN_WIDTH } from '../../lib/components/web/WebSidebarShell';
import type { Profile, ServiceCategory } from '../../types/database.types';

function initialsOf(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

/** Marketplace is one page: the services you take jobs for and the products you have switched on in
 * Inventory, shown together or one at a time. The `tab` in the link opens it on one of them (the old Shop
 * link comes in as products). */
type Section = 'all' | 'services' | 'products';
const VIEWS: { key: Section; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'services', label: 'Services' },
  { key: 'products', label: 'Products' },
];

export default function ResellerDashboard() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [search, setSearch] = useState('');
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [view, setView] = useState<Section>(tabParam === 'products' ? 'products' : tabParam === 'services' ? 'services' : 'all');
  useEffect(() => {
    if (tabParam === 'all' || tabParam === 'services' || tabParam === 'products') setView(tabParam);
  }, [tabParam]);
  const [pickerCategory, setPickerCategory] = useState<ServiceCategory | null>(null);
  // Width of the wide layout's main column, so the category grid can add
  // columns as the page gets wider (6 to 10, see categoryColumnsFor).
  const [mainColumnWidth, setMainColumnWidth] = useState(0);
  const categoryColumns = categoryColumnsFor(mainColumnWidth);

  // A phone browser hitting the website is still Platform.OS === 'web', so
  // that alone can't pick the desktop layout below - its fixed-width search
  // box and 8-column category grid only make sense once there's actually
  // room for them. Same breakpoint as the sidebar shell and the requests
  // pipeline screen.
  const { width: screenWidth } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && screenWidth >= WEB_SIDEBAR_MIN_WIDTH;

  const { data: categories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories ?? [];
    return (categories ?? []).filter((c) => c.label.toLowerCase().includes(q));
  }, [categories, search]);

  // The products too, for the counts on the switch (the Products section reads the same list): the ones
  // switched on in Inventory.
  const { data: myProducts } = useSupabaseQuery('products', {
    filters: { seller_id: userId ?? '', seller_role: 'reseller' },
    enabled: !!userId,
  });
  const productCount = useMemo(
    () => filterBySearch((myProducts ?? []).filter((p) => p.is_listed !== false), search).length,
    [myProducts, search]
  );

  const { data: technicians } = useSupabaseQuery('profiles', {
    filters: { role: 'technician' },
  });

  const { data: myRequests } = useSupabaseQuery('service_requests', {
    filters: userId ? { reseller_id: userId } : {},
    enabled: !!userId,
  });

  // People already on the team show under My team, so they don't also
  // appear here as outsource technicians.
  const { data: teamEmployees } = useMyEmployees(userId);
  const teamIds = useMemo(() => new Set(teamEmployees.map((e) => e.profile.id)), [teamEmployees]);

  const recentlyHiredTechnicians = useMemo(() => {
    const statsByTech = new Map<string, { lastHired: string; count: number }>();
    (myRequests ?? []).forEach((r) => {
      if (!r.technician_id || teamIds.has(r.technician_id)) return;
      const existing = statsByTech.get(r.technician_id);
      statsByTech.set(r.technician_id, {
        lastHired: existing && existing.lastHired > r.created_at ? existing.lastHired : r.created_at,
        count: (existing?.count ?? 0) + 1,
      });
    });
    const techMap = new Map((technicians ?? []).map((t) => [t.id, t]));
    return Array.from(statsByTech.entries())
      .map(([techId, stats]) => ({ tech: techMap.get(techId), ...stats }))
      .filter((entry): entry is { tech: Profile; lastHired: string; count: number } => !!entry.tech)
      .sort((a, b) => new Date(b.lastHired).getTime() - new Date(a.lastHired).getTime())
      .slice(0, 3);
  }, [myRequests, technicians, teamIds]);

  const actionSheet = (
    <ServiceActionSheet
      category={pickerCategory}
      onClose={() => setPickerCategory(null)}
      onSelect={(action) => {
        if (!pickerCategory) return;
        const category = pickerCategory.label;
        setPickerCategory(null);
        router.push(
          `/(reseller)/request-details?category=${encodeURIComponent(category)}&action=${encodeURIComponent(action)}&n=${Date.now()}`
        );
      }}
    />
  );

  // The page, one arrangement that reflows: its title and the one search box (for services and products
  // alike), the switch between All / Services / Products, the services in a card, the products, then
  // outsource technicians.
  const wide = isWideWeb;
  const pad = wide ? 32 : 16;

  const band = (
    <View className="flex-row flex-wrap items-end justify-between" style={{ gap: 12 }}>
      <View style={{ flexShrink: 1 }}>
        <Text className="text-2xl font-extrabold text-gray-900" numberOfLines={2}>
          Marketplace
        </Text>
        <Text className="mt-1 text-sm text-gray-600">The work you take on and the stock you sell, in one place.</Text>
      </View>
      <View
        className="flex-row items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5"
        style={{ width: wide ? 340 : '100%' }}
      >
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search services and products"
          placeholderTextColor="#9CA3AF"
          accessibilityLabel="Search services and products"
          className="ml-2 flex-1 text-sm text-gray-900"
        />
      </View>
    </View>
  );

  const counts: Record<Section, number> = {
    all: filteredCategories.length + productCount,
    services: filteredCategories.length,
    products: productCount,
  };
  const switcher = (
    <View
      className="flex-row rounded-2xl bg-gray-100 p-1"
      style={{ gap: 4, alignSelf: wide ? 'flex-start' : 'stretch' }}
      accessibilityLabel="Show"
    >
      {VIEWS.map(({ key, label }) => {
        const on = view === key;
        return (
          <Pressable
            key={key}
            onPress={() => setView(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            className="h-10 flex-row items-center justify-center rounded-xl px-4"
            style={{ gap: 6, flexGrow: wide ? 0 : 1, backgroundColor: on ? '#2563EB' : 'transparent' }}
          >
            <Text className="text-sm font-bold" style={{ color: on ? '#FFFFFF' : '#374151' }}>
              {label}
            </Text>
            <Text className="text-sm font-semibold" style={{ color: on ? '#DBEAFE' : '#4B5563' }}>
              {counts[key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const categoriesCard = (
    <View
      className="rounded-2xl border border-gray-200 bg-white"
      style={{ padding: wide ? 20 : 14 }}
      onLayout={(e) => setMainColumnWidth(e.nativeEvent.layout.width)}
    >
      <View className="mb-4 flex-row flex-wrap items-baseline justify-between" style={{ gap: 4 }}>
        <Text className="text-[18px] font-extrabold leading-[22px] text-gray-900">Services</Text>
        <Text className="text-[13px] text-gray-500">Tap a service to start a job</Text>
      </View>
      <CategoryGrid categories={filteredCategories} onSelect={setPickerCategory} columns={wide ? categoryColumns : undefined} />
    </View>
  );

  const outsourceCard =
    recentlyHiredTechnicians.length > 0 ? (
      <View className="rounded-2xl border border-gray-200 bg-white" style={{ padding: wide ? 20 : 14 }}>
        <Text className="mb-3 text-[16px] font-bold" style={{ color: '#1E3A8A' }}>Outsource technicians</Text>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {recentlyHiredTechnicians.map(({ tech, count }) => (
            <View
              key={tech.id}
              className="flex-row items-center rounded-2xl border border-gray-200 p-3.5"
              style={{ gap: 12, flexGrow: 1, flexBasis: 240 }}
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-blue-700">
                <Text className="text-xs font-bold text-white">{initialsOf(tech.full_name)}</Text>
              </View>
              <View className="flex-1">
                <Pressable onPress={() => router.push(`/(reseller)/technician/${tech.id}`)}>
                  <Text className="text-[13.5px] font-bold text-blue-800 underline">{tech.full_name ?? 'Technician'}</Text>
                </Pressable>
                <Text className="mt-0.5 text-[11.5px] text-gray-500">
                  {tech.city ?? 'Nepal'} · {count} job{count === 1 ? '' : 's'} together
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    ) : null;

  return (
    <>
      <ScrollView className="flex-1" style={{ backgroundColor: '#F6F7FB' }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: pad, paddingTop: wide ? 24 : 14, gap: 16 }}>
          {band}
          {switcher}
          {view !== 'products' && categoriesCard}
          {view !== 'services' && (
            <View>
              <MyStorefront
                sellerRole="reseller"
                emptyText="Switch an item on in Inventory and it shows here, and to your customers."
                basePath="/(reseller)"
                search={search}
                hideOverview
                marketplaceOnly
                title="Products"
              />
            </View>
          )}
          {view !== 'products' && outsourceCard}
        </View>
      </ScrollView>

      {actionSheet}
    </>
  );
}

// app/(reseller)/dashboard.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { CategoryGrid, categoryColumnsFor } from '../../lib/components/CategoryGrid';
import { ServiceActionSheet } from '../../lib/components/ServiceActionSheet';
import {
  usePendingHires,
  useMyEmployees,
  useRespondToHire,
  useLeaveRequests,
  useDecideLeaveRequest,
} from '../../lib/hooks/useTechnicianEmployment';
import { useTeamJobs, useTeamLocations } from '../../lib/hooks/useTeamActivity';
import { useTick } from '../../lib/components/TeamActivity';
import { PersonAvatar } from '../../lib/components/PersonAvatar';
import { buildMember, sortMembers } from '../../lib/utils/teamStatus';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
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

function HiringSections({ userId }: { userId: string }) {
  const { data: pendingHires } = usePendingHires(userId);
  const { data: employees } = useMyEmployees(userId);
  const respondToHire = useRespondToHire();
  const leaveRequests = useLeaveRequests(userId);
  const decideLeave = useDecideLeaveRequest();

  async function handleLeave(id: string, approve: boolean) {
    try {
      await decideLeave.decide(id, approve);
    } catch (err) {
      showAlert('Could not respond', getErrorMessage(err));
    }
  }

  async function handleRespond(id: string, accept: boolean) {
    try {
      await respondToHire.respond(id, accept);
    } catch (err) {
      showAlert('Could not respond', getErrorMessage(err));
    }
  }

  const { data: jobs } = useTeamJobs(userId, employees.map((e) => e.profile.id));
  const locations = useTeamLocations(userId);
  const now = useTick();
  const members = useMemo(
    () => sortMembers(employees.map((e) => buildMember(e.employment, e.profile, jobs, locations.get(e.profile.id), now))),
    [employees, jobs, locations, now]
  );
  const attention = members.reduce((n, m) => n + m.attention.length, 0);

  return (
    <>
      {leaveRequests.length > 0 && (
        <>
          <Text className="mb-3 mt-3 text-[15px] font-bold text-gray-900">Requests to Leave</Text>
          {leaveRequests.map(({ employment, profile }) => (
            <View key={employment.id} className="mb-2.5 rounded-2xl border border-blue-200 bg-blue-50 p-3.5">
              <View className="mb-2.5 flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-blue-900">
                  <Text className="text-xs font-bold text-white">{initialsOf(profile.full_name)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13.5px] font-bold text-gray-900">{profile.full_name ?? 'Technician'}</Text>
                  <Text className="mt-0.5 text-[11.5px] text-gray-600" numberOfLines={2}>
                    {employment.leave_reason ? `Wants to leave · ${employment.leave_reason}` : 'Wants to leave your team'}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={() => handleLeave(employment.id, false)}
                  disabled={decideLeave.isPending}
                  className="flex-1 items-center rounded-lg border border-gray-300 bg-white py-2 disabled:opacity-50"
                >
                  <Text className="text-xs font-semibold text-gray-600">Reject</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleLeave(employment.id, true)}
                  disabled={decideLeave.isPending}
                  className="flex-1 items-center rounded-lg bg-blue-600 py-2 disabled:opacity-50"
                >
                  <Text className="text-xs font-semibold text-white">Approve</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}

      {pendingHires.length > 0 && (
        <>
          <Text className="mb-3 mt-3 text-[15px] font-bold text-gray-900">Hiring Requests</Text>
          {pendingHires.map(({ employment, profile }) => (
            <View key={employment.id} className="mb-2.5 rounded-2xl border border-blue-200 bg-blue-50 p-3.5">
              <View className="mb-2.5 flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-blue-600">
                  <Text className="text-xs font-bold text-white">{initialsOf(profile.full_name)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13.5px] font-bold text-gray-900">{profile.full_name ?? 'Technician'}</Text>
                  <Text className="mt-0.5 text-[11.5px] text-gray-500">
                    Wants to work {employment.work_start_time?.slice(0, 5)}–{employment.work_end_time?.slice(0, 5)}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={() => handleRespond(employment.id, false)}
                  disabled={respondToHire.isPending}
                  className="flex-1 items-center rounded-lg border border-gray-300 py-2 disabled:opacity-50"
                >
                  <Text className="text-xs font-semibold text-gray-600">Reject</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleRespond(employment.id, true)}
                  disabled={respondToHire.isPending}
                  className="flex-1 items-center rounded-lg bg-blue-600 py-2 disabled:opacity-50"
                >
                  <Text className="text-xs font-semibold text-white">Accept</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}

      {members.length > 0 && (
        <Pressable
          onPress={() => router.push('/(reseller)/employees' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open team"
          className="mb-2.5 mt-3 rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50"
          style={{ gap: 12 }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-[15px] font-bold text-gray-900">My team</Text>
            {attention > 0 && (
              <View className="rounded-full bg-blue-50 px-2.5 py-0.5">
                <Text className="text-[11px] font-bold text-blue-900">{attention} need attention</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center justify-between">
            <View className="flex-row">
              {members.slice(0, 5).map((m, i) => (
                <View key={m.employment.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                  <View className="rounded-full border-2 border-white">
                    <PersonAvatar name={m.profile.full_name} photoUrl={m.profile.avatar_url} size={38} bg={m.profile.avatar_url ? 'bg-blue-600' : 'bg-gray-500'} />
                  </View>
                  <View
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                      backgroundColor: m.state === 'working' ? '#1E3A8A' : m.state === 'offer' ? '#93C5FD' : m.state === 'free' ? '#2563EB' : '#CBD5E1',
                    }}
                  />
                </View>
              ))}
              {members.length > 5 && (
                <View className="ml-[-10px] h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-white bg-gray-100">
                  <Text className="text-xs font-bold text-gray-600">+{members.length - 5}</Text>
                </View>
              )}
            </View>
            <Text className="text-[13px] text-gray-600">
              {members.filter((m) => m.state === 'working').length} working · {members.filter((m) => m.state === 'free').length} free
            </Text>
          </View>
          <View className="h-11 flex-row items-center justify-center rounded-xl bg-blue-600" style={{ gap: 6 }}>
            <Text className="text-[14px] font-bold text-white">Open team</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
        </Pressable>
      )}
    </>
  );
}

export default function ResellerDashboard() {
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);
  const [search, setSearch] = useState('');
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

  // The portal, one arrangement that reflows: a brand-blue welcome band with the search, the quick
  // "need a technician" action, the categories in a card, then outsource technicians and the team.
  // The company name is shown, not the owner's: this is the business's portal.
  const company = profile?.business_name?.trim() || profile?.full_name || '';
  const wide = isWideWeb;
  const pad = wide ? 32 : 16;

  const band = (
    <View className="flex-row flex-wrap items-center justify-between" style={{ gap: 12 }}>
      <Text className="text-2xl font-extrabold text-gray-900" style={{ flexShrink: 1 }} numberOfLines={2}>
        Welcome{company ? `, ${company}` : ''}
      </Text>
      <View
        className="flex-row items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5"
        style={{ width: wide ? 320 : '100%' }}
      >
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search for services..."
          placeholderTextColor="#9CA3AF"
          className="ml-2 flex-1 text-sm text-gray-900"
        />
      </View>
    </View>
  );

  const categoriesCard = (
    <View
      className="rounded-2xl border border-gray-200 bg-white"
      style={{ padding: wide ? 20 : 14 }}
      onLayout={(e) => setMainColumnWidth(e.nativeEvent.layout.width)}
    >
      <View className="mb-4 flex-row items-baseline justify-between">
        <Text className="text-[18px] font-extrabold leading-[22px] text-gray-900">Browse by category</Text>
        <Text className="text-[13px] text-gray-500">
          {filteredCategories.length} {filteredCategories.length === 1 ? 'service' : 'services'}
        </Text>
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
          {categoriesCard}
          {outsourceCard}
          {userId ? <HiringSections userId={userId} /> : null}
        </View>
      </ScrollView>

      {actionSheet}
    </>
  );
}

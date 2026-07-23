// app/(technician)/earnings.tsx
import { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { BarChart } from '../../lib/components/BarChart';
import type { JobCard } from '../../types/database.types';

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatHour(hour: number) {
  const period = hour < 12 ? 'am' : 'pm';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}

// Distributes a job's worked duration across the hour-of-day buckets it
// spans, so a job running 2:30-4:15 contributes partial hours to the 2, 3,
// and 4 o'clock buckets instead of being counted once at its start time.
function addToHourBuckets(buckets: number[], startedAt: string, completedAt: string) {
  const end = new Date(completedAt);
  let cursor = new Date(startedAt);
  if (end <= cursor) return;

  let guard = 0;
  while (cursor < end && guard < 500) {
    guard++;
    const hour = cursor.getHours();
    const boundary = new Date(cursor);
    boundary.setMinutes(0, 0, 0);
    boundary.setHours(boundary.getHours() + 1);
    const segmentEnd = end < boundary ? end : boundary;
    buckets[hour] += (segmentEnd.getTime() - cursor.getTime()) / 3600000;
    cursor = segmentEnd;
  }
}

export default function TechnicianEarnings() {
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: jobCards, isLoading } = useSupabaseQuery('job_cards', {
    filters: userId ? { technician_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const completed = (jobCards ?? []).filter((c): c is JobCard & { completed_at: string } => !!c.completed_at);

    let today = 0;
    let weekTotal = 0;
    let weekJobsDone = 0;
    let totalHours = 0;
    let totalEarnings = 0;
    const hourBuckets = new Array(24).fill(0);

    const payoutHistory = completed.map((c) => {
      const amount = Number(c.labor_cost) + Number(c.parts_cost);
      const completedDate = new Date(c.completed_at);
      const durationHours = c.started_at
        ? (completedDate.getTime() - new Date(c.started_at).getTime()) / 3600000
        : null;

      if (completedDate >= weekStart) {
        weekTotal += amount;
        weekJobsDone += 1;
      }
      if (completedDate >= todayStart) {
        today += amount;
      }
      totalHours += durationHours ?? 0;
      totalEarnings += amount;
      if (c.started_at) addToHourBuckets(hourBuckets, c.started_at, c.completed_at);

      return { id: c.id, amount, date: completedDate, durationHours };
    });

    payoutHistory.sort((a, b) => b.date.getTime() - a.date.getTime());

    const jobsCompleted = completed.length;
    const avgEarningPerTask = jobsCompleted > 0 ? totalEarnings / jobsCompleted : 0;

    const dailyBuckets: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const total = completed.reduce((sum, c) => {
        const d = new Date(c.completed_at);
        return d >= dayStart && d < dayEnd ? sum + Number(c.labor_cost) + Number(c.parts_cost) : sum;
      }, 0);
      dailyBuckets.push({
        label: i === 0 ? 'Today' : dayStart.toLocaleDateString(undefined, { weekday: 'short' }),
        value: total,
      });
    }

    const hourlyData = hourBuckets.map((value, hour) => ({ label: formatHour(hour), value }));

    return {
      today,
      weekTotal,
      weekJobsDone,
      jobsCompleted,
      totalHours,
      avgEarningPerTask,
      payoutHistory,
      dailyBuckets,
      hourlyData,
    };
  }, [jobCards]);

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="mb-5 rounded-2xl bg-[#0D9488] p-5">
        <Text className="text-[12.5px] font-semibold text-white/85">This week</Text>
        <Text className="mt-1 text-[28px] font-extrabold text-white">NPR {stats.weekTotal.toLocaleString()}</Text>
        <View className="mt-3.5 flex-row gap-4">
          <View>
            <Text className="text-[15px] font-extrabold text-white">NPR {stats.today.toLocaleString()}</Text>
            <Text className="text-[11px] text-white/80">Today</Text>
          </View>
          <View>
            <Text className="text-[15px] font-extrabold text-white">{stats.weekJobsDone}</Text>
            <Text className="text-[11px] text-white/80">Jobs done</Text>
          </View>
        </View>
      </View>

      <View className="mb-6 flex-row gap-2.5">
        <View className="flex-1 rounded-xl border border-gray-200 bg-white p-3.5">
          <Text
            className="text-lg font-extrabold text-gray-900"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {stats.jobsCompleted}
          </Text>
          <Text className="mt-0.5 text-[11px] text-gray-500">Tasks completed</Text>
        </View>
        <View className="flex-1 rounded-xl border border-gray-200 bg-white p-3.5">
          <Text
            className="text-lg font-extrabold text-gray-900"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {stats.totalHours.toFixed(1)}h
          </Text>
          <Text className="mt-0.5 text-[11px] text-gray-500">Work hours</Text>
        </View>
        <View className="flex-1 rounded-xl border border-gray-200 bg-white p-3.5">
          <Text
            className="text-lg font-extrabold text-gray-900"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {Math.round(stats.avgEarningPerTask).toLocaleString()}
          </Text>
          <Text className="mt-0.5 text-[11px] text-gray-500">NPR avg / task</Text>
        </View>
      </View>

      <Text className="mb-3 text-[15px] font-bold text-gray-900">Daily earnings (last 7 days)</Text>
      <View className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
        <BarChart data={stats.dailyBuckets} formatValue={(v) => `NPR ${Math.round(v).toLocaleString()}`} />
      </View>

      <Text className="mb-1 text-[15px] font-bold text-gray-900">Work pattern by hour of day</Text>
      <Text className="mb-3 text-xs text-gray-400">Hours worked in each hour of the day, across all completed jobs</Text>
      <View className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
        <BarChart
          data={stats.hourlyData}
          formatValue={(v) => `${v.toFixed(1)}h worked`}
          formatLabel={(label, i) => (i % 6 === 0 ? label : null)}
        />
      </View>

      <Text className="mb-3 text-[15px] font-bold text-gray-900">Recent payouts</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && stats.payoutHistory.length === 0 && (
        <Text className="text-gray-500">Completed jobs will show up here.</Text>
      )}

      {stats.payoutHistory.map((item) => (
        <View
          key={item.id}
          className="mb-2.5 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3.5"
        >
          <View>
            <Text className="text-xs text-gray-400">
              {item.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
            {item.durationHours != null && (
              <Text className="mt-0.5 text-[11px] text-gray-400">{item.durationHours.toFixed(1)}h worked</Text>
            )}
          </View>
          <Text className="text-[13.5px] font-extrabold text-[#0D9488]">NPR {item.amount.toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

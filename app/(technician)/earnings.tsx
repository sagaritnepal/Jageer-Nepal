// app/(technician)/earnings.tsx
import { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function TechnicianEarnings() {
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: jobCards, isLoading } = useSupabaseQuery('job_cards', {
    filters: userId ? { technician_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  const { today, weekTotal, jobsDone, payoutHistory } = useMemo(() => {
    const cards = jobCards ?? [];
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    let today = 0;
    let weekTotal = 0;
    let jobsDone = 0;

    const payoutHistory = cards.map((c) => {
      const amount = Number(c.labor_cost) + Number(c.parts_cost);
      const created = new Date(c.created_at);
      if (created >= weekStart) {
        weekTotal += amount;
        jobsDone += 1;
      }
      if (created >= todayStart) {
        today += amount;
      }
      return { id: c.id, amount, date: created };
    });

    return { today, weekTotal, jobsDone, payoutHistory };
  }, [jobCards]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-6 rounded-2xl bg-[#0D9488] p-5">
        <Text className="text-[12.5px] font-semibold text-white/85">This week</Text>
        <Text className="mt-1 text-[28px] font-extrabold text-white">
          NPR {weekTotal.toLocaleString()}
        </Text>
        <View className="mt-3.5 flex-row gap-4">
          <View>
            <Text className="text-[15px] font-extrabold text-white">NPR {today.toLocaleString()}</Text>
            <Text className="text-[11px] text-white/80">Today</Text>
          </View>
          <View>
            <Text className="text-[15px] font-extrabold text-white">{jobsDone}</Text>
            <Text className="text-[11px] text-white/80">Jobs done</Text>
          </View>
        </View>
      </View>

      <Text className="mb-3 text-[15px] font-bold text-gray-900">Recent payouts</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && payoutHistory.length === 0 && (
        <Text className="text-gray-500">Completed jobs will show up here.</Text>
      )}

      <FlatList
        data={payoutHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="mb-2.5 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <Text className="text-xs text-gray-400">
              {item.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
            <Text className="text-[13.5px] font-extrabold text-[#0D9488]">
              NPR {item.amount.toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

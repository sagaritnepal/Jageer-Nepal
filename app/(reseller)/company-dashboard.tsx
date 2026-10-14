// app/(reseller)/company-dashboard.tsx
//
// The reseller's whole company on one page: who the business is, what it is worth today (cash and
// bank, what is owed to it and by it), how this month's sales, purchases and expenses compare with
// last month, where every job stands, and the team. Everything here is read from data the app
// already keeps - nothing is entered on this page.
import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Image, useWindowDimensions, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { useAccountBalances } from '../../lib/hooks/useAccountBalances';
import { useMyEmployees } from '../../lib/hooks/useTechnicianEmployment';
import { supabase } from '../../lib/supabase';
import { WEB_SIDEBAR_MIN_WIDTH } from '../../lib/components/web/WebSidebarShell';
import { CARD_SHADOW, SalesTrendCard, RecentActivityCard } from '../../lib/components/finance/dashboard/FinanceDashboard';

const npr = (n: number) => `NPR ${Math.round(n).toLocaleString()}`;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM' of a date, and of the month before it. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Kpi({
  label,
  value,
  icon,
  color,
  tint,
  caption,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tint: string;
  caption?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="rounded-2xl bg-white p-4"
      style={[{ flexGrow: 1, flexBasis: 220, minWidth: 200 }, CARD_SHADOW]}
    >
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View className="items-center justify-center rounded-xl" style={{ width: 38, height: 38, backgroundColor: tint }}>
          <Ionicons name={icon} size={19} color={color} />
        </View>
        <Text className="flex-1 text-[12.5px] font-semibold text-gray-500" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text className="mt-3 text-[22px] font-extrabold text-gray-900" numberOfLines={1}>
        {value}
      </Text>
      {!!caption && (
        <Text className="mt-0.5 text-[12px] text-gray-500" numberOfLines={1}>
          {caption}
        </Text>
      )}
    </Pressable>
  );
}

function JobStat({
  label,
  count,
  color,
  tint,
  onPress,
}: {
  label: string;
  count: number;
  color: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-xl px-3.5 py-3"
      style={{ flexGrow: 1, flexBasis: 160, gap: 10, backgroundColor: tint }}
    >
      <Text className="text-[24px] font-extrabold" style={{ color }}>
        {count}
      </Text>
      <Text className="flex-1 text-[12.5px] font-semibold text-gray-700" numberOfLines={2}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
    </Pressable>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View className="rounded-2xl bg-white p-5" style={CARD_SHADOW}>
      <View className="mb-3.5 flex-row items-center justify-between">
        <Text className="text-[15px] font-bold text-gray-900">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export default function CompanyDashboard() {
  const profile = useAuthStore((state) => state.profile);
  const userId = profile?.id;
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const twoColumns = width >= 1100;

  const balances = useAccountBalances(userId);
  const { data: employees } = useMyEmployees(userId);

  const { data: transactions } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId } : {},
    all: true,
    enabled: !!userId,
  });
  const { data: customerEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    all: true,
    enabled: !!userId,
  });
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    all: true,
    enabled: !!userId,
  });
  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    all: true,
    enabled: !!userId,
  });
  const { data: jobs } = useSupabaseQuery('service_requests', {
    filters: userId ? { reseller_id: userId } : {},
    enabled: !!userId,
  });
  const { data: incomingRaw } = useSupabaseQuery('service_requests', {
    filters: { status: 'pending', origin: 'app' },
    enabled: !!userId,
  });
  const { data: orders } = useSupabaseQuery('orders', {
    filters: userId ? { seller_id: userId } : {},
    enabled: !!userId,
  });

  // This month against last month, by the bill's own date.
  const month = useMemo(() => {
    const now = new Date();
    const thisKey = monthKey(now);
    const lastKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const sums = { sale: [0, 0], purchase: [0, 0], expense: [0, 0] } as Record<string, [number, number]>;
    for (const t of transactions ?? []) {
      const key = (t.bill_date ?? t.created_at).slice(0, 7);
      const slot = key === thisKey ? 0 : key === lastKey ? 1 : -1;
      if (slot >= 0 && sums[t.type]) sums[t.type][slot] += t.amount;
    }
    return sums;
  }, [transactions]);

  // What is owed to the business and by it: each party's two ledgers netted, like the Ledger page.
  const owed = useMemo(() => {
    const net = new Map<string, number>();
    (customerEntries ?? []).forEach((e) =>
      net.set(e.customer_id, (net.get(e.customer_id) ?? 0) + (e.entry_type === 'debit' ? e.amount : -e.amount))
    );
    (vendorEntries ?? []).forEach((e) =>
      net.set(e.vendor_id, (net.get(e.vendor_id) ?? 0) - (e.entry_type === 'debit' ? e.amount : -e.amount))
    );
    let receivable = 0;
    let payable = 0;
    let debtors = 0;
    net.forEach((v) => {
      if (v > 0.5) {
        receivable += v;
        debtors += 1;
      } else if (v < -0.5) payable += -v;
    });
    return { receivable, payable, debtors };
  }, [customerEntries, vendorEntries]);

  const jobStats = useMemo(() => {
    const now = Date.now();
    let waiting = 0;
    let inProgress = 0;
    let overdue = 0;
    let toBill = 0;
    let unpaid = 0;
    for (const j of jobs ?? []) {
      if (j.status === 'cancelled') continue;
      const slot = j.scheduled_date
        ? new Date(`${j.scheduled_date}T${j.scheduled_time?.slice(0, 5) ?? '23:59'}`).getTime()
        : new Date(j.created_at).getTime();
      if (j.status !== 'resolved' && now - slot > DAY_MS) overdue += 1;
      if (j.status === 'approved' || (j.status === 'pending' && j.origin === 'reseller')) waiting += 1;
      if (j.status === 'assigned' || j.status === 'in_progress') inProgress += 1;
      if (j.status === 'resolved' && j.payment_status !== 'paid') unpaid += 1;
      if (j.status === 'resolved' && j.payment_status === 'unpaid') toBill += 1;
    }
    const newRequests = (incomingRaw ?? []).filter((r) => !r.reseller_id).length;
    const shopOrders = (orders ?? []).filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
    return { waiting, inProgress, overdue, toBill, unpaid, newRequests, shopOrders };
  }, [jobs, incomingRaw, orders]);

  const logoUrl = profile?.business_logo_path
    ? supabase.storage.from('business-assets').getPublicUrl(profile.business_logo_path).data.publicUrl
    : null;
  const company = profile?.business_name?.trim() || profile?.full_name || 'Your company';
  const details = [
    profile?.business_address && { icon: 'location-outline' as const, text: profile.business_address },
    profile?.business_phone && { icon: 'call-outline' as const, text: profile.business_phone },
    profile?.business_reg_no && { icon: 'document-text-outline' as const, text: `Reg. ${profile.business_reg_no}` },
    profile?.business_vat_no && { icon: 'receipt-outline' as const, text: `VAT/PAN ${profile.business_vat_no}` },
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; text: string }[];

  const change = (now: number, before: number): string | undefined => {
    if (before <= 0) return now > 0 ? 'New this month' : undefined;
    const pct = Math.round(((now - before) / before) * 100);
    return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs last month`;
  };
  const go = (path: string) => router.push(path as never);

  const hero = (
    <LinearGradient
      colors={['#0F172A', '#1E3A8A', '#2563EB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 20, padding: wide ? 28 : 20 }}
    >
      <View className="flex-row flex-wrap items-center" style={{ gap: 18 }}>
        <View
          className="items-center justify-center overflow-hidden rounded-2xl bg-white"
          style={{ width: 76, height: 76 }}
        >
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={{ width: 76, height: 76 }} resizeMode="cover" />
          ) : (
            <Ionicons name="business" size={34} color="#1E3A8A" />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 220, gap: 6 }}>
          <Text className="text-[12px] font-semibold tracking-wider text-blue-200">COMPANY OVERVIEW</Text>
          <Text className="text-[26px] font-extrabold text-white" numberOfLines={2}>
            {company}
          </Text>
          {profile?.full_name && profile.business_name ? (
            <Text className="text-[13px] text-blue-100">Owner · {profile.full_name}</Text>
          ) : null}
          <View className="mt-1 flex-row flex-wrap" style={{ columnGap: 16, rowGap: 6 }}>
            {details.map((d) => (
              <View key={d.text} className="flex-row items-center" style={{ gap: 6 }}>
                <Ionicons name={d.icon} size={14} color="#BFDBFE" />
                <Text className="text-[12.5px] text-blue-50" numberOfLines={1}>
                  {d.text}
                </Text>
              </View>
            ))}
            {details.length === 0 && (
              <Text className="text-[12.5px] text-blue-100">Add your address, phone and registration numbers in Company details.</Text>
            )}
          </View>
        </View>
        <Pressable
          onPress={() => go('/(reseller)/company')}
          className="flex-row items-center rounded-xl px-4 py-2.5"
          style={{ gap: 6, backgroundColor: 'rgba(255,255,255,0.16)' }}
        >
          <Ionicons name="create-outline" size={16} color="#FFFFFF" />
          <Text className="text-[13px] font-semibold text-white">Company details</Text>
        </Pressable>
      </View>

      <View className="mt-5 flex-row flex-wrap" style={{ gap: 10 }}>
        {[
          { label: 'Customers', value: String((customers ?? []).length), icon: 'people-outline' as const },
          { label: 'Team members', value: String((employees ?? []).length), icon: 'construct-outline' as const },
          { label: 'Active jobs', value: String(jobStats.waiting + jobStats.inProgress), icon: 'clipboard-outline' as const },
          { label: 'Shop orders open', value: String(jobStats.shopOrders), icon: 'bag-outline' as const },
        ].map((s) => (
          <View
            key={s.label}
            className="flex-row items-center rounded-xl px-3.5 py-2.5"
            style={{ gap: 10, backgroundColor: 'rgba(255,255,255,0.12)', flexGrow: 1, flexBasis: 150 }}
          >
            <Ionicons name={s.icon} size={18} color="#BFDBFE" />
            <View>
              <Text className="text-[18px] font-extrabold text-white">{s.value}</Text>
              <Text className="text-[11.5px] text-blue-100">{s.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </LinearGradient>
  );

  const money = (
    <View className="flex-row flex-wrap" style={{ gap: 14 }}>
      <Kpi
        label="Cash & bank balance"
        value={npr(balances.total)}
        icon="wallet-outline"
        color="#047857"
        tint="#ECFDF5"
        caption={`Cash ${npr(balances.cash)}`}
        onPress={() => go('/(reseller)/bank-balances')}
      />
      <Kpi
        label="To receive"
        value={npr(owed.receivable)}
        icon="arrow-down-circle-outline"
        color="#1D4ED8"
        tint="#EFF6FF"
        caption={`From ${owed.debtors} ${owed.debtors === 1 ? 'party' : 'parties'}`}
        onPress={() => go('/(reseller)/to-receive')}
      />
      <Kpi
        label="To pay"
        value={npr(owed.payable)}
        icon="arrow-up-circle-outline"
        color="#B91C1C"
        tint="#FEF2F2"
        caption="Owed to vendors"
        onPress={() => go('/(reseller)/to-give')}
      />
      <Kpi
        label="Net position"
        value={npr(balances.total + owed.receivable - owed.payable)}
        icon="stats-chart-outline"
        color="#7C3AED"
        tint="#F5F3FF"
        caption="Cash + receivable − payable"
      />
    </View>
  );

  const monthKpis = (
    <View className="flex-row flex-wrap" style={{ gap: 14 }}>
      <Kpi
        label="Sales this month"
        value={npr(month.sale[0])}
        icon="trending-up-outline"
        color="#047857"
        tint="#ECFDF5"
        caption={change(month.sale[0], month.sale[1])}
        onPress={() => go('/(reseller)/sales-report')}
      />
      <Kpi
        label="Purchases this month"
        value={npr(month.purchase[0])}
        icon="cart-outline"
        color="#B45309"
        tint="#FFFBEB"
        caption={change(month.purchase[0], month.purchase[1])}
        onPress={() => go('/(reseller)/purchase-report')}
      />
      <Kpi
        label="Expenses this month"
        value={npr(month.expense[0])}
        icon="receipt-outline"
        color="#B91C1C"
        tint="#FEF2F2"
        caption={change(month.expense[0], month.expense[1])}
        onPress={() => go('/(reseller)/expense-report')}
      />
      <Kpi
        label="Month result"
        value={npr(month.sale[0] - month.purchase[0] - month.expense[0])}
        icon="calculator-outline"
        color="#0F766E"
        tint="#F0FDFA"
        caption="Sales − purchases − expenses"
      />
    </View>
  );

  const jobsCard = (
    <Section
      title="Jobs"
      right={
        <Pressable onPress={() => go('/(reseller)/requests')} hitSlop={6}>
          <Text className="text-[12.5px] font-semibold" style={{ color: '#2563EB' }}>
            Open requests
          </Text>
        </Pressable>
      }
    >
      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        <JobStat label="New app requests" count={jobStats.newRequests} color="#EA580C" tint="#FFF7ED" onPress={() => go('/(reseller)/requests')} />
        <JobStat label="Waiting for a technician" count={jobStats.waiting} color="#2563EB" tint="#EFF6FF" onPress={() => go('/(reseller)/requests')} />
        <JobStat label="In progress" count={jobStats.inProgress} color="#16A34A" tint="#F0FDF4" onPress={() => go('/(reseller)/requests')} />
        <JobStat label="Overdue" count={jobStats.overdue} color="#B91C1C" tint="#FEF2F2" onPress={() => go('/(reseller)/requests')} />
        <JobStat label="Done, to be billed" count={jobStats.toBill} color="#7C3AED" tint="#F5F3FF" onPress={() => go('/(reseller)/requests')} />
        <JobStat label="Awaiting payment" count={jobStats.unpaid} color="#B45309" tint="#FFFBEB" onPress={() => go('/(reseller)/requests')} />
      </View>
    </Section>
  );

  const quick = (
    <Section title="Quick actions">
      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {[
          { label: 'New sale', icon: 'trending-up' as const, path: '/(reseller)/transactions?type=sale&add=1' },
          { label: 'New purchase', icon: 'cart' as const, path: '/(reseller)/transactions?type=purchase&add=1' },
          { label: 'Received', icon: 'arrow-down-circle' as const, path: '/(reseller)/quick-payment?type=in' },
          { label: 'Payment out', icon: 'arrow-up-circle' as const, path: '/(reseller)/quick-payment?type=out' },
          { label: 'New job', icon: 'add-circle' as const, path: '/(reseller)/new-request?from=requests' },
          { label: 'Ledger', icon: 'people' as const, path: '/(reseller)/customers' },
          { label: 'Day book', icon: 'book' as const, path: '/(reseller)/daybook' },
          { label: 'My team', icon: 'construct' as const, path: '/(reseller)/employees' },
        ].map((a) => (
          <Pressable
            key={a.label}
            onPress={() => go(a.path)}
            className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5"
            style={{ gap: 8 }}
          >
            <Ionicons name={a.icon} size={16} color="#1E3A8A" />
            <Text className="text-[13px] font-semibold text-gray-800">{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </Section>
  );

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: '#F6F7FB' }} contentContainerStyle={{ padding: wide ? 28 : 14, gap: 18, paddingBottom: 60 }}>
      {hero}
      {money}
      {monthKpis}
      {jobsCard}
      <View className={twoColumns ? 'flex-row' : ''} style={{ gap: 18 }}>
        <View style={twoColumns ? { flex: 1.15, minWidth: 0 } : undefined}>
          <SalesTrendCard />
        </View>
        <View style={twoColumns ? { flex: 1, minWidth: 0 } : { marginTop: 0 }}>
          <RecentActivityCard basePath="/(reseller)" />
        </View>
      </View>
      {quick}
    </ScrollView>
  );
}

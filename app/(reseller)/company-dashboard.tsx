// app/(reseller)/company-dashboard.tsx
//
// The reseller's whole company in pictures: who the business is, what it holds (cash and bank),
// what is owed to it and by it, how sales, purchases and expenses have moved over the year, where
// every job stands, who the best customers are and how the team is doing. Everything is read from
// data the app already keeps - nothing is typed on this page. Months follow the AD / BS toggle.
import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Image, useWindowDimensions, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Polyline, Polygon, Line, Text as SvgText } from 'react-native-svg';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { useAccountBalances } from '../../lib/hooks/useAccountBalances';
import { useMyEmployees } from '../../lib/hooks/useTechnicianEmployment';
import { useCalendarMode } from '../../lib/hooks/useCalendarMode';
import { adStringToBs, BS_MONTHS } from '../../lib/utils/nepaliDate';
import { localTodayIso } from '../../lib/utils/localDate';
import { supabase } from '../../lib/supabase';
import { WEB_SIDEBAR_MIN_WIDTH } from '../../lib/components/web/WebSidebarShell';
import { CARD_SHADOW, RecentActivityCard } from '../../lib/components/finance/dashboard/FinanceDashboard';

const npr = (n: number) => `NPR ${Math.round(n).toLocaleString()}`;
/** 1,23,456 -> "1.23L", 12,34,567 -> "12.3L", 1,23,45,678 -> "1.23Cr": short money for charts. */
function lakh(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1e7) return `${s}${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}${(a / 1e5).toFixed(a >= 1e6 ? 1 : 2)}L`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(0)}k`;
  return `${s}${Math.round(a)}`;
}
const DAY_MS = 24 * 60 * 60 * 1000;
const PALETTE = ['#2563EB', '#0F766E', '#F59E0B', '#7C3AED', '#E11D48', '#94A3B8'];

// ---------- months ----------
type Bucket = { key: string; label: string };
function keyOf(date: string, mode: 'bs' | 'ad'): string | null {
  const day = date.slice(0, 10);
  if (mode === 'bs') {
    const bs = adStringToBs(day);
    return bs ? `${bs.year}-${bs.month}` : null;
  }
  return day.slice(0, 7);
}
/** The last `count` months, oldest first, ending with the one that holds today. */
function lastMonths(count: number, mode: 'bs' | 'ad'): Bucket[] {
  const today = localTodayIso();
  let y: number;
  let m: number;
  if (mode === 'bs') {
    const bs = adStringToBs(today);
    y = bs?.year ?? Number(today.slice(0, 4));
    m = bs?.month ?? Number(today.slice(5, 7)) - 1;
  } else {
    y = Number(today.slice(0, 4));
    m = Number(today.slice(5, 7)) - 1;
  }
  const out: Bucket[] = [];
  for (let i = 0; i < count; i++) {
    const label =
      mode === 'bs'
        ? BS_MONTHS[m].slice(0, 3)
        : new Date(2000, m, 1).toLocaleDateString('en-US', { month: 'short' });
    out.unshift({ key: mode === 'bs' ? `${y}-${m}` : `${y}-${String(m + 1).padStart(2, '0')}`, label });
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
}

// ---------- small drawing pieces ----------
function Spark({ values, color, width = 150, height = 34 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return <View style={{ height }} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - 3 - ((v - min) / span) * (height - 8)}`)
    .join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
    </Svg>
  );
}

function Kpi({
  label,
  value,
  icon,
  color,
  tint,
  caption,
  captionColor,
  series,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tint: string;
  caption?: string;
  captionColor?: string;
  series?: number[];
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
        <View className="items-center justify-center rounded-xl" style={{ width: 36, height: 36, backgroundColor: tint }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text className="flex-1 text-[12.5px] font-semibold text-gray-500" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text className="mt-2.5 text-[22px] font-extrabold text-gray-900" numberOfLines={1}>
        {value}
      </Text>
      {!!caption && (
        <Text className="mt-0.5 text-[12px] font-semibold" style={{ color: captionColor ?? '#6B7280' }} numberOfLines={1}>
          {caption}
        </Text>
      )}
      {series && <View style={{ marginTop: 6 }}><Spark values={series} color={color} /></View>}
    </Pressable>
  );
}

function Panel({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View className="rounded-2xl bg-white p-5" style={[{ minWidth: 0 }, CARD_SHADOW]}>
      <View className="mb-3 flex-row items-center justify-between" style={{ gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text className="text-[15px] font-bold text-gray-900">{title}</Text>
          {!!subtitle && <Text className="mt-0.5 text-[12px] text-gray-500">{subtitle}</Text>}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 14 }}>
      {items.map((i) => (
        <View key={i.label} className="flex-row items-center" style={{ gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i.color }} />
          <Text className="text-[12px] text-gray-600">{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Two lines over twelve months, sales filled. */
function TrendChart({ labels, sales, purchases }: { labels: string[]; sales: number[]; purchases: number[] }) {
  const W = 660;
  const H = 240;
  const top = 16;
  const bottom = 30;
  const max = Math.max(...sales, ...purchases, 1);
  const x = (i: number) => 20 + (i / Math.max(labels.length - 1, 1)) * (W - 40);
  const y = (v: number) => top + (1 - v / max) * (H - top - bottom);
  const line = (vs: number[]) => vs.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${x(0)},${H - bottom} ${line(sales)} ${x(sales.length - 1)},${H - bottom}`;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0, 1, 2, 3].map((g) => {
        const gy = top + (g / 3) * (H - top - bottom);
        return <Line key={g} x1={20} x2={W - 20} y1={gy} y2={gy} stroke="#E5E7EB" strokeWidth={1} />;
      })}
      <SvgText x={20} y={top - 4} fontSize={11} fill="#6B7280">{lakh(max)}</SvgText>
      <Polygon points={area} fill="#2563EB" fillOpacity={0.12} />
      <Polyline points={line(sales)} fill="none" stroke="#2563EB" strokeWidth={3} strokeLinejoin="round" />
      <Polyline points={line(purchases)} fill="none" stroke="#F59E0B" strokeWidth={3} strokeLinejoin="round" />
      <Circle cx={x(sales.length - 1)} cy={y(sales[sales.length - 1] ?? 0)} r={5} fill="#2563EB" />
      {labels.map((l, i) => (
        <SvgText key={`${l}${i}`} x={x(i)} y={H - 10} fontSize={11} fill="#6B7280" textAnchor="middle">
          {l}
        </SvgText>
      ))}
    </Svg>
  );
}

function Donut({ parts, centre, caption }: { parts: { value: number; color: string }[]; centre: string; caption: string }) {
  const R = 58;
  const C = 2 * Math.PI * R;
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let offset = 0;
  return (
    <Svg width={170} height={170} viewBox="0 0 170 170">
      <Circle cx={85} cy={85} r={R} stroke="#EEF2F7" strokeWidth={24} fill="none" />
      {parts.map((p, i) => {
        const len = (p.value / total) * C;
        const el = (
          <Circle
            key={i}
            cx={85}
            cy={85}
            r={R}
            stroke={p.color}
            strokeWidth={24}
            fill="none"
            strokeDasharray={`${len} ${C}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 85 85)"
          />
        );
        offset += len;
        return el;
      })}
      <SvgText x={85} y={82} fontSize={11} fill="#6B7280" textAnchor="middle">{caption}</SvgText>
      <SvgText x={85} y={103} fontSize={17} fontWeight="700" fill="#0F172A" textAnchor="middle">{centre}</SvgText>
    </Svg>
  );
}

function Gauge({ percent, label }: { percent: number; label: string }) {
  const p = Math.max(0, Math.min(100, percent));
  const arc = 251.3; // length of the half circle, r = 80
  return (
    <Svg width="100%" height={150} viewBox="0 0 220 130">
      <Path d="M30 110 A80 80 0 0 1 190 110" fill="none" stroke="#E5E7EB" strokeWidth={16} strokeLinecap="round" />
      <Path
        d="M30 110 A80 80 0 0 1 190 110"
        fill="none"
        stroke={p >= 70 ? '#16A34A' : p >= 40 ? '#F59E0B' : '#DC2626'}
        strokeWidth={16}
        strokeLinecap="round"
        strokeDasharray={`${(p / 100) * arc} ${arc}`}
      />
      <SvgText x={110} y={100} fontSize={32} fontWeight="700" fill="#0F172A" textAnchor="middle">{`${Math.round(p)}%`}</SvgText>
      <SvgText x={110} y={122} fontSize={12} fill="#6B7280" textAnchor="middle">{label}</SvgText>
    </Svg>
  );
}

function HBars({ rows, color }: { rows: { label: string; value: number; display: string; color?: string }[]; color: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <View style={{ gap: 11 }}>
      {rows.map((r) => (
        <View key={r.label}>
          <View className="flex-row" style={{ gap: 8 }}>
            <Text className="flex-1 text-[13px] text-gray-800" numberOfLines={1}>
              {r.label}
            </Text>
            <Text className="text-[13px] font-bold text-gray-900">{r.display}</Text>
          </View>
          <View style={{ height: 9, borderRadius: 5, backgroundColor: '#EEF2F7', marginTop: 4 }}>
            <View style={{ height: 9, borderRadius: 5, width: `${Math.max(3, (r.value / max) * 100)}%`, backgroundColor: r.color ?? color }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Columns({ rows, color }: { rows: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <View className="flex-row items-end" style={{ gap: 12, height: 170 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 170, gap: 5 }}>
          <Text className="text-[12px] font-bold text-gray-900">{r.value}</Text>
          <View style={{ width: '100%', maxWidth: 46, height: Math.max(6, (r.value / max) * 110), borderRadius: 7, backgroundColor: color }} />
          <Text className="text-[11px] text-gray-600" numberOfLines={1}>
            {r.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function CompanyDashboard() {
  const profile = useAuthStore((state) => state.profile);
  const userId = profile?.id;
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const twoColumns = width >= 1100;
  const [mode] = useCalendarMode();

  const balances = useAccountBalances(userId);
  const { data: employees } = useMyEmployees(userId);

  const { data: transactions } = useSupabaseQuery('business_transactions', { filters: userId ? { owner_id: userId } : {}, all: true, enabled: !!userId });
  const { data: customerEntries } = useSupabaseQuery('customer_ledger_entries', { filters: userId ? { owner_id: userId } : {}, all: true, enabled: !!userId });
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', { filters: userId ? { owner_id: userId } : {}, all: true, enabled: !!userId });
  const { data: customers } = useSupabaseQuery('customers', { filters: userId ? { owner_id: userId } : {}, all: true, enabled: !!userId });
  const { data: categories } = useSupabaseQuery('expense_categories', { filters: userId ? { owner_id: userId } : {}, enabled: !!userId });
  const { data: jobs } = useSupabaseQuery('service_requests', { filters: userId ? { reseller_id: userId } : {}, enabled: !!userId });
  const { data: incomingRaw } = useSupabaseQuery('service_requests', { filters: { status: 'pending', origin: 'app' }, enabled: !!userId });
  const { data: orders } = useSupabaseQuery('orders', { filters: userId ? { seller_id: userId } : {}, enabled: !!userId });

  // ---- the last twelve months of sales / purchases / expenses, by the bill's own date ----
  const months = useMemo(() => lastMonths(12, mode), [mode]);
  const series = useMemo(() => {
    const index = new Map(months.map((m, i) => [m.key, i]));
    const sale = months.map(() => 0);
    const purchase = months.map(() => 0);
    const expense = months.map(() => 0);
    for (const t of transactions ?? []) {
      const k = keyOf(t.bill_date ?? t.created_at, mode);
      const i = k != null ? index.get(k) : undefined;
      if (i == null) continue;
      if (t.type === 'sale') sale[i] += t.amount;
      else if (t.type === 'purchase') purchase[i] += t.amount;
      else if (t.type === 'expense') expense[i] += t.amount;
    }
    return { sale, purchase, expense };
  }, [transactions, months, mode]);
  const last = months.length - 1;
  const monthName = months[last]?.label ?? '';

  const change = (series_: number[]): { text?: string; color?: string } => {
    const now = series_[last] ?? 0;
    const before = series_[last - 1] ?? 0;
    if (before < 1) return now > 0 ? { text: 'New this month', color: '#16A34A' } : {};
    const pct = Math.round(((now - before) / before) * 100);
    if (Math.abs(pct) > 999) return { text: `${pct > 0 ? '▲' : '▼'} 999%+ vs last month`, color: pct > 0 ? '#16A34A' : '#DC2626' };
    return { text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs last month`, color: pct >= 0 ? '#16A34A' : '#DC2626' };
  };

  // ---- who owes whom ----
  const owed = useMemo(() => {
    const net = new Map<string, number>();
    (customerEntries ?? []).forEach((e) => net.set(e.customer_id, (net.get(e.customer_id) ?? 0) + (e.entry_type === 'debit' ? e.amount : -e.amount)));
    (vendorEntries ?? []).forEach((e) => net.set(e.vendor_id, (net.get(e.vendor_id) ?? 0) - (e.entry_type === 'debit' ? e.amount : -e.amount)));
    // When each customer last became indebted, to age what they owe.
    const lastDebit = new Map<string, number>();
    (customerEntries ?? []).forEach((e) => {
      if (e.entry_type !== 'debit') return;
      const t = new Date((e.entry_date ?? e.created_at).slice(0, 10)).getTime();
      if (t > (lastDebit.get(e.customer_id) ?? 0)) lastDebit.set(e.customer_id, t);
    });
    const now = Date.now();
    let receivable = 0;
    let payable = 0;
    let debtors = 0;
    const ageing = [0, 0, 0];
    net.forEach((v, id) => {
      if (v > 0.5) {
        receivable += v;
        debtors += 1;
        const days = lastDebit.has(id) ? (now - (lastDebit.get(id) as number)) / DAY_MS : 0;
        ageing[days <= 30 ? 0 : days <= 60 ? 1 : 2] += v;
      } else if (v < -0.5) payable += -v;
    });
    return { receivable, payable, debtors, ageing };
  }, [customerEntries, vendorEntries]);

  // ---- collected against billed this month ----
  const collection = useMemo(() => {
    const thisKey = months[last]?.key;
    let received = 0;
    (customerEntries ?? []).forEach((e) => {
      if (e.entry_type === 'credit' && keyOf(e.entry_date ?? e.created_at, mode) === thisKey) received += e.amount;
    });
    const billed = series.sale[last] ?? 0;
    return { received, billed, percent: billed > 0 ? (received / billed) * 100 : null };
  }, [customerEntries, months, last, mode, series]);

  // ---- expenses by category, last three months ----
  const expenseParts = useMemo(() => {
    const keys = new Set(months.slice(-3).map((m) => m.key));
    const names = new Map((categories ?? []).map((c) => [c.id, c.name]));
    const by = new Map<string, number>();
    for (const t of transactions ?? []) {
      if (t.type !== 'expense') continue;
      const k = keyOf(t.bill_date ?? t.created_at, mode);
      if (k == null || !keys.has(k)) continue;
      const name = (t.expense_category_id && names.get(t.expense_category_id)) || 'Uncategorised';
      by.set(name, (by.get(name) ?? 0) + t.amount);
    }
    const sorted = [...by.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) top.push(['Other', rest]);
    const total = top.reduce((s, [, v]) => s + v, 0);
    return { parts: top.map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] })), total };
  }, [transactions, categories, months, mode]);

  // ---- top customers, last twelve months of sales ----
  const topCustomers = useMemo(() => {
    const keys = new Set(months.map((m) => m.key));
    const names = new Map((customers ?? []).map((c) => [c.id, c.name]));
    const by = new Map<string, number>();
    for (const t of transactions ?? []) {
      if (t.type !== 'sale') continue;
      const k = keyOf(t.bill_date ?? t.created_at, mode);
      if (k == null || !keys.has(k)) continue;
      const who = (t.customer_id && names.get(t.customer_id)) || t.party_name || 'Walk-in';
      by.set(who, (by.get(who) ?? 0) + t.amount);
    }
    const total = [...by.values()].reduce((a, b) => a + b, 0);
    const rows = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { rows, total };
  }, [transactions, customers, months, mode]);

  // ---- jobs ----
  const jobStats = useMemo(() => {
    const now = Date.now();
    let waiting = 0;
    let assigned = 0;
    let working = 0;
    let overdue = 0;
    let toBill = 0;
    let unpaid = 0;
    const done = new Map<string, number>();
    const thisKey = months[last]?.key;
    for (const j of jobs ?? []) {
      if (j.status === 'cancelled') continue;
      const slot = j.scheduled_date
        ? new Date(`${j.scheduled_date}T${j.scheduled_time?.slice(0, 5) ?? '23:59'}`).getTime()
        : new Date(j.created_at).getTime();
      if (j.status !== 'resolved' && now - slot > DAY_MS) overdue += 1;
      if (j.status === 'approved' || (j.status === 'pending' && j.origin === 'reseller')) waiting += 1;
      if (j.status === 'assigned') assigned += 1;
      if (j.status === 'in_progress') working += 1;
      if (j.status === 'resolved' && j.payment_status !== 'paid') unpaid += 1;
      if (j.status === 'resolved' && j.payment_status === 'unpaid') toBill += 1;
      if (j.status === 'resolved' && j.technician_id && keyOf(j.updated_at, mode) === thisKey) {
        done.set(j.technician_id, (done.get(j.technician_id) ?? 0) + 1);
      }
    }
    const newRequests = (incomingRaw ?? []).filter((r) => !r.reseller_id).length;
    const shopOrders = (orders ?? []).filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
    return { waiting, assigned, working, overdue, toBill, unpaid, newRequests, shopOrders, done };
  }, [jobs, incomingRaw, orders, months, last, mode]);

  const team = useMemo(() => {
    const names = new Map((employees ?? []).map((e) => [e.employment.technician_id, e.profile.full_name ?? 'Technician']));
    return [...jobStats.done.entries()]
      .map(([id, value]) => ({ label: (names.get(id) ?? 'Technician').split(' ')[0], value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [jobStats.done, employees]);

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
  const go = (path: string) => router.push(path as never);

  const cashParts = [
    { label: 'Cash', value: Math.max(0, balances.cash), color: PALETTE[2] },
    ...balances.perAccount.map((a, i) => ({ label: a.name, value: Math.max(0, a.balance), color: PALETTE[(i + 3) % PALETTE.length] })),
  ].filter((p) => p.value > 0);
  const cashTotal = cashParts.reduce((s, p) => s + p.value, 0);

  const sc = change(series.sale);
  const pc = change(series.purchase);
  const ec = change(series.expense);
  const monthResult = (series.sale[last] ?? 0) - (series.purchase[last] ?? 0) - (series.expense[last] ?? 0);
  const net = balances.total + owed.receivable - owed.payable;

  const stageRows = [
    { label: 'New app requests', value: jobStats.newRequests, color: '#F59E0B' },
    { label: 'Waiting for a technician', value: jobStats.waiting, color: '#2563EB' },
    { label: 'Assigned', value: jobStats.assigned, color: '#0EA5E9' },
    { label: 'In progress', value: jobStats.working, color: '#16A34A' },
    { label: 'Done, to be billed', value: jobStats.toBill, color: '#7C3AED' },
    { label: 'Awaiting payment', value: jobStats.unpaid, color: '#B45309' },
  ];

  const hero = (
    <LinearGradient colors={['#0F172A', '#1E3A8A', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: wide ? 28 : 20 }}>
      <View className="flex-row flex-wrap items-center" style={{ gap: 18 }}>
        <View className="items-center justify-center overflow-hidden rounded-2xl bg-white" style={{ width: 76, height: 76 }}>
          {logoUrl ? <Image source={{ uri: logoUrl }} style={{ width: 76, height: 76 }} resizeMode="cover" /> : <Ionicons name="business" size={34} color="#1E3A8A" />}
        </View>
        <View style={{ flex: 1, minWidth: 220, gap: 6 }}>
          <Text className="text-[12px] font-semibold tracking-wider text-blue-200">COMPANY OVERVIEW</Text>
          <Text className="text-[26px] font-extrabold text-white" numberOfLines={2}>{company}</Text>
          {profile?.full_name && profile.business_name ? <Text className="text-[13px] text-blue-100">Owner · {profile.full_name}</Text> : null}
          <View className="mt-1 flex-row flex-wrap" style={{ columnGap: 16, rowGap: 6 }}>
            {details.map((d) => (
              <View key={d.text} className="flex-row items-center" style={{ gap: 6 }}>
                <Ionicons name={d.icon} size={14} color="#BFDBFE" />
                <Text className="text-[12.5px] text-blue-50" numberOfLines={1}>{d.text}</Text>
              </View>
            ))}
          </View>
        </View>
        <Pressable onPress={() => go('/(reseller)/company')} className="flex-row items-center rounded-xl px-4 py-2.5" style={{ gap: 6, backgroundColor: 'rgba(255,255,255,0.16)' }}>
          <Ionicons name="create-outline" size={16} color="#FFFFFF" />
          <Text className="text-[13px] font-semibold text-white">Company details</Text>
        </Pressable>
      </View>
      <View className="mt-5 flex-row flex-wrap" style={{ gap: 10 }}>
        {[
          { label: 'Customers', value: String((customers ?? []).length), icon: 'people-outline' as const },
          { label: 'Team members', value: String((employees ?? []).length), icon: 'construct-outline' as const },
          { label: 'Active jobs', value: String(jobStats.waiting + jobStats.assigned + jobStats.working), icon: 'clipboard-outline' as const },
          { label: 'Shop orders open', value: String(jobStats.shopOrders), icon: 'bag-outline' as const },
        ].map((s) => (
          <View key={s.label} className="flex-row items-center rounded-xl px-3.5 py-2.5" style={{ gap: 10, backgroundColor: 'rgba(255,255,255,0.12)', flexGrow: 1, flexBasis: 150 }}>
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

  const kpis = (
    <View className="flex-row flex-wrap" style={{ gap: 14 }}>
      <Kpi label={`Sales · ${monthName}`} value={npr(series.sale[last] ?? 0)} icon="trending-up-outline" color="#047857" tint="#ECFDF5" caption={sc.text} captionColor={sc.color} series={series.sale} onPress={() => go('/(reseller)/sales-report')} />
      <Kpi label={`Purchases · ${monthName}`} value={npr(series.purchase[last] ?? 0)} icon="cart-outline" color="#B45309" tint="#FFFBEB" caption={pc.text} captionColor="#6B7280" series={series.purchase} onPress={() => go('/(reseller)/purchase-report')} />
      <Kpi label={`Expenses · ${monthName}`} value={npr(series.expense[last] ?? 0)} icon="receipt-outline" color="#B91C1C" tint="#FEF2F2" caption={ec.text} captionColor="#6B7280" series={series.expense} onPress={() => go('/(reseller)/expense-report')} />
      <Kpi label={`Result · ${monthName}`} value={npr(monthResult)} icon="calculator-outline" color={monthResult >= 0 ? '#0F766E' : '#B91C1C'} tint="#F0FDFA" caption="Sales − purchases − expenses" />
      <Kpi label="Cash & bank" value={npr(balances.total)} icon="wallet-outline" color="#047857" tint="#ECFDF5" caption={`Cash ${npr(balances.cash)}`} onPress={() => go('/(reseller)/bank-balances')} />
      <Kpi label="To receive" value={npr(owed.receivable)} icon="arrow-down-circle-outline" color="#1D4ED8" tint="#EFF6FF" caption={`From ${owed.debtors} ${owed.debtors === 1 ? 'party' : 'parties'}`} onPress={() => go('/(reseller)/to-receive')} />
      <Kpi label="To pay" value={npr(owed.payable)} icon="arrow-up-circle-outline" color="#B91C1C" tint="#FEF2F2" caption="Owed to vendors" onPress={() => go('/(reseller)/to-give')} />
      <Kpi label="Net position" value={npr(net)} icon="stats-chart-outline" color={net >= 0 ? '#7C3AED' : '#B91C1C'} tint="#F5F3FF" caption="Cash + receivable − payable" captionColor={net < 0 ? '#B91C1C' : '#6B7280'} />
    </View>
  );

  const row = (children: React.ReactNode, ratios: number[] = [1, 1]) => (
    <View className={twoColumns ? 'flex-row' : ''} style={{ gap: 18 }}>
      {(Array.isArray(children) ? children : [children]).map((c, i) => (
        <View key={i} style={twoColumns ? { flex: ratios[i] ?? 1, minWidth: 0 } : { marginBottom: 0 }}>
          {c}
        </View>
      ))}
    </View>
  );

  const trend = (
    <Panel title="Sales and purchases" subtitle="Last 12 months" right={<Legend items={[{ label: 'Sales', color: '#2563EB' }, { label: 'Purchases', color: '#F59E0B' }]} />}>
      <TrendChart labels={months.map((m) => m.label)} sales={series.sale} purchases={series.purchase} />
    </Panel>
  );

  const expenses = (
    <Panel title="Where the money goes" subtitle="Expenses by category · last 3 months">
      {expenseParts.total <= 0 ? (
        <Text className="py-8 text-center text-sm text-gray-400">No expenses recorded in these months</Text>
      ) : (
        <View className="flex-row items-center" style={{ gap: 20 }}>
          <Donut parts={expenseParts.parts} centre={lakh(expenseParts.total)} caption="Total" />
          <View style={{ flex: 1, gap: 9 }}>
            {expenseParts.parts.map((p) => (
              <View key={p.label} className="flex-row items-center" style={{ gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.color }} />
                <Text className="flex-1 text-[13px] text-gray-800" numberOfLines={1}>{p.label}</Text>
                <Text className="text-[13px] font-bold text-gray-900">{Math.round((p.value / expenseParts.total) * 100)}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Panel>
  );

  const money = (
    <Panel title="Money position" subtitle="What you hold, are owed and owe">
      <View className="flex-row flex-wrap" style={{ gap: 18 }}>
        <View style={{ flexGrow: 1, flexBasis: 200 }}>
          <Text className="mb-1 text-[12px] font-semibold text-gray-500">Collected this month</Text>
          {collection.percent == null ? (
            <Text className="py-10 text-center text-sm text-gray-400">No sales billed this month</Text>
          ) : (
            <Gauge percent={collection.percent} label={`${lakh(collection.received)} of ${lakh(collection.billed)}`} />
          )}
        </View>
        <View style={{ flexGrow: 1, flexBasis: 240, gap: 10 }}>
          <Text className="text-[12px] font-semibold text-gray-500">Where the cash is</Text>
          {cashTotal <= 0 ? (
            <Text className="py-6 text-sm text-gray-400">No balance on any account</Text>
          ) : (
            <>
              <View className="flex-row overflow-hidden" style={{ height: 16, borderRadius: 8 }}>
                {cashParts.map((p) => <View key={p.label} style={{ width: `${(p.value / cashTotal) * 100}%`, backgroundColor: p.color }} />)}
              </View>
              {cashParts.map((p) => (
                <View key={p.label} className="flex-row items-center" style={{ gap: 8 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: p.color }} />
                  <Text className="flex-1 text-[13px] text-gray-800" numberOfLines={1}>{p.label}</Text>
                  <Text className="text-[13px] font-bold text-gray-900">{lakh(p.value)}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </View>
    </Panel>
  );

  const ageing = (
    <Panel title="Receivable ageing" subtitle="How long what you are owed has been waiting">
      <View className="flex-row items-end" style={{ gap: 14, height: 150 }}>
        {[
          { label: '0–30 days', value: owed.ageing[0], color: '#0F766E' },
          { label: '31–60 days', value: owed.ageing[1], color: '#F59E0B' },
          { label: '60+ days', value: owed.ageing[2], color: '#DC2626' },
        ].map((b) => {
          const max = Math.max(...owed.ageing, 1);
          return (
            <View key={b.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 150, gap: 5 }}>
              <Text className="text-[12px] font-bold text-gray-900">{lakh(b.value)}</Text>
              <View style={{ width: '100%', height: Math.max(6, (b.value / max) * 90), borderRadius: 8, backgroundColor: b.color }} />
              <Text className="text-[11.5px] text-gray-600">{b.label}</Text>
            </View>
          );
        })}
      </View>
    </Panel>
  );

  const stages = (
    <Panel title="Jobs by stage" right={<Pressable onPress={() => go('/(reseller)/requests')} hitSlop={6}><Text className="text-[12.5px] font-semibold" style={{ color: '#2563EB' }}>Open requests</Text></Pressable>}>
      <HBars color="#2563EB" rows={stageRows.map((r) => ({ label: r.label, value: r.value, display: String(r.value), color: r.color }))} />
      {jobStats.overdue > 0 && (
        <Pressable onPress={() => go('/(reseller)/requests')} className="mt-3.5 flex-row items-center rounded-xl px-3 py-2.5" style={{ gap: 8, backgroundColor: '#FEF2F2' }}>
          <Ionicons name="time-outline" size={16} color="#B91C1C" />
          <Text className="flex-1 text-[13px] font-semibold text-gray-800">{jobStats.overdue} jobs are overdue</Text>
          <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
        </Pressable>
      )}
    </Panel>
  );

  const customersCard = (
    <Panel title="Top customers" subtitle="Sales · last 12 months">
      {topCustomers.rows.length === 0 ? (
        <Text className="py-8 text-center text-sm text-gray-400">No sales recorded yet</Text>
      ) : (
        <View>
          <View className="flex-row border-b border-gray-200 pb-2" style={{ gap: 8 }}>
            <Text className="w-6 text-[11px] font-bold uppercase text-gray-500">#</Text>
            <Text className="flex-1 text-[11px] font-bold uppercase text-gray-500">Customer</Text>
            <Text className="w-24 text-right text-[11px] font-bold uppercase text-gray-500">Sales</Text>
            <Text className="w-14 text-right text-[11px] font-bold uppercase text-gray-500">Share</Text>
          </View>
          {topCustomers.rows.map(([name, value], i) => {
            const pct = topCustomers.total > 0 ? (value / topCustomers.total) * 100 : 0;
            return (
              <View key={name} className="border-b border-gray-100 py-2.5">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="w-6 text-[12px] text-gray-400">{i + 1}</Text>
                  <Text className="flex-1 text-[13px] font-semibold text-gray-800" numberOfLines={1}>{name}</Text>
                  <Text className="w-24 text-right text-[13px] font-semibold text-gray-900">{npr(value)}</Text>
                  <Text className="w-14 text-right text-[13px] font-bold text-blue-700">{pct.toFixed(1)}%</Text>
                </View>
                <View className="ml-8 mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <View style={{ width: `${Math.max(2, pct)}%`, height: 6, backgroundColor: '#2563EB' }} />
                </View>
              </View>
            );
          })}
          <View className="flex-row pt-2.5" style={{ gap: 8 }}>
            <Text className="w-6" />
            <Text className="flex-1 text-[12px] font-bold text-gray-600">All customers</Text>
            <Text className="w-24 text-right text-[12px] font-bold text-gray-900">{npr(topCustomers.total)}</Text>
            <Text className="w-14 text-right text-[12px] font-bold text-gray-600">100%</Text>
          </View>
        </View>
      )}
    </Panel>
  );

  const teamCard = (
    <Panel title="Team" subtitle={`Jobs finished · ${monthName}`}>
      {team.length === 0 ? (
        <Text className="py-8 text-center text-sm text-gray-400">No finished jobs this month yet</Text>
      ) : (
        <Columns rows={team} color="#2563EB" />
      )}
    </Panel>
  );

  const quick = (
    <Panel title="Quick actions">
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
          <Pressable key={a.label} onPress={() => go(a.path)} className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5" style={{ gap: 8 }}>
            <Ionicons name={a.icon} size={16} color="#1E3A8A" />
            <Text className="text-[13px] font-semibold text-gray-800">{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </Panel>
  );

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: '#F6F7FB' }} contentContainerStyle={{ padding: wide ? 28 : 14, gap: 18, paddingBottom: 60 }}>
      {hero}
      {kpis}
      {row([trend, expenses], [1.6, 1])}
      {row([money, ageing], [1.3, 1])}
      {row([stages, teamCard], [1, 1])}
      {row([<RecentActivityCard key="recent" basePath="/(reseller)" />, customersCard], [1.4, 1])}
      {quick}
    </ScrollView>
  );
}

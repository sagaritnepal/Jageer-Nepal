// app/(reseller)/company-dashboard.tsx
//
// The reseller's whole company in pictures: who the business is, what it holds (cash and bank),
// what is owed to it and by it, how sales, purchases and expenses have moved over the year, where
// every job stands, who the best customers are and how the team is doing. Everything is read from
// data the app already keeps - nothing is typed on this page. Months follow the AD / BS toggle.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Modal, useWindowDimensions, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Polyline, Polygon, Line, Stop, Text as SvgText } from 'react-native-svg';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { useAccountBalances } from '../../lib/hooks/useAccountBalances';
import { useMyEmployees } from '../../lib/hooks/useTechnicianEmployment';
import { useCalendarMode } from '../../lib/hooks/useCalendarMode';
import { useRequestsStageStore } from '../../lib/hooks/useRequestsStage';
import { useScreenHeader } from '../../lib/hooks/useScreenHeader';
import { adStringToBs, bsToAdString, bsDaysInMonth, numericDateLabel, toBsHistoryLabel, BS_MONTHS } from '../../lib/utils/nepaliDate';
import { ticketLabel } from '../../lib/utils/ticket';
import { computeOwed } from '../../lib/utils/receivableAgeing';
import { withFrom } from '../../lib/hooks/useCameFrom';
import { localTodayIso } from '../../lib/utils/localDate';
import { newJobHref } from '../../lib/utils/newJobHref';
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

// ---------- reporting period ----------
type PeriodKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_fy' | 'last_fy';
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_fy', label: 'This fiscal year' },
  { key: 'last_fy', label: 'Last fiscal year' },
];
type Range = { from: string; to: string };
const isoOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const addDays = (iso: string, n: number) => isoOf(new Date(utc(iso).getTime() + n * DAY_MS));
/** Date range of a period, `back` whole periods earlier (back = 1 gives the one it is compared with).
 * Weeks run Sunday-Saturday, months follow the AD / BS toggle, a fiscal year is Shrawan-Ashadh. */
function periodRange(key: PeriodKey, mode: 'bs' | 'ad', back = 0): Range {
  const today = localTodayIso();
  if (key === 'today' || key === 'yesterday') {
    const d = addDays(today, -(key === 'yesterday' ? 1 : 0) - back);
    return { from: d, to: d };
  }
  if (key === 'this_week' || key === 'last_week') {
    const sunday = addDays(today, -utc(today).getUTCDay() - 7 * ((key === 'last_week' ? 1 : 0) + back));
    return { from: sunday, to: addDays(sunday, 6) };
  }
  const bs = adStringToBs(today);
  if (key === 'this_month' || key === 'last_month') {
    const shift = (key === 'last_month' ? 1 : 0) + back;
    if (mode === 'bs' && bs) {
      let y = bs.year;
      let m = bs.month - shift;
      while (m < 0) { m += 12; y -= 1; }
      return { from: bsToAdString(y, m, 1), to: bsToAdString(y, m, bsDaysInMonth(y, m)) };
    }
    const first = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - shift, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    return { from: isoOf(first), to: isoOf(lastDay) };
  }
  // fiscal year: Shrawan 1 (BS month index 3) to the last day of Ashadh
  const shift = (key === 'last_fy' ? 1 : 0) + back;
  const startYear = (bs ? (bs.month >= 3 ? bs.year : bs.year - 1) : Number(today.slice(0, 4))) - shift;
  return { from: bsToAdString(startYear, 3, 1), to: bsToAdString(startYear + 1, 2, bsDaysInMonth(startYear + 1, 2)) };
}
const inRange = (date: string | null | undefined, r: Range) => {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= r.from && d <= r.to;
};

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

type TableRow = { label: string; amount: number; share: number | null; color: string; count?: number; note?: string; onPress?: () => void };
/** The table style used by Top customers: header, a row per item with a share bar, and a total line. */
function ShareTable({ firstHead, rows, total, showCount, shareHead = 'Share' }: { firstHead: string; rows: TableRow[]; total?: { label: string; amount: number; count?: number; share?: string; onPress?: () => void }; showCount?: boolean; shareHead?: string }) {
  return (
    <View>
      <View className="flex-row border-b border-gray-200 pb-2" style={{ gap: 8 }}>
        <Text className="flex-1 text-[11px] font-bold uppercase text-gray-500">{firstHead}</Text>
        {showCount && <Text className="w-12 text-right text-[11px] font-bold uppercase text-gray-500">Jobs</Text>}
        <Text className="w-28 text-right text-[11px] font-bold uppercase text-gray-500">Amount</Text>
        <Text className="w-14 text-right text-[11px] font-bold uppercase text-gray-500">{shareHead}</Text>
      </View>
      {rows.map((r) => (
        <Pressable key={r.label} onPress={r.onPress} disabled={!r.onPress} className="border-b border-gray-100 py-2.5" style={({ hovered }: any) => (hovered && r.onPress ? { backgroundColor: '#F8FAFC' } : null)}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {/* the name and its colour bar share one column, so the bar stops where the NPR column starts */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: r.color }} />
                <Text className="flex-1 text-[13px] font-semibold text-gray-800" numberOfLines={1}>{r.label}</Text>
              </View>
              <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100" style={{ marginLeft: 17 }}>
                <View style={{ width: `${Math.min(100, Math.max(r.share ? 2 : 0, r.share ?? 0))}%`, height: 6, backgroundColor: r.color }} />
              </View>
              {!!r.note && <Text className="mt-1 text-[11px] text-gray-500" style={{ marginLeft: 17 }}>{r.note}</Text>}
            </View>
            {showCount && <Text className="w-12 text-right text-[13px] text-gray-600">{r.count ?? 0}</Text>}
            <Text className="w-28 text-right text-[13px] font-semibold text-gray-900">{npr(r.amount)}</Text>
            <Text className="w-14 text-right text-[13px] font-bold text-blue-700">{r.share == null ? '–' : `${r.share.toFixed(1)}%`}</Text>
          </View>
        </Pressable>
      ))}
      {total && (
        <Pressable onPress={total.onPress} disabled={!total.onPress} className="flex-row pt-2.5" style={{ gap: 8 }}>
          <Text className="flex-1 text-[12px] font-bold text-gray-600">{total.label}</Text>
          {showCount && <Text className="w-12 text-right text-[12px] font-bold text-gray-700">{total.count ?? 0}</Text>}
          <Text className="w-28 text-right text-[12px] font-bold text-gray-900">{npr(total.amount)}</Text>
          <Text className="w-14 text-right text-[12px] font-bold text-gray-600">{total.share ?? '100%'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Panel({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    // flexGrow: two cards side by side are as tall as the taller one, not left at their own heights.
    <View className="rounded-2xl bg-white p-5" style={[{ minWidth: 0, flexGrow: 1 }, CARD_SHADOW]}>
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

/** Props that make a chart shape open its page when pressed. On the web react-native-svg turns an
 * `onPress` into React Native touch handlers that the browser does not know, and logs "Unknown event
 * handler property" for every shape that has one - so there the shape gets a plain click listener. */
function pressable(onPress?: () => void): any {
  if (!onPress) return {};
  if (Platform.OS !== 'web') return { onPress };
  return {
    ref: (shape: any) => {
      const el: SVGElement | null | undefined = shape?.elementRef?.current;
      if (!el) return;
      el.onclick = () => onPress();
      el.style.cursor = 'pointer';
    },
  };
}

/** Two lines over twelve months, sales filled. */
function TrendChart({ labels, sales, purchases, onSales, onPurchases }: { labels: string[]; sales: number[]; purchases: number[]; onSales?: () => void; onPurchases?: () => void }) {
  const W = 760;
  const H = 320;
  const left = 46;
  const right = 18;
  const top = 26;
  const bottom = 32;
  const rawMax = Math.max(...sales, ...purchases, 1);
  // round the top of the scale up to a tidy number (every step divides by 4) so the grid reads cleanly
  const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const max = ([1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].map((m) => m * mag).find((v) => v >= rawMax) ?? rawMax) || 1;
  const n = Math.max(labels.length - 1, 1);
  const x = (i: number) => left + (i / n) * (W - left - right);
  const y = (v: number) => top + (1 - v / max) * (H - top - bottom);
  const pts = (vs: number[]) => vs.map((v, i) => ({ x: x(i), y: y(v) }));
  // smooth curve through the points (Catmull-Rom turned into cubic beziers)
  const smooth = (vs: number[]) => {
    const p = pts(vs);
    if (p.length < 2) return '';
    let d = `M${p[0].x},${p[0].y}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] ?? p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = Math.min(H - bottom, Math.max(top, p1.y + (p2.y - p0.y) / 6));
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = Math.min(H - bottom, Math.max(top, p2.y - (p3.y - p1.y) / 6));
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
    }
    return d;
  };
  const salesLine = smooth(sales);
  const purchaseLine = smooth(purchases);
  const area = salesLine ? `${salesLine} L${x(sales.length - 1)},${H - bottom} L${x(0)},${H - bottom} Z` : '';
  const grid = [0, 1, 2, 3, 4];
  const bestIdx = sales.indexOf(Math.max(...sales));
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <SvgGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2563EB" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#2563EB" stopOpacity={0.02} />
        </SvgGradient>
      </Defs>
      {grid.map((g) => {
        const gy = top + (g / 4) * (H - top - bottom);
        return (
          <G key={g}>
            <Line x1={left} x2={W - right} y1={gy} y2={gy} stroke={g === 4 ? '#CBD5E1' : '#E5E7EB'} strokeWidth={1} strokeDasharray={g === 4 ? undefined : '4 5'} />
            <SvgText x={left - 8} y={gy + 4} fontSize={11} fill="#6B7280" textAnchor="end">{lakh(max * (1 - g / 4))}</SvgText>
          </G>
        );
      })}
      {area ? <Path d={area} fill="url(#salesFill)" /> : null}
      <Path d={purchaseLine} fill="none" stroke="#F59E0B" strokeWidth={2.5} strokeLinecap="round" {...pressable(onPurchases)} />
      <Path d={salesLine} fill="none" stroke="#2563EB" strokeWidth={3.5} strokeLinecap="round" {...pressable(onSales)} />
      {purchases.map((v, i) => (
        <Circle key={`p${i}`} cx={x(i)} cy={y(v)} r={5} fill="#FFFFFF" stroke="#F59E0B" strokeWidth={2} {...pressable(onPurchases)} />
      ))}
      {sales.map((v, i) => {
        const best = i === bestIdx && v > 0;
        const lastPoint = i === sales.length - 1;
        const pv = purchases[i] ?? 0;
        // whichever line is higher keeps its figure above the dot, the other goes below it
        const purchaseHigher = pv > v;
        const salesY = purchaseHigher ? y(v) + 19 : y(v) - 11;
        const purchaseY = purchaseHigher ? y(pv) - 11 : y(pv) + 19;
        return (
          <G key={`s${i}`}>
            <Circle cx={x(i)} cy={y(v)} r={best || lastPoint ? 7 : 5.5} fill="#FFFFFF" stroke="#2563EB" strokeWidth={3} {...pressable(onSales)} />
            {v > 0 && (
              <SvgText
                x={x(i)}
                y={salesY}
                fontSize={best || lastPoint ? 12 : 10.5}
                fontWeight={best || lastPoint ? '700' : '600'}
                fill={best || lastPoint ? '#1D4ED8' : '#374151'}
                textAnchor="middle"
              >
                {lakh(v)}
              </SvgText>
            )}
            {pv > 0 && (
              <SvgText x={x(i)} y={purchaseY} fontSize={10.5} fontWeight="600" fill="#B45309" textAnchor="middle">
                {lakh(pv)}
              </SvgText>
            )}
          </G>
        );
      })}
      {labels.map((l, i) => (
        <SvgText key={`${l}${i}`} x={x(i)} y={H - 10} fontSize={11.5} fill="#6B7280" textAnchor="middle">
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

/** One bar for each account: green to the right of the zero line for money in it, red to the left for money
 * it is short of - so a minus balance is as plain as a plus one. */
function BalanceBars({ rows, onPress }: { rows: { label: string; value: number }[]; onPress?: () => void }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const hasMinus = rows.some((r) => r.value < 0);
  return (
    <View style={{ gap: 14 }}>
      {rows.map((r) => {
        const plus = r.value >= 0;
        const color = plus ? '#16A34A' : '#DC2626';
        const share = `${Math.max(3, (Math.abs(r.value) / max) * 100)}%` as `${number}%`;
        return (
          <Pressable key={r.label} onPress={onPress} style={{ gap: 6 }}>
            <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
              <Text className="flex-1 text-[13px] font-semibold text-gray-800" numberOfLines={1}>{r.label}</Text>
              <Text className="text-[13px] font-extrabold" style={{ color: plus ? '#15803D' : '#B91C1C' }}>
                {plus ? '' : '−'}
                {npr(Math.abs(r.value))}
              </Text>
            </View>
            {hasMinus ? (
              <View className="flex-row" style={{ height: 14 }}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  {!plus && <View style={{ width: share, height: 14, backgroundColor: color, borderTopLeftRadius: 7, borderBottomLeftRadius: 7 }} />}
                </View>
                <View style={{ width: 2, backgroundColor: '#9CA3AF' }} />
                <View style={{ flex: 1 }}>
                  {plus && <View style={{ width: share, height: 14, backgroundColor: color, borderTopRightRadius: 7, borderBottomRightRadius: 7 }} />}
                </View>
              </View>
            ) : (
              <View style={{ height: 14, borderRadius: 7, backgroundColor: '#F3F4F6' }}>
                <View style={{ width: share, height: 14, borderRadius: 7, backgroundColor: color }} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
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

export default function CompanyDashboard() {
  const profile = useAuthStore((state) => state.profile);
  const userId = profile?.id;
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const twoColumns = width >= 1100;
  const [mode] = useCalendarMode();
  const [period, setPeriod] = useState<PeriodKey>('this_fy');
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? 'This fiscal year';
  const range = useMemo(() => periodRange(period, mode), [period, mode]);
  const prevRange = useMemo(() => periodRange(period, mode, 1), [period, mode]);

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

  // ---- the chosen period against the one before it ----
  const totals = useMemo(() => {
    const now = { sale: 0, purchase: 0, expense: 0 };
    const before = { sale: 0, purchase: 0, expense: 0 };
    for (const t of transactions ?? []) {
      if (t.type !== 'sale' && t.type !== 'purchase' && t.type !== 'expense') continue;
      const d = t.bill_date ?? t.created_at;
      if (inRange(d, range)) now[t.type] += t.amount;
      else if (inRange(d, prevRange)) before[t.type] += t.amount;
    }
    return { now, before };
  }, [transactions, range, prevRange]);

  const change = (now: number, before: number): { text?: string; color?: string } => {
    if (before < 1) return now > 0 ? { text: 'Nothing in the previous period', color: '#16A34A' } : {};
    const pct = Math.round(((now - before) / before) * 100);
    const arrow = pct >= 0 ? '▲' : '▼';
    const shown = Math.abs(pct) > 999 ? '999%+' : `${Math.abs(pct)}%`;
    return { text: `${arrow} ${shown} vs previous period`, color: pct >= 0 ? '#16A34A' : '#DC2626' };
  };

  // ---- who owes whom (the Ageing Report reads the same calculation) ----
  const owed = useMemo(() => computeOwed(customerEntries ?? [], vendorEntries ?? []), [customerEntries, vendorEntries]);

  // ---- collected against billed in the period ----
  const collection = useMemo(() => {
    let received = 0;
    (customerEntries ?? []).forEach((e) => {
      if (e.entry_type === 'credit' && inRange(e.entry_date ?? e.created_at, range)) received += e.amount;
    });
    const billed = totals.now.sale;
    return { received, billed, percent: billed > 0 ? (received / billed) * 100 : null };
  }, [customerEntries, range, totals]);

  // ---- paid out in the period: what the Total Paid page adds up (expenses, payments out to a customer, payments to a vendor) ----
  const paidOut = useMemo(() => {
    let total = 0;
    for (const t of transactions ?? []) {
      if (t.type === 'expense' && inRange(t.bill_date ?? t.created_at, range)) total += t.amount;
    }
    for (const e of customerEntries ?? []) {
      if (e.entry_type === 'debit' && e.source === 'manual' && inRange(e.entry_date ?? e.created_at, range)) total += e.amount;
    }
    for (const e of vendorEntries ?? []) {
      if (e.entry_type === 'credit' && inRange(e.entry_date ?? e.created_at, range)) total += e.amount;
    }
    return total;
  }, [transactions, customerEntries, vendorEntries, range]);

  // ---- money received and money paid out, month by month (the same sources as the Total Received / Total Paid pages) ----
  const flow = useMemo(() => {
    const index = new Map(months.map((m, i) => [m.key, i]));
    const received = months.map(() => 0);
    const paid = months.map(() => 0);
    const add = (list: number[], date: string, amount: number) => {
      const k = keyOf(date, mode);
      const i = k != null ? index.get(k) : undefined;
      if (i != null) list[i] += amount;
    };
    for (const e of customerEntries ?? []) {
      if (e.entry_type === 'credit') add(received, e.entry_date ?? e.created_at, e.amount);
      else if (e.source === 'manual') add(paid, e.entry_date ?? e.created_at, e.amount);
    }
    for (const t of transactions ?? []) if (t.type === 'expense') add(paid, t.bill_date ?? t.created_at, t.amount);
    for (const e of vendorEntries ?? []) if (e.entry_type === 'credit') add(paid, e.entry_date ?? e.created_at, e.amount);
    return { received, paid };
  }, [customerEntries, vendorEntries, transactions, months, mode]);

  // ---- expenses by category in the period ----
  const expenseParts = useMemo(() => {
    const names = new Map((categories ?? []).map((c) => [c.id, c.name]));
    const by = new Map<string, number>();
    for (const t of transactions ?? []) {
      if (t.type !== 'expense') continue;
      if (!inRange(t.bill_date ?? t.created_at, range)) continue;
      const name = (t.expense_category_id && names.get(t.expense_category_id)) || 'Uncategorised';
      by.set(name, (by.get(name) ?? 0) + t.amount);
    }
    const sorted = [...by.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) top.push(['Other', rest]);
    const total = top.reduce((s, [, v]) => s + v, 0);
    return { parts: top.map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] })), total };
  }, [transactions, categories, range]);

  // ---- top customers by sales in the period ----
  const topCustomers = useMemo(() => {
    const names = new Map((customers ?? []).map((c) => [c.id, c.name]));
    const by = new Map<string, number>();
    const ids = new Map<string, string>();
    for (const t of transactions ?? []) {
      if (t.type !== 'sale') continue;
      if (!inRange(t.bill_date ?? t.created_at, range)) continue;
      const who = (t.customer_id && names.get(t.customer_id)) || t.party_name || 'Walk-in';
      by.set(who, (by.get(who) ?? 0) + t.amount);
      if (t.customer_id) ids.set(who, t.customer_id);
    }
    const total = [...by.values()].reduce((a, b) => a + b, 0);
    const rows = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { rows, total, ids };
  }, [transactions, customers, range]);

  // ---- jobs ----
  // The jobs a bill has been made for - a finished one is "billed" from then on (as on the Requests page).
  const billedJobs = useMemo(
    () =>
      new Set(
        (transactions ?? [])
          .filter((t) => t.source_type === 'service_request_bill')
          .flatMap((t) => [...(t.source_id ? [t.source_id] : []), ...(t.source_job_ids ?? [])])
      ),
    [transactions]
  );
  const jobStats = useMemo(() => {
    const now = Date.now();
    let waiting = 0;
    let assigned = 0;
    let working = 0;
    let overdue = 0;
    const money = { newRequests: 0, pending: 0, waiting: 0, assigned: 0, working: 0, toBill: 0, unpaid: 0 };
    let pending = 0;
    let toBill = 0;
    let unpaid = 0;
    for (const j of jobs ?? []) {
      if (j.status === 'cancelled') continue;
      const slot = j.scheduled_date
        ? new Date(`${j.scheduled_date}T${j.scheduled_time?.slice(0, 5) ?? '23:59'}`).getTime()
        : new Date(j.created_at).getTime();
      if (j.status !== 'resolved' && now - slot > DAY_MS) overdue += 1;
      const price = Number(j.quoted_price) || 0;
      if (j.status === 'approved' || (j.status === 'pending' && j.origin === 'reseller')) { waiting += 1; money.waiting += price; }
      if (j.status === 'assigned') { assigned += 1; money.assigned += price; }
      if (j.status === 'in_progress') { working += 1; money.working += price; }
      // An app customer's job I have taken: it still needs a quote, or the customer has not answered it.
      if (j.status === 'quoted' || (j.status === 'pending' && j.origin === 'app')) { pending += 1; money.pending += price; }
      // Done and not paid: not billed yet, or billed (a bill made for it, or part paid) and waiting for the money.
      if (j.status === 'resolved' && j.payment_status !== 'paid') {
        if (j.payment_status === 'partial' || billedJobs.has(j.id)) { unpaid += 1; money.unpaid += price; }
        else { toBill += 1; money.toBill += price; }
      }
    }
    const incoming = (incomingRaw ?? []).filter((r) => !r.reseller_id);
    const newRequests = incoming.length;
    money.newRequests = incoming.reduce((sum, r) => sum + (Number(r.quoted_price) || 0), 0);
    const shopOrders = (orders ?? []).filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
    return { pending, waiting, assigned, working, overdue, toBill, unpaid, newRequests, shopOrders, money };
  }, [jobs, incomingRaw, orders, billedJobs]);

  // The latest change on each job (its last update, whatever it was), newest first.
  const updates = useMemo(() => {
    const names = new Map((employees ?? []).map((e) => [e.employment.technician_id, e.profile.full_name ?? 'Technician']));
    const who = (id: string | null) => (id ? (names.get(id) ?? 'a technician') : null);
    const describe = (j: NonNullable<typeof jobs>[number]): { text: string; color: string; icon: keyof typeof Ionicons.glyphMap } => {
      switch (j.status) {
        case 'pending':
          return { text: j.origin === 'app' ? 'Request taken - needs a quote' : 'Job added', color: '#F59E0B', icon: 'download-outline' };
        case 'quoted':
          return { text: 'Quote sent - waiting for the customer', color: '#F59E0B', icon: 'pricetag-outline' };
        case 'approved':
          return { text: 'Approved - waiting for a technician', color: '#2563EB', icon: 'briefcase-outline' };
        case 'assigned':
          return { text: j.technician_id ? `Given to ${who(j.technician_id)} - waiting for them to accept` : 'Open to the team', color: '#0EA5E9', icon: 'person-add-outline' };
        case 'in_progress':
          return { text: j.hold_status === 'on_hold' ? 'On hold' : `${who(j.technician_id) ?? 'A technician'} accepted - working on it`, color: '#16A34A', icon: 'build-outline' };
        case 'resolved':
          return {
            text: j.payment_status === 'paid' ? 'Completed and paid' : billedJobs.has(j.id) || j.payment_status === 'partial' ? 'Completed and billed' : 'Completed - not billed yet',
            color: '#7C3AED',
            icon: 'checkmark-circle-outline',
          };
        default:
          return { text: 'Cancelled', color: '#9CA3AF', icon: 'close-circle-outline' };
      }
    };
    return [...(jobs ?? [])]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 7)
      .map((j) => ({ job: j, ...describe(j) }));
  }, [jobs, employees, billedJobs]);

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
  const setStage = useRequestsStageStore((state) => state.setStage);
  const openStage = (stage: string) => {
    setStage(stage);
    router.push('/(reseller)/requests' as never);
  };

  // Every account that holds an amount - cash in hand and each bank - the minus ones too, biggest first.
  const accountBars = [
    { label: 'Cash in hand', value: balances.cash },
    ...balances.perAccount.map((a) => ({ label: a.name, value: a.balance })),
  ]
    .filter((a) => Math.round(a.value) !== 0)
    .sort((a, b) => b.value - a.value);

  const sc = change(totals.now.sale, totals.before.sale);
  const pc = change(totals.now.purchase, totals.before.purchase);
  const ec = change(totals.now.expense, totals.before.expense);
  const monthResult = totals.now.sale - totals.now.purchase - totals.now.expense;
  const net = balances.total + owed.receivable - owed.payable;

  // The stages a job passes through, in order - and, once it is done, Billed and Paid as on the Requests page
  // (a done job is counted once: not billed yet, or billed and waiting for the money).
  const stageRows = [
    { label: 'New app requests', value: jobStats.newRequests, amount: jobStats.money.newRequests, color: '#F59E0B' , stage: 'requests' },
    { label: 'Pending - quote / approval', value: jobStats.pending, amount: jobStats.money.pending, color: '#FBBF24' , stage: 'requests' },
    { label: 'Waiting for a technician', value: jobStats.waiting, amount: jobStats.money.waiting, color: '#2563EB' , stage: 'my_jobs' },
    { label: 'Assigned', value: jobStats.assigned, amount: jobStats.money.assigned, color: '#0EA5E9' , stage: 'my_jobs' },
    { label: 'In progress', value: jobStats.working, amount: jobStats.money.working, color: '#16A34A' , stage: 'my_jobs' },
    { label: 'Done, not billed yet', value: jobStats.toBill, amount: jobStats.money.toBill, color: '#7C3AED' , stage: 'completed' },
    { label: 'Billed, waiting for payment', value: jobStats.unpaid, amount: jobStats.money.unpaid, color: '#B45309' , stage: 'completed' },
  ];
  const stageTotal = stageRows.reduce((s_, r) => s_ + r.value, 0);
  const stageAmount = stageRows.reduce((s_, r) => s_ + r.amount, 0);

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
          { label: 'Customers', value: String((customers ?? []).length), icon: 'people-outline' as const, path: '/(reseller)/customers' },
          { label: 'Team members', value: String((employees ?? []).length), icon: 'construct-outline' as const, path: '/(reseller)/employees' },
          { label: 'Active jobs', value: String(jobStats.waiting + jobStats.assigned + jobStats.working), icon: 'clipboard-outline' as const, path: '/(reseller)/requests' },
          { label: 'Shop orders open', value: String(jobStats.shopOrders), icon: 'bag-outline' as const, path: '/(reseller)/requests' },
        ].map((s) => (
          <Pressable key={s.label} onPress={() => go(s.path)} className="flex-row items-center rounded-xl px-3.5 py-2.5" style={{ gap: 10, backgroundColor: 'rgba(255,255,255,0.12)', flexGrow: 1, flexBasis: 150 }}>
            <Ionicons name={s.icon} size={18} color="#BFDBFE" />
            <View>
              <Text className="text-[18px] font-extrabold text-white">{s.value}</Text>
              <Text className="text-[11.5px] text-blue-100">{s.label}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </LinearGradient>
  );

  // The dropdown lives in the top bar beside the AD / BS switch; its list opens in a modal so no
  // card can paint over it.
  useScreenHeader(
    {
      headerRight: () => (
        <Pressable onPress={() => setPeriodOpen(true)} className="flex-row items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5" style={{ gap: 6 }}>
          <Ionicons name="calendar-outline" size={15} color="#1E3A8A" />
          <Text className="text-[12.5px] font-semibold text-gray-800">{periodLabel}</Text>
          <Ionicons name="chevron-down" size={13} color="#6B7280" />
        </Pressable>
      ),
    },
    [periodLabel]
  );

  const periodMenu = (
    <Modal visible={periodOpen} transparent animationType="fade" onRequestClose={() => setPeriodOpen(false)}>
      <Pressable style={{ flex: 1 }} onPress={() => setPeriodOpen(false)}>
        <View className="rounded-xl border border-gray-200 bg-white py-1" style={[{ position: 'absolute', top: 64, right: wide ? 150 : 12, minWidth: 200 }, CARD_SHADOW]}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => { setPeriod(p.key); setPeriodOpen(false); }}
              className="flex-row items-center px-3.5 py-2.5"
              style={{ gap: 8, backgroundColor: p.key === period ? '#EFF6FF' : undefined }}
            >
              <Text className="flex-1 text-[13px]" style={{ color: p.key === period ? '#1D4ED8' : '#1F2937', fontWeight: p.key === period ? '700' : '500' }}>{p.label}</Text>
              {p.key === period && <Ionicons name="checkmark" size={15} color="#1D4ED8" />}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );

  const periodBar = (
    <Text className="text-right text-[12px] text-gray-500">
      {periodLabel} · {range.from === range.to ? numericDateLabel(range.from) : `${numericDateLabel(range.from)} → ${numericDateLabel(range.to)}`}
    </Text>
  );

  const kpiGroup = (title: string, tiles: React.ReactNode) => (
    <View style={{ gap: 8 }}>
      <Text className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">{title}</Text>
      <View className="flex-row flex-wrap" style={{ gap: 14 }}>
        {tiles}
      </View>
    </View>
  );

  const kpis = (
    <View style={{ gap: 18 }}>
      {kpiGroup(
        `The period · ${periodLabel}`,
        <>
      <Kpi label={`Sales · ${periodLabel}`} value={npr(totals.now.sale)} icon="trending-up-outline" color="#047857" tint="#ECFDF5" caption={sc.text} captionColor={sc.color} series={series.sale} onPress={() => go('/(reseller)/sales-report')} />
      <Kpi label={`Purchases · ${periodLabel}`} value={npr(totals.now.purchase)} icon="cart-outline" color="#B45309" tint="#FFFBEB" caption={pc.text} captionColor="#6B7280" series={series.purchase} onPress={() => go('/(reseller)/purchase-report')} />
      <Kpi label={`Expenses · ${periodLabel}`} value={npr(totals.now.expense)} icon="receipt-outline" color="#B91C1C" tint="#FEF2F2" caption={ec.text} captionColor="#6B7280" series={series.expense} onPress={() => go('/(reseller)/expense-report')} />
      <Kpi label={`Result · ${periodLabel}`} value={npr(monthResult)} icon="calculator-outline" color={monthResult >= 0 ? '#0F766E' : '#B91C1C'} tint="#F0FDFA" caption="Sales − purchases − expenses" onPress={() => go('/(reseller)/report')} />
        </>
      )}
      {kpiGroup(
        'Money right now',
        <>
      <Kpi label="Cash & bank" value={npr(balances.total)} icon="wallet-outline" color="#047857" tint="#ECFDF5" caption={`Cash ${npr(balances.cash)}`} onPress={() => go('/(reseller)/bank-balances')} />
      <Kpi label="To receive" value={npr(owed.receivable)} icon="arrow-down-circle-outline" color="#1D4ED8" tint="#EFF6FF" caption={`From ${owed.debtors} ${owed.debtors === 1 ? 'party' : 'parties'}`} onPress={() => go('/(reseller)/to-receive')} />
      <Kpi label="To pay" value={npr(owed.payable)} icon="arrow-up-circle-outline" color="#B91C1C" tint="#FEF2F2" caption="Owed to vendors" onPress={() => go('/(reseller)/to-give')} />
      <Kpi label="Net position" value={npr(net)} icon="stats-chart-outline" color={net >= 0 ? '#7C3AED' : '#B91C1C'} tint="#F5F3FF" caption="Cash + receivable − payable" captionColor={net < 0 ? '#B91C1C' : '#6B7280'} onPress={() => go('/(reseller)/bank-balances')} />
        </>
      )}
    </View>
  );

  /** A heading that opens a group of cards. */
  const section = (title: string) => (
    <View className="flex-row items-center" style={{ gap: 12, marginTop: 6 }}>
      <Text className="text-[13px] font-extrabold uppercase tracking-wider text-gray-700">{title}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
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
      <TrendChart labels={months.map((m) => m.label)} sales={series.sale} purchases={series.purchase} onSales={() => go('/(reseller)/sales-report')} onPurchases={() => go('/(reseller)/purchase-report')} />
    </Panel>
  );

  const expenses = (
    <Panel title="Expense Diagram" subtitle={`Expenses by category · ${periodLabel}`}>
      {expenseParts.total <= 0 ? (
        <Text className="py-8 text-center text-sm text-gray-400">No expenses recorded in these months</Text>
      ) : (
        <View className="flex-row items-center" style={{ gap: 20 }}>
          <Pressable onPress={() => go('/(reseller)/expense-report')}>
            <Donut parts={expenseParts.parts} centre={lakh(expenseParts.total)} caption="Total" />
          </Pressable>
          <View style={{ flex: 1, gap: 9 }}>
            {expenseParts.parts.map((p) => (
              <Pressable key={p.label} onPress={() => go('/(reseller)/expense-report')} className="flex-row items-center" style={{ gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.color }} />
                <Text className="flex-1 text-[13px] text-gray-800" numberOfLines={1}>{p.label}</Text>
                <Text className="text-[13px] font-bold text-gray-900">{Math.round((p.value / expenseParts.total) * 100)}%</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Panel>
  );

  // Money position, in two cards: what is in the bank (cash in hand and every account), and what is owed
  // and what has moved (to receive, to pay, received, paid).
  const banksCard = (
    <Panel
      title="Balance in all banks"
      subtitle="Cash in hand and every bank account with a balance"
      right={<Pressable onPress={() => go('/(reseller)/bank-balances')} hitSlop={6}><Text className="text-[12.5px] font-semibold" style={{ color: '#2563EB' }}>Open balances</Text></Pressable>}
    >
      <View className="mb-5">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-gray-500">In cash and banks</Text>
        <Text className="mt-1 text-[28px] font-extrabold" style={{ color: balances.total >= 0 ? '#15803D' : '#B91C1C' }}>
          {balances.total < 0 ? '−' : ''}
          {npr(Math.abs(balances.total))}
        </Text>
        <View className="mt-1.5 flex-row flex-wrap items-center" style={{ gap: 14 }}>
          <View className="flex-row items-center" style={{ gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: '#16A34A' }} />
            <Text className="text-[11.5px] text-gray-600">In the plus</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: '#DC2626' }} />
            <Text className="text-[11.5px] text-gray-600">In the minus</Text>
          </View>
        </View>
      </View>
      {accountBars.length === 0 ? (
        <Text className="py-3 text-sm text-gray-400">No balance on any account</Text>
      ) : (
        <BalanceBars rows={accountBars} onPress={() => go('/(reseller)/bank-balances')} />
      )}
    </Panel>
  );

  const moneyTile = (t: { label: string; value: number; caption: string; icon: keyof typeof Ionicons.glyphMap; color: string; tint: string; onPress: () => void }) => (
    <Pressable
      key={t.label}
      onPress={t.onPress}
      className="rounded-xl border border-gray-100 p-3.5"
      style={{ flexGrow: 1, flexBasis: 170, minWidth: 150, backgroundColor: t.tint, gap: 6 }}
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <View className="h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: '#FFFFFF' }}>
          <Ionicons name={t.icon} size={15} color={t.color} />
        </View>
        <Text className="flex-1 text-[12px] font-bold text-gray-700" numberOfLines={1}>{t.label}</Text>
      </View>
      <Text className="text-[20px] font-extrabold" style={{ color: t.color }} numberOfLines={1}>{npr(t.value)}</Text>
      <Text className="text-[11.5px] text-gray-600" numberOfLines={2}>{t.caption}</Text>
    </Pressable>
  );
  const netLine = (label: string, value: number) => (
    <View className="flex-row items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2.5">
      <Text className="flex-1 text-[12.5px] font-semibold text-gray-700">{label}</Text>
      <Text className="text-[14px] font-extrabold" style={{ color: value >= 0 ? '#0F766E' : '#B91C1C' }}>{value < 0 ? '−' : ''}{npr(Math.abs(value))}</Text>
    </View>
  );
  const owedCard = (
    <Panel title="Receivable & payable" subtitle={`What is owed to you and by you, and what moved · ${periodLabel}`}>
      <Text className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Owed right now</Text>
      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {moneyTile({ label: 'To receive', value: owed.receivable, caption: `From ${owed.debtors} ${owed.debtors === 1 ? 'party' : 'parties'}`, icon: 'arrow-down-circle-outline', color: '#1D4ED8', tint: '#EFF6FF', onPress: () => go('/(reseller)/to-receive') })}
        {moneyTile({ label: 'To pay', value: owed.payable, caption: 'Owed to vendors', icon: 'arrow-up-circle-outline', color: '#B91C1C', tint: '#FEF2F2', onPress: () => go('/(reseller)/to-give') })}
      </View>
      <View className="mt-2">{netLine('Net owed (to receive − to pay)', owed.receivable - owed.payable)}</View>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Received and paid · {periodLabel}</Text>
      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {moneyTile({
          label: 'Received',
          value: collection.received,
          caption: collection.percent == null ? 'No sales billed in this period' : `${Math.round(collection.percent)}% of ${npr(collection.billed)} billed`,
          icon: 'download-outline',
          color: '#047857',
          tint: '#ECFDF5',
          onPress: () => go('/(reseller)/received'),
        })}
        {moneyTile({ label: 'Paid', value: paidOut, caption: 'Expenses and payments out', icon: 'share-outline', color: '#B45309', tint: '#FFFBEB', onPress: () => go('/(reseller)/paid') })}
      </View>
      <View className="mt-2">{netLine('Net movement (received − paid)', collection.received - paidOut)}</View>

      <View className="mb-2 mt-5 flex-row flex-wrap items-center justify-between" style={{ gap: 8 }}>
        <Text className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Received and paid · last 12 months</Text>
        <Legend items={[{ label: 'Received', color: '#2563EB' }, { label: 'Paid', color: '#F59E0B' }]} />
      </View>
      <TrendChart labels={months.map((m) => m.label)} sales={flow.received} purchases={flow.paid} onSales={() => go('/(reseller)/received')} onPurchases={() => go('/(reseller)/paid')} />
    </Panel>
  );

  const ageing = (
    <Panel
      title="Receivable ageing"
      subtitle="How long what you are owed has been waiting"
      right={<Pressable onPress={() => go(withFrom('/(reseller)/ageing-report', 'dashboard'))} hitSlop={6}><Text className="text-[12.5px] font-semibold" style={{ color: '#2563EB' }}>Ageing report</Text></Pressable>}
    >
      <View className="flex-row items-end" style={{ gap: 14, height: 150 }}>
        {[
          { label: '0–30 days', value: owed.ageing[0], color: '#0F766E' },
          { label: '31–60 days', value: owed.ageing[1], color: '#F59E0B' },
          { label: '60+ days', value: owed.ageing[2], color: '#DC2626' },
        ].map((b) => {
          const max = Math.max(...owed.ageing, 1);
          return (
            <Pressable key={b.label} onPress={() => go(withFrom('/(reseller)/ageing-report', 'dashboard'))} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 150, gap: 5 }}>
              <Text className="text-[12px] font-bold text-gray-900">{lakh(b.value)}</Text>
              <View style={{ width: '100%', height: Math.max(6, (b.value / max) * 90), borderRadius: 8, backgroundColor: b.color }} />
              <Text className="text-[11.5px] text-gray-600">{b.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );

  const stages = (
    <Panel title="Jobs by stage" right={<Pressable onPress={() => go('/(reseller)/requests')} hitSlop={6}><Text className="text-[12.5px] font-semibold" style={{ color: '#2563EB' }}>Open requests</Text></Pressable>}>
      <ShareTable
        firstHead="Stage"
        showCount
        rows={stageRows.map((r) => ({ onPress: () => openStage(r.stage), label: r.label, amount: r.amount, count: r.value, color: r.color, share: stageAmount > 0 ? (r.amount / stageAmount) * 100 : null }))}
        total={{ label: 'All stages', amount: stageAmount, count: stageTotal, onPress: () => go('/(reseller)/requests') }}
      />
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
    <Panel title="Top customers" subtitle={`Sales · ${periodLabel}`}>
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
              <Pressable
                key={name}
                onPress={() => go(topCustomers.ids.has(name) ? `/(reseller)/customer/${topCustomers.ids.get(name)}` : '/(reseller)/sales-report')}
                className="border-b border-gray-100 py-2.5"
              >
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="w-6 text-[12px] text-gray-400">{i + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text className="text-[13px] font-semibold text-gray-800" numberOfLines={1}>{name}</Text>
                    <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <View style={{ width: `${Math.max(2, pct)}%`, height: 6, backgroundColor: '#2563EB' }} />
                    </View>
                  </View>
                  <Text className="w-24 text-right text-[13px] font-semibold text-gray-900">{npr(value)}</Text>
                  <Text className="w-14 text-right text-[13px] font-bold text-blue-700">{pct.toFixed(1)}%</Text>
                </View>
              </Pressable>
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

  const updatesCard = (
    <Panel
      title="Recent updates"
      subtitle="The latest change on your jobs"
      right={<Pressable onPress={() => go('/(reseller)/requests')} hitSlop={6}><Text className="text-[12.5px] font-semibold" style={{ color: '#2563EB' }}>View all</Text></Pressable>}
    >
      {updates.length === 0 ? (
        <Text className="py-8 text-center text-sm text-gray-400">No jobs yet</Text>
      ) : (
        <View>
          {updates.map((u, i) => {
            const at = new Date(u.job.updated_at);
            const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
            return (
              <Pressable
                key={u.job.id}
                onPress={() => go(`/(reseller)/request/${u.job.id}`)}
                className={`flex-row items-center py-2.5 ${i < updates.length - 1 ? 'border-b border-gray-100' : ''}`}
                style={{ gap: 10 }}
              >
                <View className="h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${u.color}1A` }}>
                  <Ionicons name={u.icon} size={15} color={u.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text className="text-[13px] font-semibold text-gray-900" numberOfLines={1}>
                    {`${ticketLabel(u.job.ticket_no) ?? ''} ${u.job.issue_type}`.trim()}
                  </Text>
                  <Text className="text-[11.5px] font-medium" style={{ color: u.color }} numberOfLines={1}>{u.text}</Text>
                  <Text className="text-[11px] text-gray-400" numberOfLines={1}>
                    {`${toBsHistoryLabel(u.job.updated_at)} · ${time}${u.job.customer_name ? ` · ${u.job.customer_name}` : ''}`}
                  </Text>
                </View>
                {u.job.quoted_price != null && <Text className="text-[12.5px] font-bold text-gray-800">{npr(Number(u.job.quoted_price))}</Text>}
              </Pressable>
            );
          })}
        </View>
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
          { label: 'New job', icon: 'add-circle' as const, path: newJobHref() },
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
      {quick}
      {periodBar}
      {kpis}
      {periodMenu}
      {row([trend, <RecentActivityCard key="recent" basePath="/(reseller)" />], [1.5, 1])}
      {section('Money')}
      {row([banksCard, owedCard], [1, 1.25])}
      {row([ageing, expenses], [1, 1.25])}
      {section('Work and customers')}
      {row([stages, updatesCard], [1, 1])}
      {customersCard}
    </ScrollView>
  );
}

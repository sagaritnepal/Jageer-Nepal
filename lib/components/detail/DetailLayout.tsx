// lib/components/detail/DetailLayout.tsx
import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { View, Text, Image, Pressable, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WEB_SIDEBAR_MIN_WIDTH } from '../web/WebSidebarShell';

/** True once the viewport is wide enough for the two-column detail layout -
 * same breakpoint the sidebar shell uses, so a phone browser still gets the
 * stacked phone layout. */
export function useWideDetail(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
}

/** Every stage's band colour, as a gradient pair. */
export const STAGE_GRADIENT: Record<string, readonly [string, string]> = {
  orange: ['#EA580C', '#C2410C'],
  amber: ['#D97706', '#B45309'],
  blue: ['#2563EB', '#1D4ED8'],
  red: ['#DC2626', '#B91C1C'],
  green: ['#16A34A', '#15803D'],
  emerald: ['#059669', '#047857'],
  gray: ['#6B7280', '#4B5563'],
};

/** The coloured band at the top of a detail page: what this is, who it's
 * for, when/where, and the money - so the whole job reads at a glance
 * instead of having to piece it together from separate rows. */
export function DetailHero({
  tone,
  icon,
  title,
  pill,
  subtitle,
  amount,
  amountLabel,
  facts,
  actions,
  wide,
}: {
  tone: keyof typeof STAGE_GRADIENT;
  icon: ReactNode;
  title: string;
  pill: string;
  subtitle?: string | null;
  amount: string;
  amountLabel: string;
  facts: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    /** Second line under the value - a phone number, say. */
    sub?: string | null;
    /** Shown instead of the icon: a small photo of the person. */
    photoUrl?: string | null;
    onPress?: () => void;
  }[];
  /** Rendered at the end of the facts row - the customer's call/message buttons. */
  actions?: ReactNode;
  wide: boolean;
}) {
  return (
    <LinearGradient
      colors={STAGE_GRADIENT[tone]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: wide ? 20 : 18, padding: wide ? 22 : 16, gap: wide ? 18 : 14 }}
    >
      <View className={wide ? 'flex-row items-center gap-4' : 'flex-row items-center gap-3'}>
        {icon}
        <View className="flex-1" style={{ gap: 5 }}>
          <View className={wide ? 'flex-row items-center gap-2.5' : ''} style={wide ? undefined : { gap: 5 }}>
            <Text className="font-extrabold text-white" style={{ fontSize: wide ? 22 : 18 }} numberOfLines={2}>
              {title}
            </Text>
            <View className="self-start rounded-full px-2.5 py-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>
              <Text className="text-[11px] font-bold uppercase tracking-wide text-white">{pill}</Text>
            </View>
          </View>
          {!!subtitle && (
            <Text style={{ fontSize: wide ? 13.5 : 12.5, color: 'rgba(255,255,255,0.85)' }} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
        {wide && (
          <View className="items-end">
            <Text className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {amountLabel}
            </Text>
            <Text className="text-2xl font-extrabold text-white">{amount}</Text>
          </View>
        )}
      </View>

      <View
        className={wide ? 'flex-row' : 'flex-row items-end justify-between'}
        style={{
          gap: 10,
          ...(wide ? null : { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 12 }),
        }}
      >
        {/* Wraps rather than shrinking: four chips plus the call/message
            buttons squeezed "CUSTOMER" down to "CUSTO / MER" on a narrower
            window. */}
        <View
          className={wide ? 'flex-1 flex-row flex-wrap items-center' : 'flex-1'}
          style={{ gap: wide ? 10 : 6 }}
        >
          {facts.map((fact) => (
            <Pressable
              key={fact.label + fact.value}
              onPress={fact.onPress}
              disabled={!fact.onPress}
              className={wide ? 'flex-row items-center gap-2.5 rounded-xl px-3 py-2.5' : 'flex-row items-center gap-2'}
              style={
                wide
                  ? { backgroundColor: 'rgba(255,255,255,0.14)', flexGrow: 1, flexBasis: 190, minWidth: 190 }
                  : undefined
              }
            >
              {fact.photoUrl ? (
                <Image
                  source={{ uri: fact.photoUrl }}
                  style={{ width: wide ? 34 : 26, height: wide ? 34 : 26, borderRadius: 999 }}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name={fact.icon} size={wide ? 16 : 14} color="rgba(255,255,255,0.9)" />
              )}
              <View className="flex-1">
                {wide && (
                  <Text className="text-[10.5px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {fact.label}
                  </Text>
                )}
                <Text className="text-[13px] font-semibold text-white" numberOfLines={1}>
                  {fact.value}
                </Text>
                {!!fact.sub && (
                  <Text className="text-[12px] text-white" style={{ opacity: 0.85 }} numberOfLines={1}>
                    {fact.sub}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
          {wide && actions}
        </View>
        {!wide && (
          <View className="items-end">
            <Text className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {amountLabel}
            </Text>
            <Text className="text-xl font-extrabold text-white">{amount}</Text>
          </View>
        )}
      </View>
      {!wide && !!actions && (
        <View className="flex-row" style={{ gap: 8 }}>
          {actions}
        </View>
      )}
    </LinearGradient>
  );
}

/** A white card with the small uppercase header used across the detail pages. */
export function DetailCard({
  icon,
  title,
  right,
  children,
  wide,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <View className={`rounded-2xl border border-gray-200 bg-white ${wide ? 'p-5' : 'p-4'}`}>
      {!!title && (
        <View className="mb-3.5 flex-row items-center gap-1.5">
          {!!icon && <Ionicons name={icon} size={13} color="#9CA3AF" />}
          <Text className="flex-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">{title}</Text>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

/** The right column's opening card: says what to do now, then the button(s). */
export function NextStepCard({
  title,
  hint,
  children,
  wide,
}: {
  title: string;
  hint?: string;
  /** Omitted when the action itself lives in the main column (e.g. the
   * technician picker) and this card is only saying what to do. */
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <DetailCard wide={wide}>
      <View style={{ gap: 3 }}>
        <Text className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Your next step</Text>
        <Text className="text-base font-bold text-gray-900">{title}</Text>
        {!!hint && <Text className="text-[12.5px] leading-[18px] text-gray-500">{hint}</Text>}
      </View>
      {!!children && <View className="mt-3.5" style={{ gap: 8 }}>{children}</View>}
    </DetailCard>
  );
}

export type TimelineStep = { label: string; meta?: string | null; done?: boolean; now?: boolean };

/** Where the job has got to, as a tick-list. */
export function DetailTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <View>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <View key={step.label} className="flex-row" style={{ gap: 12 }}>
            <View className="items-center">
              <View
                className="h-[22px] w-[22px] items-center justify-center rounded-full"
                style={{
                  backgroundColor: step.done ? '#2563EB' : step.now ? '#FFFFFF' : '#F3F4F6',
                  borderWidth: step.now ? 2 : 0,
                  borderColor: '#2563EB',
                }}
              >
                {step.done ? (
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                ) : step.now ? (
                  <View className="h-2 w-2 rounded-full bg-blue-600" />
                ) : null}
              </View>
              {!last && (
                <View
                  className="w-0.5 flex-1"
                  style={{ minHeight: 26, backgroundColor: step.done ? '#2563EB' : '#E5E7EB' }}
                />
              )}
            </View>
            <View style={{ paddingBottom: last ? 0 : 14, gap: 1, flex: 1 }}>
              <Text
                className={`text-[13.5px] ${step.now ? 'font-bold' : 'font-semibold'} ${
                  step.done || step.now ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {step.label}
              </Text>
              {!!step.meta && <Text className="text-[11.5px] text-gray-400">{step.meta}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** One person (customer or technician) with their contact actions. */
export function PersonRow({
  name,
  sub,
  initials,
  photoUrl,
  bg = '#DBEAFE',
  fg = '#1D4ED8',
  children,
}: {
  name: string;
  sub?: string | null;
  initials: string;
  /** Their profile photo, when they have one - falls back to initials. */
  photoUrl?: string | null;
  bg?: string;
  fg?: string;
  children?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className="h-11 w-11 items-center justify-center overflow-hidden rounded-full"
        style={{ backgroundColor: bg }}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={{ width: 44, height: 44 }} resizeMode="cover" />
        ) : (
          <Text className="text-[15px] font-extrabold" style={{ color: fg }}>
            {initials}
          </Text>
        )}
      </View>
      <View className="flex-1" style={{ gap: 2 }}>
        <Text className="text-[15px] font-bold text-gray-900" numberOfLines={1}>
          {name}
        </Text>
        {!!sub && (
          <Text className="text-[12.5px] text-gray-500" numberOfLines={1}>
            {sub}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

type ButtonKind = 'primary' | 'green' | 'ghost' | 'tint' | 'red';

/** The one button style used across both detail pages. */
export function DetailButton({
  label,
  icon,
  kind = 'primary',
  onPress,
  disabled,
  height = 46,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  kind?: ButtonKind;
  onPress: () => void;
  disabled?: boolean;
  height?: number;
}) {
  const styles: Record<ButtonKind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: '#3B82F6', fg: '#FFFFFF' },
    green: { bg: '#16A34A', fg: '#FFFFFF' },
    ghost: { bg: '#FFFFFF', fg: '#374151', border: '#D1D5DB' },
    tint: { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
    red: { bg: '#DC2626', fg: '#FFFFFF' },
  };
  const style = styles[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center justify-center gap-2 rounded-[10px] px-3 disabled:opacity-50"
      style={{ height, backgroundColor: style.bg, borderWidth: style.border ? 1 : 0, borderColor: style.border }}
    >
      {!!icon && <Ionicons name={icon} size={17} color={style.fg} />}
      <Text className="text-[14.5px] font-semibold" style={{ color: style.fg }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Lets a button elsewhere on the page bring a section into view - the
 * customer's "Message" scrolling down to the chat, say. Measured at press
 * time rather than tracked on layout, so it stays right whatever has grown
 * or collapsed above it. */
const DetailScrollContext = createContext<{
  register: (key: string, view: View | null) => void;
  scrollTo: (key: string) => void;
}>({ register: () => {}, scrollTo: () => {} });

export function useDetailScroll() {
  return useContext(DetailScrollContext);
}

/** Wrap a section to make it a scroll destination. */
export function ScrollTarget({ name, children }: { name: string; children: ReactNode }) {
  const { register } = useDetailScroll();
  return <View ref={(view) => register(name, view)}>{children}</View>;
}

/** Page frame: two columns side by side on a wide screen, one stacked
 * column on a phone, where `bottomBar` (if given) is pinned above the tabs
 * so the main action is always reachable without scrolling. */
export function DetailShell({
  children,
  right,
  bottomBar,
}: {
  children: ReactNode;
  right?: ReactNode;
  bottomBar?: ReactNode;
}) {
  const wide = useWideDetail();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const targets = useRef(new Map<string, View>());

  const register = useCallback((key: string, view: View | null) => {
    if (view) targets.current.set(key, view);
    else targets.current.delete(key);
  }, []);

  // measureInWindow on both the target and the scroller, so the offset is
  // right no matter how deep the section sits or how far the page is
  // already scrolled.
  const scrollTo = useCallback((key: string) => {
    const target = targets.current.get(key);
    const scroller = scrollRef.current as unknown as View | null;
    if (!target || !scroller) return;
    scroller.measureInWindow((_sx, scrollerTop) => {
      target.measureInWindow((_tx, targetTop) => {
        const next = Math.max(0, scrollY.current + (targetTop - scrollerTop) - 12);
        scrollRef.current?.scrollTo({ y: next, animated: true });
      });
    });
  }, []);

  const scrollProps = {
    ref: scrollRef,
    scrollEventThrottle: 16,
    onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
    },
  };

  if (wide) {
    return (
      <DetailScrollContext.Provider value={{ register, scrollTo }}>
      <ScrollView {...scrollProps} className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 32, paddingTop: 20, paddingBottom: 48 }}>
        <View className="flex-row items-start" style={{ gap: 20 }}>
          <View className="flex-1" style={{ gap: 16, minWidth: 0 }}>
            {children}
          </View>
          {!!right && (
            <View style={{ width: 330, flexShrink: 0, gap: 16 }}>
              {right}
            </View>
          )}
        </View>
      </ScrollView>
      </DetailScrollContext.Provider>
    );
  }

  return (
    <DetailScrollContext.Provider value={{ register, scrollTo }}>
    <View className="flex-1 bg-gray-50">
      <ScrollView
        {...scrollProps}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      >
        {children}
        {right}
      </ScrollView>
      {!!bottomBar && (
        <View
          className="flex-row items-center gap-3 border-t border-gray-200 bg-white px-4 py-2.5"
          style={{
            shadowColor: '#111827',
            shadowOpacity: 0.06,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: -4 },
            elevation: 8,
          }}
        >
          {bottomBar}
        </View>
      )}
    </View>
    </DetailScrollContext.Provider>
  );
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

// lib/components/detail/DetailLayout.tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { View, Text, Image, Pressable, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WEB_SIDEBAR_MIN_WIDTH } from '../web/WebSidebarShell';

/** True once the viewport is wide enough for the two-column detail layout -
 * same breakpoint the sidebar shell uses, so a phone browser still gets the
 * stacked phone layout. */
export function useWideDetail(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
}

/** Each stage's band: the solid fill, and the darker ink the white status pill carries on it. */
export const STAGE_BAND: Record<string, { band: string; ink: string }> = {
  orange: { band: '#EA580C', ink: '#C2410C' },
  amber: { band: '#D97706', ink: '#B45309' },
  blue: { band: '#2563EB', ink: '#1D4ED8' },
  red: { band: '#DC2626', ink: '#B91C1C' },
  green: { band: '#16A34A', ink: '#15803D' },
  emerald: { band: '#059669', ink: '#047857' },
  gray: { band: '#6B7280', ink: '#4B5563' },
};

/** The top of a detail page, in two parts: a coloured band that says what this
 * is and what it's worth (title, stage, price), and a white panel under it with
 * who it's for, when and where, and the ways to reach them - so the whole job
 * reads at a glance. The panel's cells sit on a hairline, like a grouped list. */
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
  tone: keyof typeof STAGE_BAND;
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
  /** The customer's call / message buttons (see DetailHeroAction). They sit at the
   * end of the first fact, which is the person to contact. */
  actions?: ReactNode;
  wide: boolean;
}) {
  // The page can be "wide" (a desktop window) while this card sits in a narrow
  // column beside the next-step panel, so it lays out by its own measured width.
  const [boxWidth, setBoxWidth] = useState(0);
  const measured = boxWidth > 0;
  const roomy = wide && (!measured || boxWidth >= 520);
  const tiny = measured && boxWidth < 300;
  const { band, ink } = STAGE_BAND[tone];

  const price = (
    <View className={roomy ? 'items-end' : 'flex-row items-baseline justify-between'}>
      <Text className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
        {amountLabel}
      </Text>
      <Text className={roomy ? 'text-2xl font-extrabold text-white' : 'text-xl font-extrabold text-white'}>{amount}</Text>
    </View>
  );

  return (
    <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white" onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      <View style={{ backgroundColor: band, padding: roomy ? 20 : 16, gap: 12 }}>
        <View className="flex-row items-center" style={{ gap: roomy ? 16 : 12 }}>
          {icon}
          <View className="flex-1" style={{ gap: 6 }}>
            <Text
              className="font-extrabold text-white"
              style={{ fontSize: roomy ? 22 : 18, lineHeight: roomy ? 27 : 23 }}
              numberOfLines={2}
            >
              {title}
            </Text>
            <View className="flex-row flex-wrap items-center" style={{ columnGap: 8, rowGap: 4 }}>
              <View className="rounded-full bg-white px-2.5 py-0.5">
                <Text className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: ink }}>
                  {pill}
                </Text>
              </View>
              {!!subtitle && (
                <Text className="text-[13px]" style={{ color: 'rgba(255,255,255,0.9)' }} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          {roomy && price}
        </View>
        {!roomy && (
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', paddingTop: 12 }}>{price}</View>
        )}
      </View>

      {/* The cells are white on a hairline-coloured ground with a 1px gap, so
          the dividers between them stay right however the cells wrap. */}
      <View
        style={{
          backgroundColor: '#F3F4F6',
          gap: 1,
          flexDirection: roomy ? 'row' : 'column',
          flexWrap: roomy ? 'wrap' : 'nowrap',
        }}
      >
        {facts.map((fact, index) => {
          const withActions = index === 0 && !!actions;
          const Cell = fact.onPress ? Pressable : View;
          return (
            <Cell
              key={fact.label + fact.value}
              onPress={fact.onPress}
              className={`flex-row items-start gap-3 bg-white py-3.5 ${roomy ? 'px-5' : 'px-4'}`}
              style={roomy ? { flexGrow: 1, flexBasis: withActions ? 300 : 200, minWidth: withActions ? 300 : 200 } : undefined}
            >
              {fact.photoUrl ? (
                <Image source={{ uri: fact.photoUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} resizeMode="cover" />
              ) : (
                <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: '#EFF6FF' }}>
                  <Ionicons name={fact.icon} size={17} color="#2563EB" />
                </View>
              )}
              <View className="flex-1" style={{ gap: 1 }}>
                <Text className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500">{fact.label}</Text>
                <Text className="text-[14px] font-semibold text-gray-900" numberOfLines={2}>
                  {fact.value}
                </Text>
                {!!fact.sub && (
                  <Text className="text-[12.5px] text-gray-500" numberOfLines={1}>
                    {fact.sub}
                  </Text>
                )}
                {withActions && tiny && <View className="mt-2 flex-row" style={{ gap: 8 }}>{actions}</View>}
              </View>
              {!!fact.onPress && <Ionicons name="open-outline" size={14} color="#9CA3AF" />}
              {withActions && !tiny && <View className="flex-row self-center" style={{ gap: 8 }}>{actions}</View>}
            </Cell>
          );
        })}
      </View>
    </View>
  );
}

/** Call / message the customer: a compact round button that sits beside their
 * name in the hero. Bordered white, the app's secondary button, so it reads as
 * tappable on the white panel. */
export function DetailHeroAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** Spoken name, since the button itself is only an icon. */
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white"
    >
      <Ionicons name={icon} size={18} color="#2563EB" />
    </Pressable>
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

type ButtonKind = 'primary' | 'green' | 'ghost' | 'tint' | 'red' | 'danger';

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
    // A destructive action that is not the main one: outlined, red text.
    danger: { bg: '#FFFFFF', fg: '#DC2626', border: '#FECACA' },
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

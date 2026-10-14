// lib/components/requests/JobTable.tsx
import { createContext, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { StageStepState } from '../../utils/jobTimeline';

// The job table - the one on the Requests page and the My Jobs rows of the Work Hub - shares its
// columns, so the header row and every job row are measured from the same numbers.
//
// The table is only as wide as the window leaves it (the side panel takes 240px), so it comes in
// three sizes, picked from the width it actually has (see tierFor):
//   full     every column;
//   compact  the Address goes under the customer;
//   tight    the date goes under the job and the technician under the customer as well.
// Below that it keeps the tight size and scrolls sideways (JobTableScroll) instead of squeezing.
export type Tier = 'full' | 'compact' | 'tight';
export type ColKey = 'token' | 'when' | 'job' | 'customer' | 'where' | 'amount' | 'tech' | 'status' | 'actions';

export const TIER_COLUMNS: Record<Tier, ColKey[]> = {
  full: ['token', 'when', 'job', 'customer', 'where', 'amount', 'tech', 'status', 'actions'],
  compact: ['token', 'when', 'job', 'customer', 'amount', 'tech', 'status', 'actions'],
  tight: ['token', 'job', 'customer', 'amount', 'status', 'actions'],
};
/** Fixed widths; the columns without one (job, customer, where) share what is left, by TIER_GROW. */
export const TIER_WIDTH: Record<Tier, Partial<Record<ColKey, number>>> = {
  full: { token: 60, when: 78, amount: 100, tech: 108, status: 176, actions: 176 },
  compact: { token: 60, when: 78, amount: 96, tech: 100, status: 164, actions: 168 },
  tight: { token: 56, amount: 92, status: 156, actions: 160 },
};
export const TIER_GROW: Record<Tier, { job: number; customer: number; where: number }> = {
  full: { job: 2, customer: 1.2, where: 1 },
  compact: { job: 2, customer: 1.4, where: 1 },
  tight: { job: 1.8, customer: 1.2, where: 1 },
};
export const TIER_GAP: Record<Tier, number> = { full: 10, compact: 8, tight: 8 };
export const HEAD_LABEL: Record<ColKey, string> = {
  token: 'Token no.',
  when: 'Date',
  job: 'Job',
  customer: 'Customer',
  where: 'Address',
  amount: 'Amount',
  tech: 'Technician',
  status: 'Progress',
  actions: 'Actions',
};

/** Row padding, and the height of the buttons in a row. The header uses the same side padding (and a
 * transparent border where a row has a real one) so its labels sit exactly over the cells. */
export const ROW_PAD_X = 12;
export const ROW_PAD_Y = 8;
export const ROW_BUTTON_HEIGHT = 30;

/** The table's width (px) from which each size reads well; below MIN_TABLE_WIDTH it scrolls sideways. */
export const FULL_TABLE_WIDTH = 1300;
export const COMPACT_TABLE_WIDTH = 1180;
export const MIN_TABLE_WIDTH = 1000;
export function tierFor(width: number): Tier {
  return width >= FULL_TABLE_WIDTH ? 'full' : width >= COMPACT_TABLE_WIDTH ? 'compact' : 'tight';
}

/** The size the table is drawn at, for the header row and every job row to agree on. */
export const TierContext = createContext<Tier>('full');

/** The column names above the rows, in the same widths and gaps as the cells under them.
 * `leading` leaves room for the tick box some rows start with. */
export function JobTableHeader({ tier, leading }: { tier: Tier; leading?: boolean }) {
  return (
    <View
      className="flex-row items-center rounded-md"
      style={{
        gap: TIER_GAP[tier],
        paddingHorizontal: ROW_PAD_X,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'transparent',
        backgroundColor: '#F3F4F6',
      }}
    >
      {leading && <View style={{ width: 20 }} />}
      {TIER_COLUMNS[tier].map((key) => {
        const fixed = TIER_WIDTH[tier][key];
        const style =
          fixed != null
            ? { width: fixed, textAlign: key === 'amount' || key === 'actions' ? ('right' as const) : undefined }
            : { flexBasis: 0, flexGrow: TIER_GROW[tier][key as 'job' | 'customer' | 'where'], minWidth: 0 };
        return (
          <Text key={key} className="text-[10.5px] font-bold capitalize tracking-wide text-gray-500" style={style} numberOfLines={1}>
            {HEAD_LABEL[key]}
          </Text>
        );
      })}
    </View>
  );
}

/** Holds the header and rows at the width the window gives them, and - only when that is less than
 * MIN_TABLE_WIDTH - lets the table scroll sideways instead of squeezing the columns together. */
export function JobTableScroll({ available, gap = 6, children }: { available: number; gap?: number; children: ReactNode }) {
  const width = Math.max(Math.floor(available), MIN_TABLE_WIDTH);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ width, gap }}>{children}</View>
    </ScrollView>
  );
}

/** Assigned / WIP / Hold / Completed as four thin bars with their short words above: the step the job
 * is on is green, finished ones dark grey, the rest light. A longer word gets a longer bar, so none
 * is cut short. `note` is the one line under it, shortened with an ellipsis when it is long. */
export function JobProgressBars({ steps, note }: { steps: { label: string; state: StageStepState }[]; note?: string }) {
  return (
    <View style={{ gap: 3 }}>
      <View className="flex-row" style={{ gap: 4 }}>
        {steps.map((step) => {
          const word = step.state === 'current' ? '#15803D' : step.state === 'done' ? '#374151' : '#9CA3AF';
          const bar = step.state === 'current' ? '#16A34A' : step.state === 'done' ? '#4B5563' : '#E5E7EB';
          return (
            <View key={step.label} style={{ flexBasis: 0, flexGrow: step.label.length + 2, minWidth: 0, gap: 3 }}>
              <Text className="text-[10px] font-semibold" style={{ color: word }} numberOfLines={1}>
                {step.label}
              </Text>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: bar }} />
            </View>
          );
        })}
      </View>
      {!!note && (
        <Text className="text-[10.5px] text-gray-600" numberOfLines={1}>
          {note}
        </Text>
      )}
    </View>
  );
}

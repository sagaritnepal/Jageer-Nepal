// lib/components/requests/JobTable.tsx
import { createContext, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StageStepState } from '../../utils/jobTimeline';
import { decimalInput, parseAmount } from '../../utils/number';
import { getErrorMessage, showAlert } from '../../utils/alert';

// The job table - the one on the Requests page and the My Jobs rows of the Work Hub - shares its
// columns, so the header row and every job row are measured from the same numbers.
//
// The table is only as wide as the window leaves it (the side panel takes 240px), so it comes in
// three sizes, picked from the width it actually has (see tierFor):
//   full     every column;
//   compact  the Address goes under the customer;
//   tight    the technician goes under the customer as well.
// The Date is a column of its own at every size.
// Below that it keeps the tight size and scrolls sideways (JobTableScroll) instead of squeezing.
export type Tier = 'full' | 'compact' | 'tight';
export type ColKey = 'token' | 'when' | 'job' | 'customer' | 'where' | 'amount' | 'tech' | 'status' | 'actions';

export const TIER_COLUMNS: Record<Tier, ColKey[]> = {
  full: ['token', 'when', 'job', 'customer', 'where', 'amount', 'tech', 'status', 'actions'],
  compact: ['token', 'when', 'job', 'customer', 'amount', 'tech', 'status', 'actions'],
  tight: ['token', 'when', 'job', 'customer', 'amount', 'status', 'actions'],
};
/** Fixed widths; the columns without one (job, customer, where) share what is left, by TIER_GROW. */
export const TIER_WIDTH: Record<Tier, Partial<Record<ColKey, number>>> = {
  full: { token: 64, when: 84, amount: 116, tech: 144, status: 228, actions: 176 },
  compact: { token: 64, when: 84, amount: 112, tech: 128, status: 212, actions: 168 },
  tight: { token: 56, when: 78, amount: 100, status: 190, actions: 160 },
};
export const TIER_GROW: Record<Tier, { job: number; customer: number; where: number }> = {
  full: { job: 2, customer: 1.2, where: 1 },
  compact: { job: 2, customer: 1.4, where: 1 },
  tight: { job: 1.8, customer: 1.2, where: 1 },
};
export const TIER_GAP: Record<Tier, number> = { full: 12, compact: 10, tight: 8 };
/** The amount is left-aligned, under its header; this much empty room on its right keeps it from
 * running into the technician beside it. It is part of the column's width, in the header and every
 * row alike. */
export const AMOUNT_PAD = 14;
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
export const FULL_TABLE_WIDTH = 1440;
export const COMPACT_TABLE_WIDTH = 1310;
export const MIN_TABLE_WIDTH = 1080;
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
            ? {
                width: fixed,
                textAlign: key === 'actions' ? ('right' as const) : undefined,
                paddingRight: key === 'amount' ? AMOUNT_PAD : undefined,
              }
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
 * is cut short. `note` is the line under it: two lines at most, then an ellipsis. */
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
        <Text className="text-[10.5px] text-gray-600" numberOfLines={2}>
          {note}
        </Text>
      )}
    </View>
  );
}

/** The amount cell. With `onSave` the reseller can change the price right in the row: tap the amount,
 * type, then Enter or the tick to save (Escape or the cross to leave it). Without it the amount is
 * plain text. `display` is the formatted amount; `value` is the number the field starts from. */
export function EditableAmount({
  display,
  value,
  width,
  onSave,
}: {
  display: string;
  value: number | null;
  width?: number;
  onSave?: (amount: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(value != null ? String(Number(value)) : '');
    setEditing(true);
  };

  const save = async () => {
    if (!onSave || saving) return;
    const amount = parseAmount(draft);
    if (amount == null || amount <= 0) {
      showAlert('Invalid price', 'Enter a valid price in NPR.');
      return;
    }
    if (value != null && amount === Number(value)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(amount);
      setEditing(false);
    } catch (err) {
      showAlert('Could not change the price', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (onSave && editing) {
    return (
      <View className="flex-row items-center" style={{ width, paddingRight: 4, gap: 3 }}>
        <TextInput
          value={draft}
          onChangeText={(text) => setDraft(decimalInput(text))}
          autoFocus
          selectTextOnFocus
          keyboardType="numeric"
          editable={!saving}
          onSubmitEditing={save}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Escape') setEditing(false);
          }}
          placeholder="0"
          accessibilityLabel="New price"
          className="rounded-md border border-blue-500 bg-white px-1.5 text-right text-[12.5px] font-bold text-gray-900"
          style={{ flex: 1, minWidth: 0, height: 26 }}
        />
        {saving ? (
          <ActivityIndicator size="small" color="#0F766E" />
        ) : (
          <>
            <Pressable
              onPress={save}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Save price"
              className="items-center justify-center rounded-md"
              style={{ width: 22, height: 26, backgroundColor: '#0F766E' }}
            >
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => setEditing(false)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              className="items-center justify-center rounded-md"
              style={{ width: 22, height: 26, borderWidth: 1, borderColor: '#D1D5DB' }}
            >
              <Ionicons name="close" size={14} color="#6B7280" />
            </Pressable>
          </>
        )}
      </View>
    );
  }

  const text = (
    <Text className="text-left text-[13px] font-extrabold text-gray-900" style={{ flexShrink: 1 }} numberOfLines={1}>
      {display || '—'}
    </Text>
  );
  return (
    <View style={{ width, paddingRight: AMOUNT_PAD, alignItems: 'flex-start', justifyContent: 'center' }}>
      {onSave ? (
        <Pressable
          onPress={start}
          accessibilityRole="button"
          accessibilityLabel="Change the price"
          className="flex-row items-center"
          style={{ gap: 4, maxWidth: '100%' }}
        >
          <Ionicons name="create-outline" size={12} color="#9CA3AF" />
          {text}
        </Pressable>
      ) : (
        text
      )}
    </View>
  );
}

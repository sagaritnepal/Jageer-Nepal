// lib/components/finance/ledger/LedgerUi.tsx
//
// The small pieces the Ledger list and a party's statement share: summary
// cards, status badges, a dropdown and a checkbox.
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Text } from '../CapsText';
import { Ionicons } from '@expo/vector-icons';
import { Pill } from '../BookKit';
import { MONEY } from '../moneyColors';
import { type PartyStatus } from '../../../utils/ledgerStatement';

/** Green = receivable, red = payable, grey = settled (plus amber for overdue). */
export const LEDGER_TONE = {
  receivable: { text: MONEY.in.text, base: MONEY.in.base, bg: MONEY.in.bg, border: MONEY.in.border },
  payable: { text: MONEY.out.text, base: MONEY.out.base, bg: MONEY.out.bg, border: MONEY.out.border },
  settled: { text: '#4B5563', base: '#9CA3AF', bg: '#F3F4F6', border: '#E5E7EB' },
  overdue: { text: '#9A3412', base: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
} as const;

export function toneOf(status: PartyStatus) {
  return LEDGER_TONE[status];
}

const STATUS_LABEL: Record<PartyStatus, string> = { receivable: 'Receivable', payable: 'Payable', settled: 'Settled' };

/** Receivable / Payable / Settled, with an Overdue tag beside it when part of it is late. */
export function StatusBadges({ status, overdue }: { status: PartyStatus; overdue: boolean }) {
  const tone = toneOf(status);
  return (
    <View className="flex-row flex-wrap items-center" style={{ gap: 4 }}>
      <Pill text={STATUS_LABEL[status]} color={tone.text} bg={tone.bg} />
      {overdue && <Pill text="Overdue" color={LEDGER_TONE.overdue.text} bg={LEDGER_TONE.overdue.bg} />}
    </View>
  );
}

/** One headline figure. Tapping one that filters the list lights it up. */
export function SummaryCard({
  label,
  value,
  caption,
  color,
  accent,
  active,
  onPress,
}: {
  label: string;
  value: string;
  caption?: string;
  color: string;
  /** The coloured edge; defaults to the figure's colour. */
  accent?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="overflow-hidden rounded-xl bg-white"
      style={{
        flexGrow: 1,
        flexBasis: 150,
        borderWidth: 1,
        borderColor: active ? accent ?? color : '#E5E7EB',
        backgroundColor: active ? '#F9FAFB' : '#FFFFFF',
      }}
    >
      <View className="flex-row">
        <View style={{ width: 4, backgroundColor: accent ?? color }} />
        <View className="flex-1 px-3 py-2.5">
          <Text heading className="text-[11px] font-semibold tracking-wide text-gray-400" numberOfLines={1}>
            {label}
          </Text>
          <Text className="mt-0.5 text-[17px] font-extrabold" style={{ color }} numberOfLines={1}>
            {value}
          </Text>
          {!!caption && (
            <Text className="mt-0.5 text-[11px] text-gray-400" numberOfLines={1}>
              {caption}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function Checkbox({ checked, partial, onPress, label }: { checked: boolean; partial?: boolean; onPress: () => void; label: string }) {
  const on = checked || !!partial;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: partial ? 'mixed' : checked }}
      accessibilityLabel={label}
      className="items-center justify-center rounded"
      style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: on ? '#2563EB' : '#9CA3AF', backgroundColor: on ? '#2563EB' : '#FFFFFF' }}
    >
      {on && <Ionicons name={partial && !checked ? 'remove' : 'checkmark'} size={13} color="#FFFFFF" />}
    </Pressable>
  );
}

export interface MenuOption<K extends string> {
  key: K;
  label: string;
}

/** A list in a small popup - for a dropdown's choices, or a bulk action's. */
export function OptionMenuModal<K extends string>({
  visible,
  title,
  options,
  selected,
  onPick,
  onClose,
  searchable,
}: {
  visible: boolean;
  title: string;
  options: MenuOption<K>[];
  /** The ticked one, if any. */
  selected?: K | null;
  onPick: (key: K) => void;
  onClose: () => void;
  /** A search box over a long list: typing narrows the choices to the labels containing it. */
  searchable?: boolean;
}) {
  const [query, setQuery] = useState('');
  // Each opening starts from the whole list.
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);
  const needle = query.trim().toLowerCase();
  const shown = searchable && needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable onPress={() => {}} className="w-full max-w-xs rounded-xl bg-white p-3" style={{ maxHeight: '75%' }}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">{title}</Text>
            <Pressable onPress={onClose} className="px-2 py-1">
              <Text className="text-sm font-semibold text-blue-700">Close</Text>
            </Pressable>
          </View>
          {searchable && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="#9CA3AF"
              autoFocus
              className="mb-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          )}
          <ScrollView keyboardShouldPersistTaps="handled">
            {shown.length === 0 && (
              <Text className="px-2 py-3 text-center text-sm text-gray-400">
                {options.length === 0 ? 'Nothing to choose from.' : 'No matches.'}
              </Text>
            )}
            {shown.map((o) => {
              const on = o.key === selected;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => onPick(o.key)}
                  className="mb-1.5 flex-row items-center gap-2 rounded-lg border border-gray-100 px-2 py-2.5"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={on ? '#2563EB' : '#D1D5DB'} />
                  <Text className="flex-1 text-sm font-medium text-gray-900" numberOfLines={1}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** "Sort: Name A–Z ▾" - a button that opens the choices. */
export function OptionMenu<K extends string>({
  label,
  options,
  value,
  onChange,
  searchable,
}: {
  label: string;
  options: MenuOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Gives the popup a search box - for a list too long to scan. */
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="h-9 flex-row items-center rounded-lg border border-gray-300 bg-white px-3"
        style={{ gap: 6 }}
      >
        <Text className="text-[13px] text-gray-500">{label}:</Text>
        <Text className="text-[13px] font-semibold text-gray-800" numberOfLines={1} style={{ maxWidth: 160 }}>
          {current?.label ?? ''}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#6B7280" />
      </Pressable>
      <OptionMenuModal
        visible={open}
        title={label}
        options={options}
        selected={value}
        searchable={searchable}
        onPick={(key) => {
          setOpen(false);
          onChange(key);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** A select box that opens its list right under itself - a dropdown, not a popup over the page.
 * `searchable` puts a search box at the top of the list, for one too long to scan. Clicking
 * anywhere else, or picking, closes it.
 *
 * Only on the web, where there is room for a list to hang off the page; a phone gets
 * OptionMenu's popup instead (a list outside its parent's bounds cannot be tapped on Android).
 *
 * The list is drawn over what comes after it only if the View holding this is itself above
 * that (give it a `zIndex`): on the web each View is its own stacking layer. */
export function InlineSelect<K extends string>({
  label,
  options,
  value,
  onChange,
  searchable,
  width = 320,
}: {
  label: string;
  options: MenuOption<K>[];
  value: K;
  onChange: (key: K) => void;
  searchable?: boolean;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  if (Platform.OS !== 'web') return <OptionMenu label={label} options={options} value={value} onChange={onChange} searchable={searchable} />;

  const current = options.find((o) => o.key === value);
  const needle = query.trim().toLowerCase();
  const shown = searchable && needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    // Above whatever follows it while open, so the list is not drawn under the table.
    <View style={{ position: 'relative', zIndex: open ? 50 : 1, width, maxWidth: '100%' }}>
      {open && (
        // A click anywhere else on the page closes it: a transparent layer over the page, under the list.
        <Pressable
          onPress={close}
          accessible={false}
          style={{ position: 'fixed' as never, top: 0, left: 0, right: 0, bottom: 0, zIndex: 55 }}
        />
      )}
      <Pressable
        onPress={() => (open ? close() : setOpen(true))}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        className="h-10 flex-row items-center rounded-lg border bg-white px-3"
        style={{ gap: 8, borderColor: open ? '#2563EB' : '#D1D5DB' }}
      >
        <Text className="text-[13px] text-gray-500">{label}:</Text>
        <Text className="flex-1 text-[13px] font-semibold text-gray-800" numberOfLines={1}>
          {current?.label ?? ''}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color="#6B7280" />
      </Pressable>
      {open && (
        <View
          className="overflow-hidden rounded-lg border border-gray-200 bg-white"
          style={{
            position: 'absolute',
            top: 44,
            left: 0,
            right: 0,
            zIndex: 60,
            boxShadow: '0 8px 24px rgba(16,24,40,0.14)',
          }}
        >
          {searchable && (
            <View className="border-b border-gray-100 p-2">
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor="#9CA3AF"
                autoFocus
                className="rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900"
              />
            </View>
          )}
          <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
            {shown.length === 0 && <Text className="px-3 py-3 text-center text-sm text-gray-400">No matches.</Text>}
            {shown.map((o) => {
              const on = o.key === value;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => {
                    close();
                    onChange(o.key);
                  }}
                  accessibilityState={{ selected: on }}
                  className="flex-row items-center px-3 py-2.5"
                  style={{ backgroundColor: on ? '#EFF6FF' : undefined, gap: 8 }}
                >
                  <Text className={`flex-1 text-[13px] ${on ? 'font-bold text-blue-700' : 'font-medium text-gray-900'}`} numberOfLines={1}>
                    {o.label}
                  </Text>
                  {on && <Ionicons name="checkmark" size={15} color="#2563EB" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

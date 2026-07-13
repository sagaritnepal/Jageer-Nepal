// lib/components/DateTimeFields.tsx
import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { WheelColumn } from './WheelPicker';

const webInputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  backgroundColor: '#fff',
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 12,
  paddingBottom: 12,
  fontSize: 16,
  color: '#111827',
  width: '100%',
  boxSizing: 'border-box' as const,
};

function getTimeParts(value: string): { hour: string; minute: string; period: string } {
  if (!value) return { hour: '09', minute: '00', period: 'AM' };
  const [hStr, minute] = value.split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour: String(hour12).padStart(2, '0'), minute: minute ?? '00', period };
}

function buildTimeValue(hour: string, minute: string, period: string): string {
  let h = Number(hour) % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

function parseDateValue(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function formatDateValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Always en-US: guarantees English, Gregorian-calendar labels regardless of
// the device's own locale/calendar settings.
function formatDateLabel(value: string): string {
  return parseDateValue(value).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** English (Gregorian) calendar picker: a native input on web, the OS's native calendar grid on iOS/Android. */
export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'date',
      value,
      onChange: (e: any) => onChange(e.target.value),
      style: webInputStyle,
    });
  }

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'set' && selectedDate) onChange(formatDateValue(selectedDate));
  }

  return (
    <View>
      <Pressable
        onPress={() => setShowPicker(true)}
        className="rounded-lg border border-gray-300 bg-white px-4 py-3"
      >
        <Text className={value ? 'text-base text-gray-900' : 'text-base text-gray-400'}>
          {value ? formatDateLabel(value) : 'Select a date'}
        </Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={value ? parseDateValue(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          onChange={handleChange}
        />
      )}
      {showPicker && Platform.OS === 'ios' && (
        <Pressable onPress={() => setShowPicker(false)} className="mt-2 items-center rounded-lg bg-blue-700 py-2">
          <Text className="text-sm font-semibold text-white">Done</Text>
        </Pressable>
      )}
    </View>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

/** Hour/Minute/AM-PM wheel picker — the same scrollable-reel component on web, iOS, and Android. */
export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { hour, minute, period } = getTimeParts(value);

  // The wheel always shows a concrete position (there's no "blank" reel state
  // like a placeholder), so push that default up front instead of leaving
  // `value` empty while the wheel visually shows 9:00 AM.
  useEffect(() => {
    if (!value) onChange(buildTimeValue(hour, minute, period));
  }, []);

  return (
    <View className="flex-row items-center gap-2">
      <WheelColumn options={HOURS} value={hour} onChange={(h) => onChange(buildTimeValue(h, minute, period))} />
      <Text className="text-lg font-semibold text-gray-400">:</Text>
      <WheelColumn options={MINUTES} value={minute} onChange={(m) => onChange(buildTimeValue(hour, m, period))} />
      <WheelColumn options={PERIODS} value={period} onChange={(p) => onChange(buildTimeValue(hour, minute, p))} width={60} />
    </View>
  );
}

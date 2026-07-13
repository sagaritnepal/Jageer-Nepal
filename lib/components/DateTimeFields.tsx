// lib/components/DateTimeFields.tsx
import { createElement, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

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

function formatDateLabel(value: string): string {
  return parseDateValue(value).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function parseTimeValue(value: string): Date {
  const [h, m] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return date;
}

function formatTimeValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTimeLabel(value: string): string {
  return parseTimeValue(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** A real browser calendar picker on web; a native picker wheel on iOS/Android. */
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
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
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

/** A real browser time picker on web; a native picker wheel on iOS/Android. */
export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'time',
      value,
      onChange: (e: any) => onChange(e.target.value),
      style: webInputStyle,
    });
  }

  function handleChange(event: DateTimePickerEvent, selectedTime?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'set' && selectedTime) onChange(formatTimeValue(selectedTime));
  }

  return (
    <View>
      <Pressable
        onPress={() => setShowPicker(true)}
        className="rounded-lg border border-gray-300 bg-white px-4 py-3"
      >
        <Text className={value ? 'text-base text-gray-900' : 'text-base text-gray-400'}>
          {value ? formatTimeLabel(value) : 'Select a time'}
        </Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={value ? parseTimeValue(value) : new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
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

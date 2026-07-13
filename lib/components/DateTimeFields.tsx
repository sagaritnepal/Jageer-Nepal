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

const webSelectStyle = { ...webInputStyle, flex: 1 };

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function webSelect(
  key: string,
  value: string,
  onChange: (v: string) => void,
  placeholder: string,
  options: { value: string; label: string }[]
) {
  return createElement(
    'select',
    { key, value, onChange: (e: any) => onChange(e.target.value), style: webSelectStyle },
    [
      createElement('option', { value: '', key: 'placeholder' }, placeholder),
      ...options.map((o) => createElement('option', { value: o.value, key: o.value }, o.label)),
    ]
  );
}

function getDateParts(value: string): { day: string; month: string; year: string } {
  const [year, month, day] = value.split('-');
  return { day: day ?? '', month: month ?? '', year: year ?? '' };
}

function buildDateValue(day: string, month: string, year: string): string {
  return day && month && year ? `${year}-${month}-${day}` : '';
}

function getTimeParts(value: string): { hour: string; minute: string; period: string } {
  if (!value) return { hour: '', minute: '', period: '' };
  const [hStr, minute] = value.split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour: String(hour12).padStart(2, '0'), minute: minute ?? '', period };
}

function buildTimeValue(hour: string, minute: string, period: string): string {
  if (!hour || !minute || !period) return '';
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

/** Day/Month/Year dropdown selects on web; a native picker wheel on iOS/Android. */
export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const initialParts = getDateParts(value);
  const [day, setDay] = useState(initialParts.day);
  const [month, setMonth] = useState(initialParts.month);
  const [year, setYear] = useState(initialParts.year);

  if (Platform.OS === 'web') {
    const currentYear = new Date().getFullYear();

    const days = Array.from({ length: 31 }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return { value: d, label: d };
    });
    const months = MONTH_NAMES.map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label }));
    const years = [currentYear, currentYear + 1].map((y) => ({ value: String(y), label: String(y) }));

    return createElement('div', { style: { display: 'flex', gap: 8 } }, [
      webSelect('day', day, (v) => { setDay(v); onChange(buildDateValue(v, month, year)); }, 'Day', days),
      webSelect('month', month, (v) => { setMonth(v); onChange(buildDateValue(day, v, year)); }, 'Month', months),
      webSelect('year', year, (v) => { setYear(v); onChange(buildDateValue(day, month, v)); }, 'Year', years),
    ]);
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

/** Hour/Minute/AM-PM dropdown selects on web; a native picker wheel on iOS/Android. */
export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const initialParts = getTimeParts(value);
  const [hour, setHour] = useState(initialParts.hour);
  const [minute, setMinute] = useState(initialParts.minute);
  const [period, setPeriod] = useState(initialParts.period);

  if (Platform.OS === 'web') {
    const hours = Array.from({ length: 12 }, (_, i) => {
      const h = String(i + 1).padStart(2, '0');
      return { value: h, label: h };
    });
    const minutes = ['00', '15', '30', '45'].map((m) => ({ value: m, label: m }));
    const periods = [
      { value: 'AM', label: 'AM' },
      { value: 'PM', label: 'PM' },
    ];

    return createElement('div', { style: { display: 'flex', gap: 8 } }, [
      webSelect('hour', hour, (v) => { setHour(v); onChange(buildTimeValue(v, minute, period)); }, 'Hour', hours),
      webSelect('minute', minute, (v) => { setMinute(v); onChange(buildTimeValue(hour, v, period)); }, 'Min', minutes),
      webSelect('period', period, (v) => { setPeriod(v); onChange(buildTimeValue(hour, minute, v)); }, 'AM/PM', periods),
    ]);
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

// lib/components/DateTimeFields.tsx
import { createElement, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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

const SLOT_MINUTES = 15;
const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;

// 24-hour "HH:MM" slots in 15-minute steps, e.g. 00:00, 00:15, ... 23:45.
const TIME_SLOTS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => {
  const totalMinutes = i * SLOT_MINUTES;
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const m = String(totalMinutes % 60).padStart(2, '0');
  return `${h}:${m}`;
});

function nearestSlotIndexToNow(): number {
  const now = new Date();
  const rounded = Math.round((now.getHours() * 60 + now.getMinutes()) / SLOT_MINUTES);
  return Math.min(rounded, TIME_SLOTS.length - 1);
}

/** A single box that opens a popup with a scrollable list of 24-hour time slots (e.g. 20:00, 20:15, 20:30...) to pick from. */
export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!showPicker) return;
    const index = value ? TIME_SLOTS.indexOf(value) : nearestSlotIndexToNow();
    // Wait a tick so the ScrollView inside the just-opened modal has mounted before jumping.
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, index) * ROW_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [showPicker]);

  return (
    <View>
      <Pressable
        onPress={() => setShowPicker(true)}
        className="rounded-lg border border-gray-300 bg-white px-4 py-3"
      >
        <Text className={value ? 'text-base text-gray-900' : 'text-base text-gray-400'}>
          {value || 'Select a time'}
        </Text>
      </Pressable>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/40"
          onPress={() => setShowPicker(false)}
        >
          <Pressable onPress={() => {}} className="w-64 rounded-xl bg-white p-3">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900">Select a time</Text>
              <Pressable onPress={() => setShowPicker(false)} className="px-2 py-1">
                <Text className="text-sm font-semibold text-blue-700">Done</Text>
              </Pressable>
            </View>
            <ScrollView
              ref={scrollRef}
              style={{ height: ROW_HEIGHT * VISIBLE_ROWS }}
              showsVerticalScrollIndicator={true}
            >
              {TIME_SLOTS.map((slot) => {
                const selected = slot === value;
                return (
                  <Pressable
                    key={slot}
                    onPress={() => {
                      onChange(slot);
                      setShowPicker(false);
                    }}
                    style={{ height: ROW_HEIGHT }}
                    className={`justify-center border-b border-gray-100 px-4 ${selected ? 'bg-blue-50' : ''}`}
                  >
                    <Text className={selected ? 'text-base font-semibold text-blue-700' : 'text-base text-gray-700'}>
                      {slot}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

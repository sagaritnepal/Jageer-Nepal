// lib/components/DateTimeFields.tsx
import { createElement } from 'react';
import { Platform, TextInput } from 'react-native';

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

/** A real browser calendar picker on web; a plain text field on native. */
export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'date',
      value,
      onChange: (e: any) => onChange(e.target.value),
      style: webInputStyle,
    });
  }
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
    />
  );
}

/** A real browser time picker on web; a plain text field on native. */
export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'time',
      value,
      onChange: (e: any) => onChange(e.target.value),
      style: webInputStyle,
    });
  }
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="e.g. 14:30"
      className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
    />
  );
}

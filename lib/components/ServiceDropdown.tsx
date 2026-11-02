// lib/components/ServiceDropdown.tsx
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSupabaseQuery } from '../hooks/useSupabase';
import { SuggestInput, type SuggestOption } from './finance/SuggestInput';
import { CategoryBadge } from './CategoryBadge';

export type ServiceAction = 'Repair' | 'Installation';
export interface ServiceChoice {
  category: string;
  action: string;
}
const ACTIONS: ServiceAction[] = ['Repair', 'Installation'];
const ACCENT = '#2563EB';
const ROW_HEIGHT = 50;

/** What a job is for, chosen from inside the job's own form with the same box the finance forms use for a customer:
 * type to filter, the matching letters marked, a list floating under the box, Up / Down / Enter / Esc from the
 * keyboard. Repair or Installation is the small switch beside it. */
export function ServiceDropdown({
  value,
  onChange,
}: {
  value: ServiceChoice | null;
  onChange: (choice: ServiceChoice | null) => void;
}) {
  const [text, setText] = useState(value?.category ?? '');
  const [focused, setFocused] = useState(false);
  const { width } = useWindowDimensions();
  const action: ServiceAction = value?.action === 'Installation' ? 'Installation' : 'Repair';
  // Repair / Installation before a service is picked: remembered here until it is.
  const [pendingAction, setPendingAction] = useState<ServiceAction>(action);
  const currentAction = value ? action : pendingAction;

  const { data: categories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });

  // The box shows the chosen service's name; opening it again lists every service, not just that one.
  useEffect(() => {
    if (value) setText(value.category);
  }, [value?.category]);
  const typing = text.trim() !== '' && text !== value?.category;

  const options = useMemo<SuggestOption[]>(() => {
    const q = typing ? text.trim().toLowerCase() : '';
    return (categories ?? [])
      .filter((c) => !q || c.label.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q))
      .map((c) => ({ key: c.id, label: c.label, sub: c.description, hint: c.label === value?.category ? 'Selected' : null }));
  }, [categories, text, typing, value?.category]);

  function pick(label: string) {
    setText(label);
    onChange({ category: label, action: currentAction });
  }

  function changeText(next: string) {
    setText(next);
    setFocused(true);
    // A name typed in full is as good as picked; anything less is not a service yet.
    const exact = (categories ?? []).find((c) => c.label.toLowerCase() === next.trim().toLowerCase());
    if (exact) onChange({ category: exact.label, action: currentAction });
    else if (value) onChange(null);
  }

  function changeAction(next: ServiceAction) {
    setPendingAction(next);
    if (value) onChange({ category: value.category, action: next });
  }

  // On a phone the list sits over the rest of the form; Android doesn't pass touches to a child that lies outside its
  // parent, so room is kept for it while it is open. (On the web it simply floats.)
  const reserve = Platform.OS !== 'web' && focused ? Math.min(280, options.length * ROW_HEIGHT + 12) : 0;

  return (
    <View className="mb-3 rounded-2xl border border-gray-200 bg-white p-3" style={{ zIndex: 20, paddingBottom: 12 + reserve }}>
      <Text className="mb-1.5 text-sm font-medium text-gray-700">Service</Text>
      <View className="flex-row flex-wrap items-center" style={{ gap: 10 }}>
        {value && <CategoryBadge category={value.category} size={36} />}
        {/* Raised while the list is open: on a phone the Repair / Installation switch wraps under the box, and the
            list must float over it, not behind it. */}
        <View style={{ flex: 1, minWidth: Math.min(220, width - 80), zIndex: focused ? 30 : 0 }}>
          <SuggestInput
            value={text}
            onChangeText={changeText}
            options={options}
            onSelectOption={(o) => {
              setFocused(false);
              pick(o.label);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Choose a service - type to search"
            accessibilityLabel="Service"
            accent={ACCENT}
            showWhenEmpty
            inputClassName="rounded-lg border bg-white px-4 text-base text-gray-900"
            inputStyle={[
              { minHeight: 48, borderColor: focused ? ACCENT : '#D1D5DB' },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            ]}
            adornment={<Ionicons name={focused ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />}
            adornmentWidth={40}
          />
        </View>
        <View className="flex-row rounded-xl bg-gray-100 p-1" style={{ width: 220 }}>
          {ACTIONS.map((a) => {
            const on = currentAction === a;
            return (
              <Pressable
                key={a}
                onPress={() => changeAction(a)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className={`h-10 flex-1 items-center justify-center rounded-lg ${on ? 'bg-white' : ''}`}
              >
                <Text className={`text-sm ${on ? 'font-bold text-blue-700' : 'font-semibold text-gray-500'}`}>{a}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

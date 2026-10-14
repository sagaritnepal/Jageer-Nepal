// lib/components/requests/JobProgress.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StageStepState } from '../../utils/jobTimeline';

const WORD_COLOR: Record<StageStepState, string> = { current: '#15803D', done: '#374151', todo: '#9CA3AF' };
const BAR_COLOR: Record<StageStepState, string> = { current: '#16A34A', done: '#4B5563', todo: '#E5E7EB' };

/** Where a job has got to - Assigned, WIP, Hold, Completed - as short bars.
 *
 * Only the step happening right now is spelled out, with its word over a full bar; the others shrink
 * to small ticks that take almost no room. Tapping it opens all four, with their words, and tapping
 * again folds them away. `note` is the line under it (Working on it · Overdue by 3 days · Unpaid).
 *
 * A job with no step under way (cancelled, or not assigned yet) shows the last step it reached, or
 * the first one. */
export function JobProgress({ steps, note }: { steps: { label: string; state: StageStepState }[]; note?: string }) {
  const [open, setOpen] = useState(false);

  let focus = steps.findIndex((s) => s.state === 'current');
  if (focus < 0) {
    steps.forEach((s, i) => {
      if (s.state === 'done') focus = i;
    });
  }
  if (focus < 0) focus = 0;

  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={open ? 'Show only the current step' : 'Show every step'}
      style={{ gap: 4 }}
    >
      <View className="flex-row items-end" style={{ gap: 6 }}>
        {steps.map((step, i) => {
          const shown = open || i === focus;
          return (
            <View key={step.label} style={shown ? { flex: 1, gap: 4 } : { width: 14 }}>
              {shown && (
                <Text className="text-[10.5px] font-semibold" style={{ color: WORD_COLOR[step.state] }} numberOfLines={1}>
                  {step.label}
                </Text>
              )}
              <View style={{ height: 5, borderRadius: 3, backgroundColor: BAR_COLOR[step.state] }} />
            </View>
          );
        })}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#9CA3AF" style={{ marginBottom: -3 }} />
      </View>
      {!!note && (
        <Text className="text-[11px] text-gray-600" numberOfLines={1}>
          {note}
        </Text>
      )}
    </Pressable>
  );
}

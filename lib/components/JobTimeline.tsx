// lib/components/JobTimeline.tsx
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { jobStages, type JobStage, type JobTimes, type StageKey } from '../utils/jobTimeline';
import type { ServiceRequest } from '../../types/database.types';

const ICON: Record<StageKey, keyof typeof Ionicons.glyphMap> = {
  posted: 'add-circle-outline',
  pending: 'hourglass-outline',
  assigned: 'person-outline',
  wip: 'construct-outline',
  done: 'checkmark-circle-outline',
};

/** Colours by how far the job has got: finished steps are plain, the step it is
 * in is blue (amber when an offer has sat unanswered), steps not reached fade. */
function tone(stage: JobStage) {
  if (stage.warn) return { label: '#B45309', text: '#92400E', span: '#B45309', icon: '#D97706', bg: '#FFFBEB' };
  if (stage.state === 'now') return { label: '#1D4ED8', text: '#374151', span: '#1D4ED8', icon: '#2563EB', bg: '#EFF6FF' };
  if (stage.state === 'todo') return { label: '#9CA3AF', text: '#9CA3AF', span: '#9CA3AF', icon: '#D1D5DB', bg: 'transparent' };
  return { label: '#4B5563', text: '#6B7280', span: '#111827', icon: '#6B7280', bg: 'transparent' };
}

const iconOf = (stage: JobStage): keyof typeof Ionicons.glyphMap =>
  stage.label === 'Cancelled' ? 'close-circle-outline' : ICON[stage.key];

/**
 * Where a job is in its life and how long each step took: Posted, Pending
 * (waiting for someone), Assigned, Working, Completed - every step is always
 * shown, so a job that has not got there yet reads "—" instead of the step
 * disappearing. `strip` is one row of five beside each other (a wide table);
 * `list` stacks them for a phone card.
 */
export function JobTimeline({
  request,
  times,
  now,
  layout,
}: {
  request: ServiceRequest;
  times: JobTimes | undefined;
  now: number;
  layout: 'strip' | 'list';
}) {
  const stages = jobStages(request, times, now);

  if (layout === 'list') {
    return (
      <View className="mt-2.5 rounded-xl p-2.5" style={{ backgroundColor: '#F9FAFB', gap: 7 }}>
        {stages.map((s) => {
          const t = tone(s);
          return (
            <View key={s.key} className="flex-row items-start" style={{ gap: 8 }}>
              <Ionicons name={iconOf(s)} size={14} color={t.icon} style={{ marginTop: 1 }} />
              <Text className="text-[11px] font-bold uppercase tracking-wide" style={{ width: 70, color: t.label }}>
                {s.label}
              </Text>
              <View className="flex-1">
                {!!s.at && (
                  <Text className="text-[11.5px]" style={{ color: t.text }}>
                    {s.at}
                  </Text>
                )}
                <Text className="text-[12px] font-semibold" style={{ color: t.span }}>
                  {s.span ?? (s.at ? '' : '—')}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View className="flex-row border-t border-gray-100" style={{ backgroundColor: '#FAFAFA' }}>
      {stages.map((s, i) => {
        const t = tone(s);
        return (
          <View
            key={s.key}
            className={`px-3 py-2 ${i < stages.length - 1 ? 'border-r border-gray-100' : ''}`}
            style={{ flex: 1, minWidth: 0, backgroundColor: t.bg }}
          >
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Ionicons name={iconOf(s)} size={12} color={t.icon} />
              <Text className="text-[10px] font-bold uppercase tracking-wide" style={{ color: t.label }} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
            {!!s.at && (
              <Text className="mt-0.5 text-[11.5px]" style={{ color: t.text }} numberOfLines={1}>
                {s.at}
              </Text>
            )}
            <Text className={`${s.at ? '' : 'mt-0.5 '}text-[12px] font-semibold`} style={{ color: t.span }} numberOfLines={1}>
              {s.span ?? (s.at ? ' ' : '—')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

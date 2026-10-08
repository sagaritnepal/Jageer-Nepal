// lib/components/JobTimeline.tsx
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { jobJourney, type JobTimes, type JourneyLeg, type JourneyNode } from '../utils/jobTimeline';
import type { ServiceRequest } from '../../types/database.types';

const BLUE = '#2563EB';

type Tone = 'done' | 'now' | 'warn' | 'todo';
const toneOf = (leg: JourneyLeg): Tone => (leg.warn ? 'warn' : leg.state);

/** The line between two moments: solid blue once it is over, light blue while
 * the job is in it, amber when an offer has sat unanswered, grey if not reached. */
const LINE: Record<Tone, string> = { done: BLUE, now: '#93C5FD', warn: '#FCD34D', todo: '#D1D5DB' };

/** How long it took, as a soft badge - the same pairs the status chips use. */
const PILL = {
  done: { bg: '#FFFFFF', border: '#E5E7EB', label: '#6B7280', value: '#111827' },
  now: { bg: '#EFF6FF', border: '#BFDBFE', label: '#1D4ED8', value: '#1D4ED8' },
  warn: { bg: '#FFFBEB', border: '#FDE68A', label: '#B45309', value: '#92400E' },
};

/** A moment on the line: a filled dot once it has happened, a hollow one if
 * not; the end is a green tick when completed, a grey cross when cancelled. */
function Dot({ node }: { node: JourneyNode }) {
  if (node.reached && node.kind !== 'plain') {
    const completed = node.kind === 'completed';
    return (
      <View
        style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: completed ? '#16A34A' : '#6B7280' }}
      >
        <Ionicons name={completed ? 'checkmark' : 'close'} size={13} color="#FFFFFF" />
      </View>
    );
  }
  // Just the circle, no padding box: its left edge is where the caption under
  // it starts, and the line runs straight out of it.
  return (
    <View
      style={
        node.reached
          ? { width: 14, height: 14, borderRadius: 7, backgroundColor: BLUE }
          : { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#9CA3AF', backgroundColor: '#FFFFFF' }
      }
    />
  );
}

function LegPill({ leg }: { leg: JourneyLeg }) {
  if (!leg.value) return null;
  const c = PILL[leg.warn ? 'warn' : leg.state === 'now' ? 'now' : 'done'];
  return (
    <View
      style={{ flexShrink: 1, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 2 }}
    >
      <Text numberOfLines={1} style={{ fontSize: 11 }}>
        <Text style={{ color: c.label }}>{leg.label} </Text>
        <Text style={{ color: c.value, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{leg.value}</Text>
      </Text>
    </View>
  );
}

/** The line under a moment, to the next one - with how long it took in the middle. */
function Leg({ leg }: { leg: JourneyLeg }) {
  const line = { flex: 1, height: 2, minWidth: 6, borderRadius: 1, backgroundColor: LINE[toneOf(leg)] } as const;
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 }}>
      <View style={line} />
      {!!leg.value && (
        <>
          <View style={{ width: 6 }} />
          <LegPill leg={leg} />
          <View style={{ width: 6 }} />
          <View style={line} />
        </>
      )}
    </View>
  );
}

/** What the moment's caption says: when it happened, or that it has not. */
function whenText(node: JourneyNode): string {
  if (!node.reached) return 'Not yet';
  return [node.at ?? 'Time not saved', node.note].filter(Boolean).join(' · ');
}

const labelColor = (node: JourneyNode) => (node.reached ? '#111827' : '#9CA3AF');

/** For a screen reader: the same story in one sentence. */
function spoken(nodes: JourneyNode[], legs: JourneyLeg[]): string {
  return nodes
    .map((n, i) => {
      const leg = legs[i];
      return `${n.label} ${n.reached ? whenText(n) : 'not yet'}${leg?.value ? `, ${leg.label} ${leg.value}` : ''}`;
    })
    .join('. ');
}

/**
 * A job's journey: Posted, Assigned, Started, Completed as dots on one line,
 * with the time each stretch took on the line between them - Pending (until it
 * was given to someone), Waiting to accept / Accepted in, and WIP (the work
 * itself). Every step is always there; the ones a job has not reached are
 * hollow and say "Not yet".
 *
 * `strip` runs the four moments side by side (a wide table); `list` stacks
 * them down a rail for a phone card.
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
  const { nodes, legs } = jobJourney(request, times, now);
  const last = nodes.length - 1;

  if (layout === 'list') {
    return (
      <View className="mt-3 border-t border-gray-100 pt-3" accessible accessibilityLabel={spoken(nodes, legs)}>
        {nodes.map((n, i) => {
          const leg = legs[i];
          return (
            <View key={n.key} className="flex-row" style={{ gap: 10 }}>
              <View style={{ width: 20, alignItems: 'center' }}>
                <View style={{ height: 20, justifyContent: 'center' }}>
                  <Dot node={n} />
                </View>
                {!!leg && (
                  <View style={{ width: 2, flexGrow: 1, minHeight: 30, marginVertical: 2, borderRadius: 1, backgroundColor: LINE[toneOf(leg)] }} />
                )}
              </View>
              <View className="flex-1" style={{ paddingBottom: leg ? 12 : 0, minWidth: 0 }}>
                <Text className="text-[13px] font-bold" style={{ color: labelColor(n), marginTop: 1 }}>
                  {n.label}
                </Text>
                <Text className="text-[11.5px]" style={{ color: '#6B7280' }}>
                  {whenText(n)}
                </Text>
                {!!leg?.value && (
                  <View className="mt-1.5 flex-row">
                    <LegPill leg={leg} />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View className="flex-row px-3 pb-3.5" accessible accessibilityLabel={spoken(nodes, legs)}>
      {nodes.map((n, i) => (
        <View key={n.key} style={{ flex: i === last ? 0.8 : 1, minWidth: 0 }}>
          <View className="flex-row items-center" style={{ height: 20 }}>
            <Dot node={n} />
            {i < last && <Leg leg={legs[i]} />}
          </View>
          <Text className="mt-1 text-[12.5px] font-bold" style={{ color: labelColor(n) }}>
            {n.label}
          </Text>
          <Text className="text-[11.5px]" style={{ color: '#6B7280' }}>
            {whenText(n)}
          </Text>
        </View>
      ))}
    </View>
  );
}

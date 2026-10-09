// lib/components/TicketChip.tsx
import { Text, View } from 'react-native';
import { ticketLabel } from '../utils/ticket';

/** A job's ticket number as a small tag ("#0042"). Square-cornered and grey on
 * purpose: it names the job, it is not a status, so it must not compete with
 * the round status chips. Renders nothing for a job that has no number yet. */
export function TicketChip({ no }: { no: number | null | undefined }) {
  const label = ticketLabel(no);
  if (!label) return null;
  return (
    <View
      accessible
      accessibilityLabel={`Ticket ${label.slice(1)}`}
      className="rounded-md px-1.5 py-0.5"
      style={{ backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' }}
    >
      <Text className="text-[11px] font-bold" style={{ color: '#374151', fontVariant: ['tabular-nums'] }}>
        {label}
      </Text>
    </View>
  );
}

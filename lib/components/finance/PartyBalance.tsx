// lib/components/finance/PartyBalance.tsx
import { Text, View, type TextStyle } from 'react-native';
import { money } from './BookKit';
import type { PartyPosition } from '../../utils/partyBalance';

// Same green/red the Ledger tiles use: money coming to you / money you owe.
const RECEIVE = '#047857';
const PAY = '#B91C1C';

// Digits of equal width, so amounts line up down the column.
const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * The one balance a party has, in words: the amount, then whether it is
 * "To receive" (they owe you) or "To pay" (you owe them). Someone with money
 * running both ways gets a single netted figure plus a plain note saying so,
 * instead of separate receive / pay columns that each tell half the story.
 */
export function PartyBalance({ position, align = 'right' }: { position: PartyPosition; align?: 'left' | 'right' }) {
  const alignItems = align === 'right' ? 'flex-end' : 'flex-start';
  const color = position.state === 'receive' ? RECEIVE : PAY;

  return (
    <View style={{ alignItems }}>
      {position.state === 'settled' ? (
        <Text className="text-[12.5px] font-medium text-gray-400">Settled</Text>
      ) : (
        <>
          <Text className="text-[14px] font-extrabold" style={[{ color }, TABULAR]}>
            {money(position.amount)}
          </Text>
          <Text className="text-[10.5px] font-semibold" style={{ color }}>
            {position.state === 'receive' ? 'To receive' : 'To pay'}
          </Text>
        </>
      )}
      {position.bothLedgers && <Text className="mt-0.5 text-[10.5px] text-gray-500">Net of both ledgers</Text>}
    </View>
  );
}

/** A party's type (Customer, Vendor, Employee, or one the reseller added).
 * Neutral on purpose - it labels the person, it is not a status, so it must
 * not compete with the blue APP badge or the green / red balance. */
export function PartyTypePill({ name }: { name: string }) {
  return (
    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#F3F4F6' }}>
      <Text className="text-[10.5px] font-bold" style={{ color: '#4B5563' }} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

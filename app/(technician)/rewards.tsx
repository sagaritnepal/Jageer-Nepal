// app/(technician)/rewards.tsx
import { ScrollView } from 'react-native';
import { RewardsScreen } from '../../lib/components/RewardsScreen';

export default function TechnicianRewards() {
  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      <RewardsScreen />
    </ScrollView>
  );
}

// lib/components/TechnicianPicker.tsx
import { View, Text, Pressable } from 'react-native';
import type { Profile } from '../../types/database.types';

type RankedTechnician = Profile & { distance: number | null };

export function TechnicianPicker({
  technicians,
  isLoading,
  locationKnown,
  onAssign,
  disabled,
}: {
  technicians: RankedTechnician[];
  isLoading: boolean;
  locationKnown: boolean;
  onAssign: (technicianId: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <Text className="mb-2 text-sm font-medium text-gray-700">Assign a technician</Text>
      <Text className="mb-3 text-xs text-gray-400">
        Sorted by availability{locationKnown ? ' and distance' : ''}.
      </Text>

      {isLoading && <Text className="text-gray-500">Loading technicians…</Text>}
      {!isLoading && technicians.length === 0 && (
        <Text className="text-gray-500">No technicians registered yet.</Text>
      )}

      {technicians.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onAssign(item.id)}
          disabled={disabled}
          className="mb-3 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4 disabled:opacity-50"
        >
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold text-gray-900">{item.full_name ?? 'Unnamed technician'}</Text>
              <View className={`rounded-full px-2 py-0.5 ${item.is_available ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Text className={`text-[10px] font-semibold ${item.is_available ? 'text-green-700' : 'text-gray-500'}`}>
                  {item.is_available ? 'Available' : 'Unavailable'}
                </Text>
              </View>
            </View>
            <Text className="mt-0.5 text-xs text-gray-400">
              {item.distance != null ? `${item.distance.toFixed(1)} km away` : item.city ?? 'Location unknown'}
            </Text>
          </View>
          <Text className="font-semibold text-blue-700">Assign →</Text>
        </Pressable>
      ))}
    </>
  );
}

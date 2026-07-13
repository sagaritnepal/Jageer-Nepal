// TEMPORARY — local preview of the redesigned home portal (mock data, no login needed). Delete before committing.
import { Pressable, ScrollView, Text, View } from 'react-native';

const CATEGORY_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-600' },
  { bg: 'bg-purple-50', text: 'text-purple-600' },
  { bg: 'bg-amber-50', text: 'text-amber-600' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { bg: 'bg-pink-50', text: 'text-pink-600' },
  { bg: 'bg-teal-50', text: 'text-teal-600' },
  { bg: 'bg-orange-50', text: 'text-orange-600' },
  { bg: 'bg-indigo-50', text: 'text-indigo-600' },
];

const MOCK_CATEGORIES = [
  { id: '1', label: 'Hardware & Installation', icon: '📦' },
  { id: '2', label: 'Network Issues', icon: '📍' },
  { id: '3', label: 'Website & App Design', icon: '🧩' },
  { id: '4', label: 'Digital Marketing', icon: '⭐' },
  { id: '5', label: 'Cybersecurity', icon: '🛡️' },
  { id: '6', label: 'Cloud Solutions', icon: '☁️' },
  { id: '7', label: 'CCTV & Surveillance', icon: '📹' },
  { id: '8', label: 'Computer Repair', icon: '🖥️' },
  { id: '9', label: 'Laptop Repair', icon: '💻' },
  { id: '10', label: 'Door Lock & Access', icon: '🔒' },
  { id: '11', label: 'Intercom Systems', icon: '📞' },
  { id: '12', label: 'AC Service & Repair', icon: '❄️' },
  { id: '13', label: 'Electrical Work', icon: '⚡' },
  { id: '14', label: 'UPS & Inverter', icon: '🔋' },
];

export default function DevTest() {
  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="rounded-b-[22px] bg-blue-700 px-6 pb-6 pt-16">
        <Text className="text-[19px] font-extrabold text-white">Welcome, Test User</Text>
        <Pressable className="mt-4 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3.5">
          <View>
            <Text className="text-[14.5px] font-bold text-gray-900">Need IT help?</Text>
            <Text className="mt-0.5 text-xs text-gray-500">Report an issue in seconds</Text>
          </View>
          <View className="rounded-full bg-blue-700 px-4 py-2">
            <Text className="text-xs font-bold text-white">Request</Text>
          </View>
        </Pressable>
      </View>

      <View className="px-6 pt-5">
        <Text className="mb-3 text-[15px] font-bold text-gray-900">Browse by category</Text>
        <View className="flex-row flex-wrap">
          {MOCK_CATEGORIES.map((c, i) => {
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <Pressable key={c.id} className="mb-5 w-1/4 items-center px-1">
                <View className={`h-14 w-14 items-center justify-center rounded-2xl ${color.bg}`}>
                  <Text className="text-2xl">{c.icon}</Text>
                </View>
                <Text
                  numberOfLines={2}
                  className="mt-2 text-center text-[11.5px] font-semibold leading-[1.2] text-gray-800"
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

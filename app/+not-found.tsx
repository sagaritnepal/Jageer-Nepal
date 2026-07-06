// app/+not-found.tsx
import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="mb-4 text-xl font-semibold text-gray-900">This screen doesn't exist.</Text>
      <Link href="/" className="text-blue-700">
        Go to home
      </Link>
    </View>
  );
}

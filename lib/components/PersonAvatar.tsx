// lib/components/PersonAvatar.tsx
import { View, Text, Image } from 'react-native';

export function initialsOf(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function PersonAvatar({
  name,
  photoUrl,
  size = 36,
  bg = 'bg-teal-600',
}: {
  name: string | null | undefined;
  photoUrl?: string | null;
  size?: number;
  bg?: string;
}) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className={`items-center justify-center overflow-hidden ${bg}`}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text className="font-bold text-white" style={{ fontSize: size * 0.32 }}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

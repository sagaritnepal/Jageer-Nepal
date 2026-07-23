// lib/components/BarChart.tsx
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

export function BarChart({
  data,
  color = '#0D9488',
  selectedColor = '#F97316',
  height = 110,
  formatValue,
  formatLabel,
}: {
  data: { label: string; value: number }[];
  color?: string;
  selectedColor?: string;
  height?: number;
  formatValue: (value: number) => string;
  formatLabel?: (label: string, index: number) => string | null;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <View>
      <View className="flex-row items-end" style={{ height, gap: 2 }}>
        {data.map((d, i) => {
          const barHeight = d.value > 0 ? Math.max(3, (d.value / max) * height) : 1;
          const isSelected = selected === i;
          return (
            <Pressable
              key={i}
              onPress={() => setSelected(isSelected ? null : i)}
              className="flex-1 items-center justify-end"
            >
              <View
                style={{ height: barHeight, backgroundColor: isSelected ? selectedColor : color }}
                className="w-full rounded-t"
              />
            </Pressable>
          );
        })}
      </View>
      <View className="mt-1.5 flex-row" style={{ gap: 2 }}>
        {data.map((d, i) => {
          const label = formatLabel ? formatLabel(d.label, i) : d.label;
          return (
            <View key={i} className="flex-1 items-center">
              {label ? <Text className="text-[8.5px] text-gray-400">{label}</Text> : null}
            </View>
          );
        })}
      </View>
      {selected != null && (
        <View className="mt-2.5 self-start rounded-lg bg-gray-900 px-3 py-1.5">
          <Text className="text-xs font-semibold text-white">
            {data[selected].label}: {formatValue(data[selected].value)}
          </Text>
        </View>
      )}
    </View>
  );
}

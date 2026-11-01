// lib/components/UpdateBanner.tsx
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LATEST_RELEASE_API, pickUpdate } from '../utils/appUpdate';

/** An APK installed by hand never updates itself. On launch, the Android app compares its own versionCode
 * with the newest GitHub Release and, if that is newer, offers the APK. Stays silent when offline, when
 * GitHub says no, or in development. Closing it hides it until the next launch. */
export function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const [apkUrl, setApkUrl] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android' || __DEV__) return;
    const raw = Application.nativeBuildVersion;
    const installed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(installed)) return;

    let cancelled = false;
    fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((release) => {
        if (!cancelled) setApkUrl(pickUpdate(installed, release));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!apkUrl) return null;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, paddingTop: insets.top + 8, paddingHorizontal: 12 }}>
      <View className="flex-row items-center gap-3 rounded-xl bg-blue-600 px-3.5 py-3" style={{ elevation: 6 }}>
        <Ionicons name="cloud-download-outline" size={22} color="#FFFFFF" />
        <View className="flex-1">
          <Text className="text-[13.5px] font-bold text-white">A new version of Jageer is ready</Text>
          <Text className="mt-0.5 text-[11.5px] text-white/85">Download it, then open the file to install over this one.</Text>
        </View>
        <Pressable
          onPress={() => Linking.openURL(apkUrl)}
          accessibilityRole="button"
          className="h-9 items-center justify-center rounded-lg bg-white px-3.5"
        >
          <Text className="text-[13px] font-bold text-blue-700">Update</Text>
        </Pressable>
        <Pressable onPress={() => setApkUrl(null)} hitSlop={8} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

// lib/components/ChalanPhotos.tsx
import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase';
import { resizeImageForUpload } from '../utils/resizeImage';
import { showAlert, getErrorMessage } from '../utils/alert';

/** A photographed paper chalan (delivery/completion slip) for a job - only
 * the assigned technician can add one (see `editable`, set by the caller);
 * everyone else viewing the request just sees whatever's already attached.
 * Stored the same way as service_requests.photo_urls (private paths in the
 * request-photos bucket, one folder per uploader), signed on read so a
 * preview works without making the bucket public. */
export function ChalanPhotos({
  chalanUrls,
  requestId,
  userId,
  editable,
  onUploaded,
}: {
  chalanUrls: string[];
  requestId: string;
  userId?: string;
  editable: boolean;
  onUploaded: (urls: string[]) => void;
}) {
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const urls = await Promise.all(
        chalanUrls.map(async (path) => {
          const { data } = await supabase.storage.from('request-photos').createSignedUrl(path, 3600);
          return data?.signedUrl ?? null;
        })
      );
      if (!cancelled) setSignedUrls(urls.filter((u): u is string => !!u));
    }
    if (chalanUrls.length > 0) load();
    else setSignedUrls([]);
    return () => {
      cancelled = true;
    };
  }, [chalanUrls]);

  async function uploadFrom(uri: string, width: number | undefined) {
    if (!userId) return;
    setUploading(true);
    try {
      const resizedUri = await resizeImageForUpload(uri, width ?? 1024, 1024);
      const arraybuffer = await fetch(resizedUri).then((res) => res.arrayBuffer());
      const path = `${userId}/chalan-${requestId}-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('request-photos')
        .upload(path, arraybuffer, { contentType: 'image/jpeg' });
      if (error) throw error;
      onUploaded([...chalanUrls, path]);
    } catch (err) {
      showAlert('Could not add chalan', getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function launch(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert(
        fromCamera ? 'Camera access needed' : 'Photo access needed',
        fromCamera ? 'Allow camera access to photograph the chalan.' : 'Allow photo library access to pick the chalan.'
      );
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadFrom(result.assets[0].uri, result.assets[0].width);
  }

  function handleAdd() {
    // Camera capture isn't a good fit on the web build - skip straight to
    // the file picker there, same as Scan Bill.
    if (Platform.OS === 'web') {
      launch(false);
      return;
    }
    showAlert('Add chalan', 'Take a photo or pick one from your gallery.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose from Gallery', onPress: () => launch(false) },
      { text: 'Take Photo', onPress: () => launch(true) },
    ]);
  }

  if (chalanUrls.length === 0 && !editable) return null;

  return (
    <View className="mt-4">
      <Text className="mb-2 text-sm uppercase tracking-wide text-gray-400">Chalan</Text>
      {signedUrls.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          <View className="flex-row gap-2">
            {signedUrls.map((url, i) => (
              <Image key={i} source={{ uri: url }} className="h-24 w-24 rounded-lg" resizeMode="cover" />
            ))}
          </View>
        </ScrollView>
      )}
      {editable && (
        <Pressable
          onPress={handleAdd}
          disabled={uploading}
          className="flex-row items-center justify-center gap-1.5 self-start rounded-lg border border-blue-600 bg-blue-50 px-3 py-2 disabled:opacity-50"
        >
          <Ionicons name={uploading ? 'hourglass-outline' : 'camera-outline'} size={15} color="#2563EB" />
          <Text className="text-xs font-semibold text-blue-700">
            {uploading ? 'Uploading…' : chalanUrls.length > 0 ? 'Add another chalan' : 'Add chalan'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

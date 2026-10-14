// lib/components/ChalanPhotos.tsx
import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase';
import { resizeImageForUpload } from '../utils/resizeImage';
import { showAlert, getErrorMessage } from '../utils/alert';

type SignedPhoto = { url: string | null; error?: string };

/** A link to open one saved chalan photo, or the reason there is none. The saved value is normally a
 * path inside the request-photos bucket; a full link (an older save) is reduced to its path, or used
 * as it is when it points somewhere else. */
async function signPhoto(saved: string): Promise<SignedPhoto> {
  let path = saved.trim();
  if (/^https?:\/\//i.test(path)) {
    const inBucket = path.match(/\/request-photos\/([^?#]+)/);
    if (!inBucket) return { url: path };
    path = decodeURIComponent(inBucket[1]);
  }
  path = path.replace(/^\/+/, '').replace(/^request-photos\//, '');
  const { data, error } = await supabase.storage.from('request-photos').createSignedUrl(path, 3600);
  if (data?.signedUrl) return { url: data.signedUrl };
  const message = error?.message || 'The photo could not be found.';
  console.warn('[chalan photo]', path, message);
  return { url: null, error: message };
}

/** A photographed paper chalan (delivery/completion slip) for a job - only
 * the assigned technician can add one (see `editable`, set by the caller);
 * everyone else viewing the request just sees whatever's already attached.
 * Stored the same way as service_requests.photo_urls (private paths in the
 * request-photos bucket, one folder per uploader), signed on read so a
 * preview works without making the bucket public.
 *
 * A photo that can't be opened (the signed link could not be made) still
 * gets its place, marked "Can't open", so a saved chalan never just
 * disappears. Tapping one that opened shows it full size. */
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
  onUploaded: (urls: string[]) => void | Promise<unknown>;
}) {
  // One entry per saved photo, in order: its signed link, or why it could not be made.
  const [signedUrls, setSignedUrls] = useState<SignedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const urls = await Promise.all(chalanUrls.map(signPhoto));
      if (!cancelled) setSignedUrls(urls);
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
      // The storage upload above already succeeded at this point - awaiting
      // this lets a failure saving the row (e.g. a network drop) still land
      // in the same catch/alert below instead of failing silently, so the
      // technician isn't left thinking the chalan attached when it didn't.
      await onUploaded([...chalanUrls, path]);
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
      <Text className="mb-2 text-sm capitalize tracking-wide text-gray-400">Chalan</Text>
      {chalanUrls.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          <View className="flex-row gap-2">
            {chalanUrls.map((path, i) => {
              const signed = signedUrls[i];
              const url = signed?.url;
              if (url) {
                return (
                  <Pressable key={path} onPress={() => setViewing(url)} accessibilityRole="button" accessibilityLabel={`Open chalan photo ${i + 1}`}>
                    <Image source={{ uri: url }} className="h-24 w-24 rounded-lg" resizeMode="cover" />
                  </Pressable>
                );
              }
              // Still signing, or it could not be: keep the place, and say why, so the photo is not just missing.
              const waiting = !signed;
              return (
                <Pressable
                  key={path}
                  disabled={waiting}
                  onPress={() => showAlert("Can't open this photo", `${signed?.error ?? 'No link could be made.'}\n\nSaved as: ${path}`)}
                  accessibilityRole="button"
                  accessibilityLabel={waiting ? 'Loading the chalan photo' : "Why this chalan photo can't be opened"}
                  className="h-24 w-24 items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50"
                  style={{ gap: 3, ...(waiting ? { borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' } : null) }}
                >
                  <Ionicons name={waiting ? 'hourglass-outline' : 'alert-circle-outline'} size={20} color={waiting ? '#9CA3AF' : '#DC2626'} />
                  <Text className="px-1 text-center text-[10.5px] font-semibold" style={{ color: waiting ? '#6B7280' : '#B91C1C' }}>
                    {waiting ? 'Loading…' : "Can't open"}
                  </Text>
                  {!waiting && !!signed?.error && (
                    <Text className="px-1 text-center text-[9px] text-red-700" numberOfLines={3}>
                      {signed.error}
                    </Text>
                  )}
                </Pressable>
              );
            })}
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

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable
          onPress={() => setViewing(null)}
          className="flex-1 items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
        >
          {!!viewing && <Image source={{ uri: viewing }} style={{ width: '100%', height: '90%' }} resizeMode="contain" />}
          <View className="absolute right-4 top-4 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

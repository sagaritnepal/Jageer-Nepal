// lib/utils/catalogImage.ts
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase';
import { showAlert } from './alert';

export async function pickAndUploadCatalogImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showAlert('Photo access needed', 'Allow photo library access to upload a product photo.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || !result.assets[0]) return null;

  const arraybuffer = await fetch(result.assets[0].uri).then((res) => res.arrayBuffer());
  const path = `catalog/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('catalog-images')
    .upload(path, arraybuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('catalog-images').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

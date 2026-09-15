// app/(reseller)/company.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseUpdate } from '../../lib/hooks/useSupabase';
import { supabase } from '../../lib/supabase';
import { resizeImageForUpload } from '../../lib/utils/resizeImage';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { useWideDetail } from '../../lib/components/detail/DetailLayout';

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View>
      <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
        style={multiline ? { minHeight: 70, textAlignVertical: 'top' } : undefined}
      />
    </View>
  );
}

/** The reseller's company, used on quotations and shown to customers. These
 * fields already existed (quotations collect them once); this is the one
 * place to see and change them any time. */
export default function CompanyDetails() {
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const userId = profile?.id;
  const updateProfile = useSupabaseUpdate('profiles');
  const wide = useWideDetail();

  const [name, setName] = useState(profile?.business_name ?? '');
  const [regNo, setRegNo] = useState(profile?.business_reg_no ?? '');
  const [vatNo, setVatNo] = useState(profile?.business_vat_no ?? '');
  const [address, setAddress] = useState(profile?.business_address ?? '');
  const [phone, setPhone] = useState(profile?.business_phone ?? '');
  const [logoPath, setLogoPath] = useState<string | null>(profile?.business_logo_path ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const logoUrl = logoPath ? supabase.storage.from('business-assets').getPublicUrl(logoPath).data.publicUrl : null;

  async function handlePickLogo() {
    if (!userId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo library access to add your logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const resizedUri = await resizeImageForUpload(asset.uri, asset.width, 600);
      const arraybuffer = await fetch(resizedUri).then((res) => res.arrayBuffer());
      const path = `${userId}/logo-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('business-assets').upload(path, arraybuffer, { contentType: 'image/jpeg' });
      if (error) throw error;
      setLogoPath(path);
    } catch (err) {
      showAlert('Could not upload logo', getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!userId) return;
    if (!name.trim()) {
      showAlert('Add a company name', 'Enter your company name to save.');
      return;
    }
    setSaving(true);
    try {
      const values = {
        business_name: name.trim(),
        business_reg_no: regNo.trim() || null,
        business_vat_no: vatNo.trim() || null,
        business_address: address.trim() || null,
        business_phone: phone.trim() || null,
        business_logo_path: logoPath,
      };
      await updateProfile.mutateAsync({ id: userId, values });
      if (profile) setProfile({ ...profile, ...values });
      showAlert('Saved', 'Your company details are updated.');
      if (router.canGoBack()) router.back();
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: wide ? 32 : 16, paddingBottom: 48, alignItems: wide ? 'flex-start' : undefined }}
    >
      <View className="rounded-2xl border border-gray-200 bg-white p-5" style={wide ? { width: 640 } : undefined}>
        <View className="mb-5 flex-row items-center gap-4">
          <Pressable
            onPress={handlePickLogo}
            disabled={uploading}
            className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50"
          >
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={{ width: 80, height: 80 }} resizeMode="contain" />
            ) : (
              <Ionicons name="image-outline" size={26} color="#9CA3AF" />
            )}
          </Pressable>
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900">Company logo</Text>
            <Text className="mt-0.5 text-xs text-gray-400">
              {uploading ? 'Uploading…' : logoUrl ? 'Tap the logo to replace it' : 'Tap to add - shown on your quotations'}
            </Text>
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <Field label="Company name" value={name} onChange={setName} placeholder="e.g. Mansa Technology Pvt. Ltd." />
          <View className={wide ? 'flex-row' : ''} style={{ gap: 14 }}>
            <View className={wide ? 'flex-1' : ''}>
              <Field label="Registration no." value={regNo} onChange={setRegNo} placeholder="Company reg. no." />
            </View>
            <View className={wide ? 'flex-1' : ''}>
              <Field label="VAT / PAN no." value={vatNo} onChange={setVatNo} placeholder="VAT or PAN number" />
            </View>
          </View>
          <Field label="Address" value={address} onChange={setAddress} placeholder="Office address" multiline />
          <Field label="Company phone" value={phone} onChange={setPhone} placeholder="Office phone numbers" keyboardType="phone-pad" />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving || uploading}
          className="mt-6 h-12 items-center justify-center rounded-lg disabled:opacity-50"
          style={{ backgroundColor: '#2563EB' }}
        >
          <Text className="text-base font-semibold text-white">{saving ? 'Saving…' : 'Save company details'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

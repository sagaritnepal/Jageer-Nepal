// lib/components/ProfileScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Image, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate } from '../hooks/useSupabase';
import { supabase } from '../supabase';
import { ROLE_ACCENT } from '../constants/roleColors';
import { showAlert, getErrorMessage } from '../utils/alert';
import { resizeImageForUpload } from '../utils/resizeImage';
import type { Profile } from '../../types/database.types';

function initialsOf(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function AvatarEditor({ profile }: { profile: Profile }) {
  const setProfile = useAuthStore((state) => state.setProfile);
  const updateProfile = useSupabaseUpdate('profiles');
  const [uploading, setUploading] = useState(false);

  async function handlePick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo library access to set a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const resizedUri = await resizeImageForUpload(asset.uri, asset.width, 512);
      const arraybuffer = await fetch(resizedUri).then((res) => res.arrayBuffer());
      const path = `${profile.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arraybuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatar_url = `${data.publicUrl}?t=${Date.now()}`;
      await updateProfile.mutateAsync({ id: profile.id, values: { avatar_url } });
      setProfile({ ...profile, avatar_url });
    } catch (err) {
      showAlert('Could not update photo', getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Pressable onPress={handlePick} disabled={uploading} className="relative">
      <View className="h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/40 bg-white/20">
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <Text className="text-4xl font-extrabold text-white">{initialsOf(profile.full_name)}</Text>
        )}
      </View>
      <View className="absolute -bottom-1.5 -right-1.5 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-900">
        <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={16} color="white" />
      </View>
    </Pressable>
  );
}

function ProfileDetails({ profile }: { profile: Profile }) {
  const setProfile = useAuthStore((state) => state.setProfile);
  const updateProfile = useSupabaseUpdate('profiles');
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [address, setAddress] = useState(profile.city ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setFullName(profile.full_name ?? '');
    setAddress(profile.city ?? '');
    setPhone(profile.phone ?? '');
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const values = {
        full_name: fullName.trim() || null,
        city: address.trim() || null,
        phone: phone.trim() || null,
      };
      await updateProfile.mutateAsync({ id: profile.id, values });
      setProfile({ ...profile, ...values });
      setEditing(false);
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <View className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-gray-900">Your details</Text>
          <Pressable onPress={startEditing} className="flex-row items-center gap-1">
            <Ionicons name="pencil" size={13} color="#EA580C" />
            <Text className="text-xs font-bold text-orange-600">Edit</Text>
          </Pressable>
        </View>
        <Text className="text-sm text-gray-400">Name</Text>
        <Text className="mb-3 text-gray-900">{profile.full_name ?? 'Not set'}</Text>
        <Text className="text-sm text-gray-400">Address</Text>
        <Text className="mb-3 text-gray-900">{profile.city ?? 'Not set'}</Text>
        <Text className="text-sm text-gray-400">Contact</Text>
        <Text className="text-gray-900">{profile.phone ?? 'Not set'}</Text>
      </View>
    );
  }

  return (
    <View className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
      <Text className="mb-3 text-sm font-semibold text-gray-900">Edit your details</Text>

      <Text className="mb-1 text-xs font-medium text-gray-500">Name</Text>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Your full name"
        className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
      />

      <Text className="mb-1 text-xs font-medium text-gray-500">Address</Text>
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="Your address"
        className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
      />

      <Text className="mb-1 text-xs font-medium text-gray-500">Contact</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone number"
        keyboardType="phone-pad"
        className="mb-4 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
      />

      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setEditing(false)}
          className="flex-1 items-center rounded-lg border border-gray-300 py-2.5"
        >
          <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="flex-1 items-center rounded-lg bg-orange-500 py-2.5 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-white">{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TechnicianRatingStat({ technicianId }: { technicianId: string }) {
  const { data: reviews } = useSupabaseQuery('reviews', { filters: { technician_id: technicianId } });

  const average = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  return (
    <View className="flex-1 items-center rounded-xl bg-white/15 px-2 py-2.5">
      <Text className="text-[14.5px] font-extrabold text-white">{average == null ? '—' : `★ ${average.toFixed(1)}`}</Text>
      <Text className="mt-0.5 text-center text-[10.5px] text-white/85">
        {reviews?.length ?? 0} review{(reviews?.length ?? 0) === 1 ? '' : 's'}
      </Text>
    </View>
  );
}

function TechnicianAvailability({ profile }: { profile: Profile }) {
  const setProfile = useAuthStore((state) => state.setProfile);
  const updateProfile = useSupabaseUpdate('profiles');
  const [locating, setLocating] = useState(false);

  async function toggleAvailable(is_available: boolean) {
    try {
      await updateProfile.mutateAsync({ id: profile.id, values: { is_available } });
      setProfile({ ...profile, is_available });
    } catch (err) {
      showAlert('Could not update', getErrorMessage(err));
    }
  }

  async function updateLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Location permission needed', 'Allow location access so resellers can find nearby jobs.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      await updateProfile.mutateAsync({ id: profile.id, values: { latitude, longitude } });
      setProfile({ ...profile, latitude, longitude });
      showAlert('Location updated', 'Resellers can now see how far you are from a job.');
    } catch (err) {
      showAlert('Could not get location', getErrorMessage(err));
    } finally {
      setLocating(false);
    }
  }

  return (
    <View className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-semibold text-gray-900">My Status</Text>
          <Text className="mt-0.5 text-xs text-gray-400">
            {profile.is_available
              ? "You're available — resellers can assign you jobs"
              : "You're unavailable — resellers won't assign you jobs"}
          </Text>
        </View>
        <Switch
          value={profile.is_available}
          onValueChange={toggleAvailable}
          disabled={updateProfile.isPending}
          trackColor={{ false: '#D1D5DB', true: '#FDBA74' }}
          thumbColor={profile.is_available ? '#F97316' : '#F3F4F6'}
        />
      </View>

      <Pressable
        onPress={updateLocation}
        disabled={locating}
        className="mt-4 items-center rounded-lg border border-orange-500 bg-orange-50 py-2.5 disabled:opacity-50"
      >
        <Text className="text-sm font-semibold text-orange-600">
          {locating
            ? 'Locating…'
            : profile.latitude != null
              ? '📍 Location set — tap to update'
              : '📍 Share my location'}
        </Text>
      </Pressable>
    </View>
  );
}

function SkillsPicker({ profile }: { profile: Profile }) {
  const setProfile = useAuthStore((state) => state.setProfile);
  const updateProfile = useSupabaseUpdate('profiles');
  const { data: categories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(profile.skill_ids ?? []);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({ id: profile.id, values: { skill_ids: selected } });
      setProfile({ ...profile, skill_ids: selected });
      setOpen(false);
      showAlert('Skills updated', "You'll get matched to more requests and jobs in these categories.");
    } catch (err) {
      showAlert('Could not update skills', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = profile.skill_ids?.length ?? 0;

  if (!open) {
    return (
      <Pressable
        onPress={() => {
          setSelected(profile.skill_ids ?? []);
          setOpen(true);
        }}
        className="mb-4 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-orange-50">
          <Ionicons name="construct-outline" size={18} color="#EA580C" />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">My Skills</Text>
          <Text className="mt-0.5 text-xs text-gray-400">
            {selectedCount > 0
              ? `${selectedCount} selected — get matched to more jobs`
              : 'Select skills to get more related requests'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>
    );
  }

  return (
    <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="mb-1 text-sm font-semibold text-gray-900">Select your skills</Text>
      <Text className="mb-3 text-xs text-gray-400">
        Pick every category you can handle — you'll show up for more matching requests and jobs.
      </Text>
      <View className="mb-3">
        {(categories ?? []).map((c) => {
          const isSelected = selected.includes(c.id);
          return (
            <Pressable
              key={c.id}
              onPress={() => toggle(c.id)}
              className={`mb-2 flex-row items-center gap-3 rounded-xl border px-3 py-2.5 ${
                isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'
              }`}
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded-md border ${
                  isSelected ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'
                }`}
              >
                {isSelected && <Ionicons name="checkmark" size={13} color="white" />}
              </View>
              <Text className={`flex-1 text-sm font-medium ${isSelected ? 'text-orange-700' : 'text-gray-700'}`}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 items-center rounded-lg border border-gray-300 py-2.5"
        >
          <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="flex-1 items-center rounded-lg bg-orange-500 py-2.5 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-white">{saving ? 'Saving…' : 'Save skills'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReportIssue({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const insertTicket = useSupabaseInsert('support_tickets');

  async function handleSubmit() {
    if (!subject.trim()) return;
    try {
      await insertTicket.mutateAsync({ user_id: userId, subject: subject.trim() });
      setSubject('');
      setOpen(false);
      showAlert('Reported', "We've received your issue and will look into it.");
    } catch (err) {
      showAlert('Could not submit', getErrorMessage(err));
    }
  }

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        className="mb-4 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-orange-50">
          <Ionicons name="help-buoy-outline" size={18} color="#EA580C" />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">Report an Issue / Support</Text>
          <Text className="mt-0.5 text-xs text-gray-400">24/7 help desk</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>
    );
  }

  return (
    <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="mb-2 text-sm font-semibold text-gray-900">What's going wrong?</Text>
      <TextInput
        value={subject}
        onChangeText={setSubject}
        placeholder="Describe the issue"
        multiline
        className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 items-center rounded-lg border border-gray-300 py-2.5"
        >
          <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={insertTicket.isPending}
          className="flex-1 items-center rounded-lg bg-orange-500 py-2.5 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-white">{insertTicket.isPending ? 'Sending…' : 'Submit'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const profile = useAuthStore((state) => state.profile);
  const signOut = useAuthStore((state) => state.signOut);

  const accent = (profile && ROLE_ACCENT[profile.role]) || ROLE_ACCENT.client;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      <View
        style={{ backgroundColor: accent }}
        className="items-center rounded-b-[22px] px-6 pb-7 pt-16"
      >
        {profile ? (
          <AvatarEditor profile={profile} />
        ) : (
          <View className="h-32 w-32 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/20">
            <Text className="text-4xl font-extrabold text-white">?</Text>
          </View>
        )}
        <Text className="mt-2.5 text-lg font-extrabold text-white">{profile?.full_name ?? 'Your profile'}</Text>
        <View className="mt-1.5 rounded-full bg-white/20 px-3 py-1">
          <Text className="text-[11px] font-bold uppercase tracking-wide text-white">{profile?.role}</Text>
        </View>

        {profile?.role === 'technician' ? (
          <View className="mt-4 w-full flex-row gap-2.5">
            <TechnicianRatingStat technicianId={profile.id} />
            <View className="flex-1 items-center rounded-xl bg-white/15 px-2 py-2.5">
              <Text className="text-[14.5px] font-extrabold text-white">{profile.city ?? '—'}</Text>
              <Text className="mt-0.5 text-[10.5px] text-white/85">Service area</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View className="px-6 pt-5">
        {profile && <ProfileDetails profile={profile} />}

        {profile?.role === 'technician' && <TechnicianAvailability profile={profile} />}

        {profile && (profile.role === 'technician' || profile.role === 'reseller') && (
          <SkillsPicker profile={profile} />
        )}

        {profile && <ReportIssue userId={profile.id} />}

        <Pressable onPress={signOut} className="items-center rounded-xl border border-red-300 bg-white py-3.5">
          <Text className="font-semibold text-red-600">Sign Out from Jageer Nepal</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

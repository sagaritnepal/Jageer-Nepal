// lib/components/SavedContactsScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, Linking } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery, useSupabaseDelete } from '../hooks/useSupabase';
import { supabase } from '../supabase';
import { PersonAvatar } from './PersonAvatar';
import { SearchBar } from './SearchBar';
import { showAlert, getErrorMessage } from '../utils/alert';
import type { Profile, SavedContact, UserRole } from '../../types/database.types';

type RoleFilter = 'all' | 'reseller' | 'technician';

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  reseller: 'Reseller',
  technician: 'Technician',
  wholesaler: 'Wholesaler',
};

interface SavedEntry {
  saved: SavedContact;
  profile: Profile;
}

function useSavedContactProfiles(clientId: string | undefined) {
  const { data: savedRows, isLoading: loadingSaved } = useSupabaseQuery('saved_contacts', {
    filters: clientId ? { client_id: clientId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!clientId,
  });

  const contactIds = useMemo(() => (savedRows ?? []).map((r) => r.contact_id).sort(), [savedRows]);

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ['saved-contact-profiles', contactIds],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').in('id', contactIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: contactIds.length > 0,
  });

  const entries = useMemo((): SavedEntry[] => {
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (savedRows ?? [])
      .map((saved) => {
        const profile = profileById.get(saved.contact_id);
        return profile ? { saved, profile } : null;
      })
      .filter((e): e is SavedEntry => !!e);
  }, [savedRows, profiles]);

  return { entries, isLoading: loadingSaved || (contactIds.length > 0 && loadingProfiles) };
}

function ContactRow({ entry, basePath }: { entry: SavedEntry; basePath: string }) {
  const { profile, saved } = entry;
  const deleteContact = useSupabaseDelete('saved_contacts');

  function handleRemove() {
    showAlert('Remove contact?', `${profile.full_name ?? 'This contact'} will be removed from Saved Contacts.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteContact.mutateAsync(saved.id);
          } catch (err) {
            showAlert('Could not remove', getErrorMessage(err));
          }
        },
      },
    ]);
  }

  return (
    <View className="mb-2.5 rounded-2xl border border-gray-200 bg-white p-4">
      <Pressable
        onPress={() => profile.role === 'reseller' && router.push(`${basePath}/reseller/${profile.id}` as any)}
        className="flex-row items-center gap-3"
      >
        <PersonAvatar name={profile.full_name} photoUrl={profile.avatar_url} size={44} bg="bg-blue-600" />
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 font-semibold text-gray-900" numberOfLines={1}>
              {profile.full_name ?? 'Unnamed'}
            </Text>
            <View className="rounded-full bg-gray-100 px-2 py-0.5">
              <Text className="text-[10px] font-bold uppercase text-gray-500">
                {ROLE_LABEL[profile.role] ?? profile.role}
              </Text>
            </View>
          </View>
          {!!profile.phone && <Text className="mt-0.5 text-xs text-gray-500">{profile.phone}</Text>}
          {!!profile.city && <Text className="mt-0.5 text-xs text-gray-400">{profile.city}</Text>}
        </View>
        <Pressable onPress={handleRemove} hitSlop={8} className="p-1">
          <Ionicons name="close-circle" size={20} color="#D1D5DB" />
        </Pressable>
      </Pressable>

      {!!profile.phone && (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => Linking.openURL(`sms:${profile.phone}`)}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-teal-50 py-2.5"
          >
            <Ionicons name="chatbubble-outline" size={15} color="#0F766E" />
            <Text className="text-sm font-semibold text-teal-700">Message</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(`tel:${profile.phone}`)}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-orange-50 py-2.5"
          >
            <Ionicons name="call-outline" size={15} color="#1d4ed8" />
            <Text className="text-sm font-semibold text-orange-700">Call</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function FilterTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`rounded-full px-3.5 py-1.5 ${active ? 'bg-blue-600' : 'bg-gray-100'}`}>
      <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>{label}</Text>
    </Pressable>
  );
}

/** The client-facing "Saved Contacts" portal: resellers and technicians the
 * customer has bookmarked (via SaveContactButton, from Home's Recently Hired
 * list, a reseller's profile, or a past request) for quick lookup and
 * calling/messaging later, without hunting through old requests. */
export function SavedContactsScreen({ basePath }: { basePath: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RoleFilter>('all');
  const { entries, isLoading } = useSavedContactProfiles(userId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== 'all' && e.profile.role !== filter) return false;
      if (!q) return true;
      return (e.profile.full_name ?? '').toLowerCase().includes(q) || (e.profile.phone ?? '').includes(q);
    });
  }, [entries, search, filter]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name or phone" />

      <View className="my-3 flex-row gap-2">
        <FilterTab label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterTab label="Resellers" active={filter === 'reseller'} onPress={() => setFilter('reseller')} />
        <FilterTab label="Technicians" active={filter === 'technician'} onPress={() => setFilter('technician')} />
      </View>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.saved.id}
        renderItem={({ item }) => <ContactRow entry={item} basePath={basePath} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
              <Ionicons name="bookmark-outline" size={28} color="#D1D5DB" />
              <Text className="mt-2 text-gray-500">
                {entries.length > 0 ? 'No matches.' : 'No saved contacts yet.'}
              </Text>
              <Text className="px-6 text-center text-xs text-gray-400">
                Tap the bookmark icon next to a reseller or technician to add one here.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

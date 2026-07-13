// app/(admin)/users.tsx
import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useSupabaseQuery, useSupabaseUpdate, useSupabaseDelete } from '../../lib/hooks/useSupabase';
import { showAlert } from '../../lib/utils/alert';
import type { Profile, VerificationStatus } from '../../types/database.types';

const VERIFICATION_COLORS: Record<VerificationStatus, string> = {
  unverified: 'bg-gray-100 text-gray-600',
  pending: 'bg-amber-100 text-amber-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const ROLE_FILTERS = ['all', 'client', 'technician', 'reseller', 'wholesaler', 'admin'] as const;

function UserRow({ user }: { user: Profile }) {
  const updateProfile = useSupabaseUpdate('profiles');
  const deleteProfile = useSupabaseDelete('profiles');
  const needsVerification = user.role === 'technician' || user.role === 'reseller' || user.role === 'wholesaler';

  function setVerification(status: VerificationStatus) {
    updateProfile.mutate({ id: user.id, values: { verification_status: status } });
  }

  function toggleActive() {
    updateProfile.mutate({ id: user.id, values: { is_active: !user.is_active } });
  }

  function confirmRemove() {
    showAlert(
      'Remove this user?',
      'This deletes their profile and revokes app access. Their login itself must still be deleted from the Supabase dashboard separately.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteProfile.mutate(user.id) },
      ]
    );
  }

  return (
    <View className={`mb-3 rounded-lg border bg-white p-4 ${user.is_active ? 'border-gray-200' : 'border-red-200 opacity-60'}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">{user.full_name ?? 'Unnamed'}</Text>
          <View className="mt-1 flex-row items-center gap-2">
            <View className="rounded-full bg-blue-50 px-3 py-1">
              <Text className="text-xs font-semibold capitalize text-blue-700">{user.role}</Text>
            </View>
            {needsVerification && (
              <View className={`rounded-full px-3 py-1 ${VERIFICATION_COLORS[user.verification_status].split(' ')[0]}`}>
                <Text className={`text-xs font-semibold capitalize ${VERIFICATION_COLORS[user.verification_status].split(' ')[1]}`}>
                  {user.verification_status}
                </Text>
              </View>
            )}
            {!user.is_active && (
              <View className="rounded-full bg-red-100 px-3 py-1">
                <Text className="text-xs font-semibold text-red-700">Blocked</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {needsVerification && user.verification_status !== 'verified' && (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => setVerification('verified')}
            disabled={updateProfile.isPending}
            className="flex-1 items-center rounded-lg bg-green-600 py-2 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-white">Verify</Text>
          </Pressable>
          <Pressable
            onPress={() => setVerification('rejected')}
            disabled={updateProfile.isPending}
            className="flex-1 items-center rounded-lg border border-red-300 py-2 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-red-600">Reject</Text>
          </Pressable>
        </View>
      )}

      <View className="mt-3 flex-row gap-2">
        <Pressable
          onPress={toggleActive}
          disabled={updateProfile.isPending}
          className="flex-1 items-center rounded-lg border border-gray-300 py-2 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-gray-700">{user.is_active ? 'Block' : 'Unblock'}</Text>
        </Pressable>
        <Pressable
          onPress={confirmRemove}
          disabled={deleteProfile.isPending}
          className="flex-1 items-center rounded-lg bg-red-50 py-2 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-red-700">Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>('all');

  const { data: profiles, isLoading } = useSupabaseQuery('profiles', {
    orderBy: { column: 'created_at', ascending: false },
  });

  const filtered = roleFilter === 'all' ? profiles : profiles?.filter((p) => p.role === roleFilter);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-4 text-2xl font-bold text-gray-900">Users</Text>

      <View className="mb-4 flex-row flex-wrap gap-2">
        {ROLE_FILTERS.map((role) => (
          <Pressable
            key={role}
            onPress={() => setRoleFilter(role)}
            className={`rounded-full border px-3 py-1.5 ${
              roleFilter === role ? 'border-blue-700 bg-blue-50' : 'border-gray-300 bg-white'
            }`}
          >
            <Text className={roleFilter === role ? 'text-xs font-semibold capitalize text-blue-700' : 'text-xs capitalize text-gray-600'}>
              {role}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}

      <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={({ item }) => <UserRow user={item} />} />
    </View>
  );
}

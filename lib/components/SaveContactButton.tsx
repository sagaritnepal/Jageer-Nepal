// lib/components/SaveContactButton.tsx
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSupabaseQuery, useSupabaseInsert, useSupabaseDelete } from '../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../utils/alert';

/** Bare bookmark icon toggle for the client-side "Saved Contacts" portal:
 * bookmarks a reseller/technician profile so the client can find and
 * call/message them again later from Saved Contacts, without needing
 * another job together. Used inline in compact rows (Home's Recently
 * Hired list) - see SaveContactButtonLabeled for a labeled version. */
export function SaveContactButton({
  clientId,
  contactId,
  size = 17,
}: {
  clientId: string;
  contactId: string;
  size?: number;
}) {
  const { data: existing, isLoading } = useSupabaseQuery('saved_contacts', {
    filters: { client_id: clientId, contact_id: contactId },
  });
  const insertContact = useSupabaseInsert('saved_contacts');
  const deleteContact = useSupabaseDelete('saved_contacts');

  const savedRow = existing?.[0];
  const saved = !!savedRow;
  const pending = isLoading || insertContact.isPending || deleteContact.isPending;

  async function handleToggle() {
    try {
      if (savedRow) {
        await deleteContact.mutateAsync(savedRow.id);
      } else {
        await insertContact.mutateAsync({ client_id: clientId, contact_id: contactId });
      }
    } catch (err) {
      showAlert('Could not update', getErrorMessage(err));
    }
  }

  return (
    <Pressable onPress={handleToggle} disabled={pending} hitSlop={8}>
      {pending ? (
        <ActivityIndicator size="small" color={saved ? '#2563eb' : '#9CA3AF'} />
      ) : (
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={size} color={saved ? '#2563eb' : '#9CA3AF'} />
      )}
    </Pressable>
  );
}

/** Labeled "Save Contact" / "Saved" pill - for a profile header or request
 * card with more room than a compact list row. */
export function SaveContactButtonLabeled({ clientId, contactId }: { clientId: string; contactId: string }) {
  const { data: existing, isLoading } = useSupabaseQuery('saved_contacts', {
    filters: { client_id: clientId, contact_id: contactId },
  });
  const insertContact = useSupabaseInsert('saved_contacts');
  const deleteContact = useSupabaseDelete('saved_contacts');

  const savedRow = existing?.[0];
  const saved = !!savedRow;
  const pending = isLoading || insertContact.isPending || deleteContact.isPending;

  async function handleToggle() {
    try {
      if (savedRow) {
        await deleteContact.mutateAsync(savedRow.id);
      } else {
        await insertContact.mutateAsync({ client_id: clientId, contact_id: contactId });
      }
    } catch (err) {
      showAlert('Could not update', getErrorMessage(err));
    }
  }

  return (
    <Pressable
      onPress={handleToggle}
      disabled={pending}
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${saved ? 'bg-blue-50' : 'border border-gray-300 bg-white'}`}
    >
      {pending ? (
        <ActivityIndicator size="small" color={saved ? '#2563eb' : '#6B7280'} />
      ) : (
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={14} color={saved ? '#2563eb' : '#6B7280'} />
      )}
      <Text className={`text-xs font-semibold ${saved ? 'text-blue-700' : 'text-gray-600'}`}>
        {saved ? 'Saved' : 'Save Contact'}
      </Text>
    </Pressable>
  );
}

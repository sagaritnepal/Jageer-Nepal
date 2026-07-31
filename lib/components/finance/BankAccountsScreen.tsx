// lib/components/finance/BankAccountsScreen.tsx
import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useBankAccounts } from '../../hooks/useBankAccounts';
import { showAlert, getErrorMessage } from '../../utils/alert';

export function BankAccountsScreen() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { accounts, create, rename, remove } = useBankAccounts(userId);

  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await create(newName.trim());
      setNewName('');
    } catch (err) {
      showAlert('Could not add bank account', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    setSaving(true);
    try {
      await rename(id, renameValue.trim());
      setRenamingId(null);
    } catch (err) {
      showAlert('Could not rename bank account', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="mb-4 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="p-1">
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </Pressable>
        <Text className="text-base font-bold text-gray-900">Bank Accounts</Text>
      </View>

      <Text className="mb-4 text-xs text-gray-400">
        Add every bank account your business uses — each one then shows up as an option (alongside Cash) when
        recording a Sale, Purchase, or Expense, so you can track cash-in-hand and each bank's balance separately.
      </Text>

      <View className="mb-4 flex-row gap-2">
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. Nabil Bank - Current"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
        />
        <Pressable
          onPress={handleCreate}
          disabled={saving || !newName.trim()}
          className="items-center justify-center rounded-lg bg-blue-600 px-4 disabled:opacity-50"
        >
          <Ionicons name="add" size={20} color="white" />
        </Pressable>
      </View>

      <View className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-gray-100">
          <Ionicons name="cash-outline" size={16} color="#6B7280" />
        </View>
        <Text className="flex-1 text-sm font-semibold text-gray-900">Cash</Text>
        <Text className="text-xs text-gray-400">Always available</Text>
      </View>

      {accounts.length === 0 ? (
        <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
          <Ionicons name="business-outline" size={28} color="#D1D5DB" />
          <Text className="mt-2 text-gray-500">No bank accounts yet — add one above.</Text>
        </View>
      ) : (
        accounts.map((acc) => (
          <View key={acc.id} className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-blue-50">
              <Ionicons name="business-outline" size={16} color="#2563EB" />
            </View>
            {renamingId === acc.id ? (
              <>
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  autoFocus
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
                <Pressable onPress={() => handleRename(acc.id)} hitSlop={8} disabled={saving}>
                  <Ionicons name="checkmark" size={20} color="#059669" />
                </Pressable>
                <Pressable onPress={() => setRenamingId(null)} hitSlop={8}>
                  <Ionicons name="close" size={20} color="#9CA3AF" />
                </Pressable>
              </>
            ) : (
              <>
                <Text className="flex-1 text-sm font-semibold text-gray-900">{acc.name}</Text>
                <Pressable
                  onPress={() => {
                    setRenamingId(acc.id);
                    setRenameValue(acc.name);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="pencil-outline" size={17} color="#9CA3AF" />
                </Pressable>
                <Pressable
                  onPress={() =>
                    showAlert('Remove this bank account?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => remove(acc.id) },
                    ])
                  }
                  hitSlop={8}
                  className="ml-1"
                >
                  <Ionicons name="trash-outline" size={17} color="#9CA3AF" />
                </Pressable>
              </>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

// lib/components/finance/BankAccountPickerModal.tsx
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, getErrorMessage } from '../../utils/alert';
import type { BankAccount } from '../../../types/database.types';

// null selectedId/onSelect(null) means "Cash" - the one payment account that
// always exists and isn't a row in bank_accounts (a business has exactly one).
export function BankAccountPickerModal({
  visible,
  accounts,
  selectedId,
  onSelect,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: {
  visible: boolean;
  accounts: BankAccount[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreate(newName.trim());
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
      await onRename(id, renameValue.trim());
      setRenamingId(null);
    } catch (err) {
      showAlert('Could not rename bank account', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable onPress={() => {}} className="w-full max-w-sm rounded-xl bg-white p-3" style={{ maxHeight: '75%' }}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">Payment account</Text>
            <Pressable onPress={onClose} className="px-2 py-1">
              <Text className="text-sm font-semibold text-blue-700">Close</Text>
            </Pressable>
          </View>

          <View className="mb-3 flex-row gap-2">
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="New bank account name"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <Pressable
              onPress={handleCreate}
              disabled={saving || !newName.trim()}
              className="items-center justify-center rounded-lg bg-blue-600 px-3 disabled:opacity-50"
            >
              <Ionicons name="add" size={18} color="white" />
            </Pressable>
          </View>

          <ScrollView>
            <Pressable
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              className="mb-1.5 flex-row items-center gap-2 rounded-lg border border-gray-100 px-2 py-2"
            >
              <Ionicons name="cash-outline" size={16} color="#6B7280" />
              {selectedId === null && <Ionicons name="checkmark-circle" size={16} color="#2563EB" />}
              <Text className="flex-1 text-sm font-medium text-gray-900">Cash</Text>
            </Pressable>

            {accounts.length === 0 ? (
              <Text className="px-2 py-3 text-center text-sm text-gray-400">
                No bank accounts yet — add one above.
              </Text>
            ) : (
              accounts.map((acc) => (
                <View key={acc.id} className="mb-1.5 flex-row items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5">
                  {renamingId === acc.id ? (
                    <>
                      <TextInput
                        value={renameValue}
                        onChangeText={setRenameValue}
                        autoFocus
                        className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                      />
                      <Pressable onPress={() => handleRename(acc.id)} hitSlop={8} disabled={saving}>
                        <Ionicons name="checkmark" size={18} color="#059669" />
                      </Pressable>
                      <Pressable onPress={() => setRenamingId(null)} hitSlop={8}>
                        <Ionicons name="close" size={18} color="#9CA3AF" />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => {
                          onSelect(acc.id);
                          onClose();
                        }}
                        className="flex-1 flex-row items-center gap-2 py-1"
                      >
                        <Ionicons name="business-outline" size={16} color="#6B7280" />
                        {selectedId === acc.id && <Ionicons name="checkmark-circle" size={16} color="#2563EB" />}
                        <Text className="text-sm font-medium text-gray-900">{acc.name}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setRenamingId(acc.id);
                          setRenameValue(acc.name);
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="pencil-outline" size={15} color="#9CA3AF" />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          showAlert('Remove this bank account?', undefined, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => onDelete(acc.id) },
                          ])
                        }
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={15} color="#9CA3AF" />
                      </Pressable>
                    </>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

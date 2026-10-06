// lib/components/finance/PartyTypeField.tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyTypes } from '../../hooks/usePartyTypes';
import { showAlert, getErrorMessage } from '../../utils/alert';

const MAX_NAME_LENGTH = 30;

/**
 * "Party type" picker for the party forms: one chip per type (Customer,
 * Vendor, Employee and any the reseller added) - tap to choose, tap the chosen
 * one again to clear it. "Edit types" turns the chips into rename / delete
 * controls, and "Add type" makes a new one, so the list is the reseller's own.
 * Renders nothing when the types can't be loaded, so a form never breaks over
 * an optional label.
 */
export function PartyTypeField({
  ownerId,
  value,
  onChange,
}: {
  ownerId: string | undefined;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { types, available, create, rename, remove } = usePartyTypes(ownerId);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);

  if (!available) return null;

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const created = await create(name);
      setNewName('');
      setAdding(false);
      onChange(created.id);
    } catch (err) {
      showAlert('Could not add the type', getErrorMessage(err, 'A type with that name may already exist.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    setSaving(true);
    try {
      await rename(id, name);
      setRenamingId(null);
    } catch (err) {
      showAlert('Could not rename the type', getErrorMessage(err, 'A type with that name may already exist.'));
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove(id: string, name: string) {
    showAlert(`Delete "${name}"?`, 'Parties with this type are kept - they just have no type.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(id);
            if (value === id) onChange(null);
          } catch (err) {
            showAlert('Could not delete the type', getErrorMessage(err));
          }
        },
      },
    ]);
  }

  return (
    <View className="mb-2.5">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-gray-500">Party type</Text>
        <Pressable
          onPress={() => {
            setEditing((v) => !v);
            setRenamingId(null);
            setAdding(false);
          }}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text className="text-xs font-semibold text-blue-700">{editing ? 'Done' : 'Edit types'}</Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
        {types.map((t) => {
          const selected = value === t.id;

          if (editing && renamingId === t.id) {
            return (
              <View key={t.id} className="flex-row items-center rounded-full border border-blue-600 bg-white pl-3 pr-2" style={{ gap: 6 }}>
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  onSubmitEditing={() => handleRename(t.id)}
                  maxLength={MAX_NAME_LENGTH}
                  autoFocus
                  className="py-1.5 text-sm text-gray-900"
                  style={{ minWidth: 90 }}
                />
                <Pressable onPress={() => handleRename(t.id)} disabled={saving} hitSlop={8} accessibilityLabel="Save name">
                  <Ionicons name="checkmark" size={18} color="#059669" />
                </Pressable>
                <Pressable onPress={() => setRenamingId(null)} hitSlop={8} accessibilityLabel="Cancel rename">
                  <Ionicons name="close" size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            );
          }

          if (editing) {
            return (
              <View key={t.id} className="flex-row items-center rounded-full border border-gray-300 bg-white pl-3.5 pr-2.5" style={{ gap: 10, minHeight: 36 }}>
                <Text className="text-sm font-semibold text-gray-700">{t.name}</Text>
                <Pressable
                  onPress={() => {
                    setRenamingId(t.id);
                    setRenameValue(t.name);
                  }}
                  hitSlop={8}
                  accessibilityLabel={`Rename ${t.name}`}
                >
                  <Ionicons name="pencil-outline" size={15} color="#6B7280" />
                </Pressable>
                <Pressable onPress={() => confirmRemove(t.id, t.name)} hitSlop={8} accessibilityLabel={`Delete ${t.name}`}>
                  <Ionicons name="trash-outline" size={15} color="#DC2626" />
                </Pressable>
              </View>
            );
          }

          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(selected ? null : t.id)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`items-center justify-center rounded-full border px-3.5 ${selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`}
              style={{ minHeight: 36 }}
            >
              <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-gray-700'}`}>{t.name}</Text>
            </Pressable>
          );
        })}

        {adding ? (
          <View className="flex-row items-center rounded-full border border-blue-600 bg-white pl-3 pr-2" style={{ gap: 6 }}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={handleAdd}
              placeholder="New type"
              maxLength={MAX_NAME_LENGTH}
              autoFocus
              className="py-1.5 text-sm text-gray-900"
              style={{ minWidth: 100 }}
            />
            <Pressable onPress={handleAdd} disabled={saving || !newName.trim()} hitSlop={8} accessibilityLabel="Add type">
              <Ionicons name="checkmark" size={18} color={newName.trim() ? '#059669' : '#D1D5DB'} />
            </Pressable>
            <Pressable
              onPress={() => {
                setAdding(false);
                setNewName('');
              }}
              hitSlop={8}
              accessibilityLabel="Cancel"
            >
              <Ionicons name="close" size={18} color="#9CA3AF" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setAdding(true)}
            hitSlop={4}
            accessibilityRole="button"
            className="flex-row items-center rounded-full border border-dashed border-gray-300 px-3"
            style={{ gap: 4, minHeight: 36 }}
          >
            <Ionicons name="add" size={16} color="#1D4ED8" />
            <Text className="text-sm font-semibold text-blue-700">Add type</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

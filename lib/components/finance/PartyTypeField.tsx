// lib/components/finance/PartyTypeField.tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyTypes } from '../../hooks/usePartyTypes';
import { showAlert, getErrorMessage } from '../../utils/alert';

const MAX_NAME_LENGTH = 30;

/**
 * "Ledger type" dropdown for the party forms: a box showing the chosen type that
 * opens a list of them (Customer, Vendor, Employee and any the reseller added) right
 * under it - in the page rather than floating over it, so a popup cannot clip it.
 * Pick one and the list closes. In the list a type can be renamed or deleted, and
 * "Add new ledger type" makes one and chooses it, so the list is the reseller's own.
 * Renders nothing when the types can't be loaded, so a form never breaks over an
 * optional label.
 */
export function PartyTypeField({
  ownerId,
  value,
  onChange,
  required,
}: {
  ownerId: string | undefined;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Marks the label with a star - the form checks it. */
  required?: boolean;
}) {
  const { types, available, create, rename, remove } = usePartyTypes(ownerId);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);

  if (!available) return null;

  const current = types.find((t) => t.id === value);

  function toggle() {
    setOpen((v) => !v);
    setAdding(false);
    setNewName('');
    setRenamingId(null);
  }

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    // A name already in the list just picks it, instead of failing on a duplicate.
    const existing = types.find((t) => t.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) {
      setNewName('');
      setAdding(false);
      pick(existing.id);
      return;
    }
    setSaving(true);
    try {
      const created = await create(name);
      setNewName('');
      setAdding(false);
      pick(created.id);
    } catch (err) {
      showAlert('Could not add the ledger type', getErrorMessage(err));
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
      showAlert('Could not rename the ledger type', getErrorMessage(err, 'A type with that name may already exist.'));
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove(id: string, name: string) {
    showAlert(`Delete "${name}"?`, 'People with this ledger type are kept - they just have no ledger type.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(id);
            if (value === id) onChange(null);
          } catch (err) {
            showAlert('Could not delete the ledger type', getErrorMessage(err));
          }
        },
      },
    ]);
  }

  // A text box inside a row of the list: the row's own border is the focus mark, so
  // the browser's black outline on top of it is switched off.
  const typing = { outlineStyle: 'none' } as object;

  return (
    <View className="mb-2.5">
      <Text className="mb-1.5 text-xs font-semibold text-gray-600">{required ? 'Ledger type *' : 'Ledger type'}</Text>

      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Ledger type"
        className="flex-row items-center justify-between rounded-lg border bg-white px-3 py-2.5"
        style={{ borderColor: open ? '#2563EB' : '#D1D5DB' }}
      >
        <Text className={`text-sm ${current ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
          {current?.name ?? 'Select ledger type'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
      </Pressable>

      {open && (
        <View className="mt-1.5 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {types.map((t) => {
            const selected = t.id === value;
            if (renamingId === t.id) {
              return (
                <View key={t.id} className="flex-row items-center border-b border-gray-100 px-3 py-1.5" style={{ gap: 10 }}>
                  <TextInput
                    value={renameValue}
                    onChangeText={setRenameValue}
                    onSubmitEditing={() => handleRename(t.id)}
                    maxLength={MAX_NAME_LENGTH}
                    autoFocus
                    className="flex-1 py-1.5 text-sm text-gray-900"
                    style={typing}
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
            return (
              <View
                key={t.id}
                className="flex-row items-center border-b border-gray-100 pr-3"
                style={{ backgroundColor: selected ? '#EFF6FF' : '#FFFFFF' }}
              >
                <Pressable
                  onPress={() => pick(t.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className="flex-1 flex-row items-center py-2.5 pl-3"
                  style={{ gap: 10 }}
                >
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={selected ? '#2563EB' : '#D1D5DB'} />
                  <Text className={`flex-1 text-sm ${selected ? 'font-semibold text-blue-700' : 'text-gray-900'}`} numberOfLines={1}>
                    {t.name}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setRenamingId(t.id);
                    setRenameValue(t.name);
                  }}
                  hitSlop={8}
                  accessibilityLabel={`Rename ${t.name}`}
                  className="px-2"
                >
                  <Ionicons name="pencil-outline" size={15} color="#9CA3AF" />
                </Pressable>
                <Pressable onPress={() => confirmRemove(t.id, t.name)} hitSlop={8} accessibilityLabel={`Delete ${t.name}`} className="pl-1">
                  <Ionicons name="trash-outline" size={15} color="#9CA3AF" />
                </Pressable>
              </View>
            );
          })}

          {adding ? (
            <View className="flex-row items-center px-3 py-1.5" style={{ gap: 10 }}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={handleAdd}
                placeholder="New ledger type"
                placeholderTextColor="#9CA3AF"
                maxLength={MAX_NAME_LENGTH}
                autoFocus
                className="flex-1 py-1.5 text-sm text-gray-900"
                style={typing}
              />
              <Pressable onPress={handleAdd} disabled={saving || !newName.trim()} hitSlop={8} accessibilityLabel="Add ledger type">
                <Ionicons name="checkmark" size={18} color={newName.trim() && !saving ? '#059669' : '#D1D5DB'} />
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
            <Pressable onPress={() => setAdding(true)} accessibilityRole="button" className="flex-row items-center px-3 py-2.5" style={{ gap: 8 }}>
              <Ionicons name="add" size={16} color="#1D4ED8" />
              <Text className="text-sm font-semibold text-blue-700">Add new ledger type</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

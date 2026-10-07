// lib/components/finance/PartyTypeField.tsx
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyTypes } from '../../hooks/usePartyTypes';
import { showAlert, getErrorMessage } from '../../utils/alert';

const MAX_NAME_LENGTH = 30;

/**
 * "Ledger type" for the party forms: a box you type in. The types that match what is
 * typed (Customer, Vendor, Employee and any the reseller added) are listed under it -
 * all of them when the box is empty, attached right under it - and tapping one chooses it. Typing a name that is
 * not there offers `Add "x" as a new ledger type` in the same list, which makes it and
 * chooses it. Typing a name that is there exactly chooses it, so the same type is never
 * made twice.
 *
 * The form is told the chosen type's id, or null while what is typed is not a type
 * (yet), so "required" always means a real type was picked or added. Renders nothing
 * when the types can't be loaded, so a form never breaks over an optional label.
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
  const { types, available, create } = usePartyTypes(ownerId);
  // What has been typed; null means "show the chosen type's own name".
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!available) return null;

  const current = types.find((t) => t.id === value);
  const shown = text ?? current?.name ?? '';
  const typed = (text ?? '').trim();
  const lower = typed.toLowerCase();
  const matches = lower ? types.filter((t) => t.name.toLowerCase().includes(lower)) : types;
  const exact = types.find((t) => t.name.trim().toLowerCase() === lower);
  const canAdd = !!typed && !exact;

  function choose(id: string) {
    onChange(id);
    setText(null);
    setOpen(false);
  }

  function handleType(v: string) {
    setText(v);
    setOpen(true);
    // A name that is exactly a type chooses it; anything else is not a type yet.
    const hit = types.find((t) => t.name.trim().toLowerCase() === v.trim().toLowerCase());
    onChange(hit ? hit.id : null);
  }

  async function addTyped() {
    if (!typed || saving) return;
    if (exact) {
      choose(exact.id);
      return;
    }
    setSaving(true);
    try {
      choose((await create(typed)).id);
    } catch (err) {
      showAlert('Could not add the ledger type', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Enter: take the one type that matches, else add what was typed.
  function handleSubmit() {
    if (!typed) return;
    if (exact) choose(exact.id);
    else if (matches.length === 1) choose(matches[0].id);
    else addTyped();
  }

  // The browser's black outline on a text box is switched off where the box has a
  // border of its own to show focus with.
  const typing = { outlineStyle: 'none' } as object;

  const addRow = (
    <Pressable onPress={addTyped} disabled={saving} accessibilityRole="button" className="flex-row items-center px-1 py-2.5" style={{ gap: 8, opacity: saving ? 0.5 : 1 }}>
      <Ionicons name="add-circle-outline" size={15} color="#EA580C" />
      <Text className="flex-1 text-sm font-semibold text-blue-700" numberOfLines={2}>
        Add "{typed}" as a new ledger type
      </Text>
    </Pressable>
  );

  return (
    <View className="mb-2.5">
      <Text className="mb-1.5 text-xs font-semibold text-gray-600">{required ? 'Ledger type *' : 'Ledger type'}</Text>

      <TextInput
        value={shown}
        onChangeText={handleType}
        onSubmitEditing={handleSubmit}
        onFocus={() => {
          if (closeTimer.current) clearTimeout(closeTimer.current);
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
          // A moment later, so a tap on a suggestion still lands before the list goes.
          closeTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        placeholder="Type a ledger type"
        placeholderTextColor="#9CA3AF"
        maxLength={MAX_NAME_LENGTH}
        accessibilityLabel="Ledger type"
        className="rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900"
        style={[{ borderColor: focused ? '#2563EB' : '#D1D5DB' }, typing]}
      />

      {open ? (
        // Straight under the box, the way "Pick a customer" lists under its search box: just
        // the rows and their dividers, with no second bordered box around them.
        <View className="mt-2">
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
            {matches.length === 0 && !canAdd && <Text className="px-1 py-3 text-center text-sm text-gray-400">No ledger types yet.</Text>}
            {matches.map((t) => {
              const selected = t.id === value;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => choose(t.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className="flex-row items-center justify-between border-b border-gray-100 px-1 py-2.5"
                >
                  <Text className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-gray-900'}`} numberOfLines={1}>
                    {t.name}
                  </Text>
                  {selected && <Ionicons name="checkmark-circle" size={16} color="#2563EB" />}
                </Pressable>
              );
            })}
            {canAdd && addRow}
          </ScrollView>
        </View>
      ) : (
        // Typed but not chosen, and the list has closed: the way to add it stays in sight.
        canAdd && <View className="mt-2">{addRow}</View>
      )}
    </View>
  );
}

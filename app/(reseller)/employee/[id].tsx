// app/(reseller)/employee/[id].tsx
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { useSupabaseRow, useSupabaseUpdate, useSupabaseDelete } from '../../../lib/hooks/useSupabase';
import { useMyEmployees, useEndEmployment, useUpdateWorkHours } from '../../../lib/hooks/useTechnicianEmployment';
import { PersonAvatar } from '../../../lib/components/PersonAvatar';
import { TimeField } from '../../../lib/components/DateTimeFields';
import { useWideDetail } from '../../../lib/components/detail/DetailLayout';
import { showAlert, getErrorMessage } from '../../../lib/utils/alert';
import { isValidPhone10 } from '../../../lib/utils/phone';

const BLUE = '#2563EB';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-3.5">
      <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text>
      {children}
    </View>
  );
}

function Input(props: ComponentProps<typeof TextInput>) {
  return <TextInput {...props} className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900" />;
}

function SaveButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="h-12 flex-row items-center justify-center gap-2 rounded-xl disabled:opacity-50"
      style={{ backgroundColor: BLUE }}
    >
      <Ionicons name="checkmark" size={18} color="#fff" />
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

function Hours({ start, end, setStart, setEnd }: { start: string; end: string; setStart: (v: string) => void; setEnd: (v: string) => void }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1">
        <TimeField value={start} onChange={setStart} />
      </View>
      <Text className="text-xs text-gray-400">to</Text>
      <View className="flex-1">
        <TimeField value={end} onChange={setEnd} />
      </View>
    </View>
  );
}

/** An employee who has their own Jageer account: name, photo and phone come
 * from their profile (only they can change those); the employer owns the
 * work hours. */
function TechnicianEmployee({ employmentId }: { employmentId: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: employees } = useMyEmployees(userId);
  const match = employees.find((e) => e.employment.id === employmentId);
  const updateHours = useUpdateWorkHours();
  const endEmployment = useEndEmployment();
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!match || loaded) return;
    setStart(match.employment.work_start_time?.slice(0, 5) ?? '09:00');
    setEnd(match.employment.work_end_time?.slice(0, 5) ?? '17:00');
    setLoaded(true);
  }, [match, loaded]);

  if (!match) return <Text className="px-1 text-sm text-gray-500">Loading…</Text>;
  const { profile } = match;

  async function handleSave() {
    try {
      await updateHours.updateHours(employmentId, start, end);
      showAlert('Saved', 'Work hours updated.');
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    }
  }

  function handleRemove() {
    showAlert('Remove employee?', `${profile.full_name ?? 'This technician'} will go back to being an outsource technician.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await endEmployment.end(employmentId);
            router.back();
          } catch (err) {
            showAlert('Could not remove', getErrorMessage(err));
          }
        },
      },
    ]);
  }

  return (
    <>
      <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <PersonAvatar name={profile.full_name} photoUrl={profile.avatar_url} size={54} bg="bg-blue-600" />
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
            {profile.full_name ?? 'Technician'}
          </Text>
          <Text className="text-xs text-gray-500">Has a Jageer account · {profile.phone ?? 'No phone'}</Text>
        </View>
        {!!profile.phone && (
          <Pressable
            onPress={() => Linking.openURL(`tel:${profile.phone}`)}
            className="h-11 w-11 items-center justify-center rounded-full bg-blue-50"
            accessibilityLabel="Call"
          >
            <Ionicons name="call-outline" size={19} color={BLUE} />
          </Pressable>
        )}
      </View>

      <View className="rounded-2xl border border-gray-200 bg-white p-4">
        <Field label="Work hours">
          <Hours start={start} end={end} setStart={setStart} setEnd={setEnd} />
          <Text className="mt-2 text-[11.5px] leading-[17px] text-gray-400">
            You set these hours - the technician can see them but cannot change them. While on duty they work only
            for you and drop out of other resellers' technician lists.
          </Text>
        </Field>
        <SaveButton label={updateHours.isPending ? 'Saving…' : 'Save work hours'} onPress={handleSave} disabled={updateHours.isPending} />
      </View>

      <Text className="mt-4 px-1 text-[11.5px] text-gray-400">
        Their name, photo and phone number come from their own account, so only they can change those.
      </Text>

      <Pressable
        onPress={handleRemove}
        disabled={endEmployment.isPending}
        className="mt-4 items-center rounded-xl border border-red-200 bg-red-50 py-3 disabled:opacity-50"
      >
        <Text className="text-sm font-semibold text-red-600">Remove from my team</Text>
      </Pressable>
    </>
  );
}

/** Someone added by hand - every detail is the reseller's to edit. */
function ManualEmployee({ id }: { id: string }) {
  const { data: employee, isLoading } = useSupabaseRow('manual_employees', id);
  const update = useSupabaseUpdate('manual_employees');
  const remove = useSupabaseDelete('manual_employees');
  const [form, setForm] = useState({ name: '', email: '', phone: '', jobTitle: '', note: '', start: '09:00', end: '17:00', active: true });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!employee || loaded) return;
    setForm({
      name: employee.name ?? '',
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      jobTitle: employee.job_title ?? '',
      note: employee.note ?? '',
      start: employee.work_start_time?.slice(0, 5) ?? '09:00',
      end: employee.work_end_time?.slice(0, 5) ?? '17:00',
      active: employee.is_active,
    });
    setLoaded(true);
  }, [employee, loaded]);

  if (isLoading && !employee) return <Text className="px-1 text-sm text-gray-500">Loading…</Text>;
  if (!employee) return <Text className="px-1 text-sm text-gray-500">This employee is no longer on your team.</Text>;

  async function handleSave() {
    if (!form.name.trim()) {
      showAlert('Add a name', 'Type the name of the person you are keeping on your team.');
      return;
    }
    if (form.phone.trim() && !isValidPhone10(form.phone.trim())) {
      showAlert('Check the phone number', 'Enter a 10-digit number, or leave it blank.');
      return;
    }
    try {
      await update.mutateAsync({
        id,
        values: {
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          job_title: form.jobTitle.trim() || null,
          note: form.note.trim() || null,
          work_start_time: form.start,
          work_end_time: form.end,
          is_active: form.active,
        },
      });
      showAlert('Saved', 'Employee details updated.');
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    }
  }

  function handleDelete() {
    showAlert('Delete this employee?', `${form.name || 'This person'} will be removed from your team list.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(id);
            router.back();
          } catch (err) {
            showAlert('Could not delete', getErrorMessage(err));
          }
        },
      },
    ]);
  }

  return (
    <>
      <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <PersonAvatar name={form.name} size={54} bg="bg-gray-500" />
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
            {form.name || 'Employee'}
          </Text>
          <Text className="text-xs text-gray-500">Added by you{form.jobTitle ? ` · ${form.jobTitle}` : ''}</Text>
        </View>
        {!!form.phone && (
          <Pressable
            onPress={() => Linking.openURL(`tel:${form.phone}`)}
            className="h-11 w-11 items-center justify-center rounded-full bg-blue-50"
            accessibilityLabel="Call"
          >
            <Ionicons name="call-outline" size={19} color={BLUE} />
          </Pressable>
        )}
      </View>

      <View className="rounded-2xl border border-gray-200 bg-white p-4">
        <Field label="Name">
          <Input value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Full name" />
        </Field>
        <Field label="Email">
          <Input
            value={form.email}
            onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>
        <Field label="Phone number">
          <Input
            value={form.phone}
            onChangeText={(v) => setForm((f) => ({ ...f, phone: v.replace(/[^0-9]/g, '') }))}
            placeholder="98XXXXXXXX"
            keyboardType="phone-pad"
            maxLength={10}
          />
        </Field>
        <Field label="Job title">
          <Input value={form.jobTitle} onChangeText={(v) => setForm((f) => ({ ...f, jobTitle: v }))} placeholder="CCTV technician, helper, driver…" />
        </Field>
        <Field label="Work hours">
          <Hours
            start={form.start}
            end={form.end}
            setStart={(v) => setForm((f) => ({ ...f, start: v }))}
            setEnd={(v) => setForm((f) => ({ ...f, end: v }))}
          />
        </Field>
        <Field label="Notes">
          <Input
            value={form.note}
            onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
            placeholder="Anything you want to remember"
            multiline
            style={{ minHeight: 76, textAlignVertical: 'top' }}
          />
        </Field>

        <Pressable
          onPress={() => setForm((f) => ({ ...f, active: !f.active }))}
          className="mb-4 flex-row items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3"
        >
          <Ionicons name={form.active ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={form.active ? '#059669' : '#9CA3AF'} />
          <Text className="flex-1 text-sm font-medium text-gray-800">
            {form.active ? 'Currently working for you' : 'No longer working for you'}
          </Text>
        </Pressable>

        <SaveButton label={update.isPending ? 'Saving…' : 'Save changes'} onPress={handleSave} disabled={update.isPending} />
      </View>

      <Pressable
        onPress={handleDelete}
        disabled={remove.isPending}
        className="mt-4 items-center rounded-xl border border-red-200 bg-red-50 py-3 disabled:opacity-50"
      >
        <Text className="text-sm font-semibold text-red-600">Delete from my team</Text>
      </Pressable>
    </>
  );
}

/** One employee's page. `kind=manual` opens a hand-added person (every field
 * editable); anything else is an employment row for a technician with their
 * own account, where only the work hours belong to the employer. */
export default function EmployeeDetail() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const wide = useWideDetail();

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: wide ? 32 : 16, paddingBottom: 48, maxWidth: 620, width: '100%', alignSelf: 'center' }}
    >
      {kind === 'manual' ? <ManualEmployee id={id} /> : <TechnicianEmployee employmentId={id} />}
    </ScrollView>
  );
}

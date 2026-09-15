// app/(reseller)/employee/[id].tsx
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { useSupabaseRow, useSupabaseUpdate, useSupabaseDelete } from '../../../lib/hooks/useSupabase';
import {
  useMyEmployees,
  useEmployeeEmails,
  useEndEmployment,
  useUpdateEmployment,
} from '../../../lib/hooks/useTechnicianEmployment';
import { PersonAvatar } from '../../../lib/components/PersonAvatar';
import { TimeField } from '../../../lib/components/DateTimeFields';
import { useWideDetail } from '../../../lib/components/detail/DetailLayout';
import { showAlert, getErrorMessage } from '../../../lib/utils/alert';
import { isValidPhone10 } from '../../../lib/utils/phone';

const BLUE = '#2563EB';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View className="mb-3.5">
      <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text>
      {children}
      {!!hint && <Text className="mt-1 text-[11px] text-gray-400">{hint}</Text>}
    </View>
  );
}

function Input(props: ComponentProps<typeof TextInput>) {
  return <TextInput {...props} className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900" />;
}

/** A detail that lives on the person's own account - shown in the same slot
 * as an editable field so both employee pages read alike, but not typed
 * into, since only they can change it. */
function ReadOnlyValue({ value, empty }: { value: string | null; empty: string }) {
  return (
    <View className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <Text className={`text-base ${value ? 'text-gray-700' : 'text-gray-400'}`}>{value || empty}</Text>
    </View>
  );
}

function HoursRow({ start, end, setStart, setEnd }: { start: string; end: string; setStart: (v: string) => void; setEnd: (v: string) => void }) {
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

function Header({ name, subtitle, photoUrl, phone }: { name: string; subtitle: string; photoUrl?: string | null; phone: string | null }) {
  return (
    <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <PersonAvatar name={name} photoUrl={photoUrl} size={54} bg={photoUrl ? 'bg-blue-600' : 'bg-gray-500'} />
      <View className="flex-1">
        <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
          {name || 'Employee'}
        </Text>
        <Text className="text-xs text-gray-500">{subtitle}</Text>
      </View>
      {!!phone && (
        <Pressable
          onPress={() => Linking.openURL(`tel:${phone}`)}
          className="h-11 w-11 items-center justify-center rounded-full bg-blue-50"
          accessibilityLabel="Call"
        >
          <Ionicons name="call-outline" size={19} color={BLUE} />
        </Pressable>
      )}
    </View>
  );
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

function RemoveButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 disabled:opacity-50"
    >
      <Ionicons name="person-remove-outline" size={17} color="#DC2626" />
      <Text className="text-sm font-semibold text-red-600">{label}</Text>
    </Pressable>
  );
}

/** An employee with their own Jageer account. Same fields as a hand-added
 * person, except name, email and phone belong to their account - the
 * employer owns the job title, work hours and note (enforced by the
 * technician_employment_hours_guard trigger). */
function TechnicianEmployee({ employmentId }: { employmentId: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: employees } = useMyEmployees(userId);
  const emailOf = useEmployeeEmails(userId);
  const match = employees.find((e) => e.employment.id === employmentId);
  const update = useUpdateEmployment();
  const endEmployment = useEndEmployment();
  const [form, setForm] = useState({ jobTitle: '', note: '', start: '09:00', end: '17:00' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!match || loaded) return;
    setForm({
      jobTitle: match.employment.job_title ?? '',
      note: match.employment.employer_note ?? '',
      start: match.employment.work_start_time?.slice(0, 5) ?? '09:00',
      end: match.employment.work_end_time?.slice(0, 5) ?? '17:00',
    });
    setLoaded(true);
  }, [match, loaded]);

  if (!match) return <Text className="px-1 text-sm text-gray-500">Loading…</Text>;
  const { profile } = match;
  const email = emailOf.get(profile.id) ?? null;

  async function handleSave() {
    try {
      await update.save(employmentId, {
        job_title: form.jobTitle.trim() || null,
        employer_note: form.note.trim() || null,
        work_start_time: form.start,
        work_end_time: form.end,
      });
      showAlert('Saved', 'Employee details updated.');
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    }
  }

  function handleRemove() {
    showAlert('Remove from your team?', `${profile.full_name ?? 'This technician'} will go back to being an outsource technician.`, [
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
      <Header
        name={profile.full_name ?? 'Technician'}
        subtitle={`Has a Jageer account${form.jobTitle ? ` · ${form.jobTitle}` : ''}`}
        photoUrl={profile.avatar_url}
        phone={profile.phone}
      />

      <View className="rounded-2xl border border-gray-200 bg-white p-4">
        <Field label="Name" hint="From their own account - only they can change it.">
          <ReadOnlyValue value={profile.full_name} empty="No name yet" />
        </Field>
        <Field label="Email" hint="The address they signed in with.">
          <ReadOnlyValue value={email} empty="No email on their account" />
        </Field>
        <Field label="Phone number">
          <ReadOnlyValue value={profile.phone} empty="No phone on their account" />
        </Field>
        <Field label="Job title" hint="Your label for what they do - they can't change it.">
          <Input value={form.jobTitle} onChangeText={(v) => setForm((f) => ({ ...f, jobTitle: v }))} placeholder="CCTV technician, helper, driver…" />
        </Field>
        <Field label="Work hours" hint="You set these - the technician can see them but can't change them. While on duty they work only for you.">
          <HoursRow
            start={form.start}
            end={form.end}
            setStart={(v) => setForm((f) => ({ ...f, start: v }))}
            setEnd={(v) => setForm((f) => ({ ...f, end: v }))}
          />
        </Field>
        <Field label="Notes" hint="Private to you.">
          <Input
            value={form.note}
            onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
            placeholder="Anything you want to remember"
            multiline
            style={{ minHeight: 76, textAlignVertical: 'top' }}
          />
        </Field>

        <SaveButton label={update.isPending ? 'Saving…' : 'Save changes'} onPress={handleSave} disabled={update.isPending} />
      </View>

      <RemoveButton label="Remove from my team" onPress={handleRemove} disabled={endEmployment.isPending} />
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

  function handleRemove() {
    showAlert('Remove from your team?', `${form.name || 'This person'} will be deleted from your team list.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(id);
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
      <Header
        name={form.name}
        subtitle={`Added by you${form.jobTitle ? ` · ${form.jobTitle}` : ''}`}
        phone={form.phone || null}
      />

      <View className="rounded-2xl border border-gray-200 bg-white p-4">
        <Field label="Name">
          <Input value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Full name" />
        </Field>
        <Field label="Email" hint="If they sign up with this address, they link to your team automatically.">
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
          <HoursRow
            start={form.start}
            end={form.end}
            setStart={(v) => setForm((f) => ({ ...f, start: v }))}
            setEnd={(v) => setForm((f) => ({ ...f, end: v }))}
          />
        </Field>
        <Field label="Notes" hint="Private to you.">
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

      <RemoveButton label="Remove from my team" onPress={handleRemove} disabled={remove.isPending} />
    </>
  );
}

/** One employee's page. `kind=manual` opens a hand-added person; anything
 * else is an employment row for a technician with their own account. Both
 * show the same fields in the same order. */
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

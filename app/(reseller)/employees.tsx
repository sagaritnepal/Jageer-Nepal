// app/(reseller)/employees.tsx
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Linking, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery, useSupabaseInsert } from '../../lib/hooks/useSupabase';
import {
  useMyEmployees,
  usePendingHires,
  useSentInvites,
  useInviteTechnician,
  useFindTechnicianByPhone,
  useFindTechnicianByEmail,
  useSearchTechnicians,
  useRespondToHire,
  useEndEmployment,
} from '../../lib/hooks/useTechnicianEmployment';
import { PersonAvatar } from '../../lib/components/PersonAvatar';
import { TimeField } from '../../lib/components/DateTimeFields';
import { useWideDetail } from '../../lib/components/detail/DetailLayout';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { isValidPhone10 } from '../../lib/utils/phone';
import type { ManualEmployee, Profile, TechnicianEmployment } from '../../types/database.types';

const BLUE = '#2563EB';
const GREEN = '#059669';

function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function hours(e: { work_start_time: string | null; work_end_time: string | null }) {
  return `${e.work_start_time?.slice(0, 5) ?? '09:00'} to ${e.work_end_time?.slice(0, 5) ?? '17:00'}`;
}

function openEmployee(id: string, kind?: 'manual') {
  router.push(`/(reseller)/employee/${id}${kind ? '?kind=manual' : ''}` as any);
}

/** One of the two big cards at the top - each opens its own form. */
function ActionCard({
  icon,
  title,
  body,
  color,
  tint,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  color: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3.5 rounded-2xl p-4"
      style={{ backgroundColor: tint, borderWidth: 1, borderColor: `${color}33`, flexGrow: 1, flexBasis: 280 }}
    >
      <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-bold text-gray-900">{title}</Text>
        <Text className="mt-0.5 text-xs leading-[17px] text-gray-600">{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color} />
    </Pressable>
  );
}

function FormModal({
  visible,
  title,
  subtitle,
  color,
  submitLabel,
  submitting,
  onSubmit,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  color: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" onPress={onClose}>
          <Pressable onPress={() => {}} className="w-full overflow-hidden rounded-2xl bg-white" style={{ maxWidth: 460, maxHeight: '90%' }}>
            <View className="flex-row items-center gap-2.5 px-5 py-4" style={{ backgroundColor: color }}>
              <View className="flex-1">
                <Text className="text-[16px] font-bold text-white">{title}</Text>
                <Text className="mt-0.5 text-[11.5px] leading-[16px] text-white/85">{subtitle}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
              {children}

              <Pressable
                onPress={onSubmit}
                disabled={submitting}
                className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-xl disabled:opacity-50"
                style={{ backgroundColor: color }}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text className="text-base font-semibold text-white">{submitLabel}</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <View>
      <Text className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-400">
        {title}
        {count != null ? ` (${count})` : ''}
      </Text>
      <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white">{children}</View>
    </View>
  );
}

function PersonLine({
  profile,
  sub,
  last,
  children,
}: {
  profile: Profile;
  sub: string;
  last: boolean;
  children?: ReactNode;
}) {
  const wide = useWideDetail();
  const who = (
    <>
      <PersonAvatar name={profile.full_name} photoUrl={profile.avatar_url} size={42} bg="bg-blue-600" />
      <View className="flex-1">
        <Text className="font-semibold text-gray-900" numberOfLines={1}>
          {profile.full_name ?? 'Technician'}
        </Text>
        <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={wide ? 1 : 2}>
          {sub}
        </Text>
      </View>
    </>
  );

  // On a phone the buttons get their own line - beside the name they
  // squeezed it down to "Sushant ...".
  if (!wide) {
    return (
      <View className={`px-4 py-3.5 ${last ? '' : 'border-b border-gray-100'}`}>
        <View className="flex-row items-center gap-3">{who}</View>
        {!!children && (
          <View className="mt-3 flex-row items-center justify-end" style={{ gap: 8 }}>
            {children}
          </View>
        )}
      </View>
    );
  }

  return (
    <View className={`flex-row items-center gap-3 px-4 py-3.5 ${last ? '' : 'border-b border-gray-100'}`}>
      {who}
      {children}
    </View>
  );
}

function SmallButton({ label, onPress, kind = 'primary', disabled }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  const style =
    kind === 'primary'
      ? { backgroundColor: BLUE, borderWidth: 0 }
      : kind === 'danger'
        ? { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }
        : { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB' };
  const color = kind === 'primary' ? '#FFFFFF' : kind === 'danger' ? '#DC2626' : '#374151';
  return (
    <Pressable onPress={onPress} disabled={disabled} className="h-9 items-center justify-center rounded-lg px-3 disabled:opacity-50" style={style}>
      <Text className="text-xs font-semibold" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Employee with their own account. Tapping the row opens their page,
 * where the employer sets the work hours - technicians can't change their
 * own (see the technician_employment_hours_guard trigger). */
function EmployeeRow({ employment, profile, last }: { employment: TechnicianEmployment; profile: Profile; last: boolean }) {
  return (
    <PersonLine profile={profile} sub={`${profile.phone ?? 'No phone'} · On duty ${hours(employment)}`} last={last}>
      {!!profile.phone && (
        <Pressable onPress={() => Linking.openURL(`tel:${profile.phone}`)} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full bg-blue-50">
          <Ionicons name="call-outline" size={17} color={BLUE} />
        </Pressable>
      )}
      <SmallButton label="Open" kind="ghost" onPress={() => openEmployee(employment.id)} />
    </PersonLine>
  );
}

/** Someone added by hand (no Jageer account) - a record the reseller keeps
 * so their whole team is in one place. */
function ManualEmployeeRow({ employee, last }: { employee: ManualEmployee; last: boolean }) {
  const sub = [
    employee.job_title,
    employee.phone ?? employee.email ?? 'No phone',
    employee.is_active ? `On duty ${hours(employee)}` : 'No longer working for you',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View className={`px-4 py-3.5 ${last ? '' : 'border-b border-gray-100'}`}>
      <View className="flex-row items-center gap-3">
        <PersonAvatar name={employee.name} size={42} bg="bg-gray-500" />
        <View className="flex-1">
          <Text className="font-semibold text-gray-900" numberOfLines={1}>
            {employee.name}
          </Text>
          <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
            {sub}
          </Text>
        </View>
        {!!employee.phone && (
          <Pressable onPress={() => Linking.openURL(`tel:${employee.phone}`)} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full bg-blue-50">
            <Ionicons name="call-outline" size={17} color={BLUE} />
          </Pressable>
        )}
        <SmallButton label="Edit" kind="ghost" onPress={() => openEmployee(employee.id, 'manual')} />
      </View>
    </View>
  );
}

export default function TechnicalEmployees() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const wide = useWideDetail();
  const { data: employees } = useMyEmployees(userId);
  const { data: invites } = useSentInvites(userId);
  const { data: applications } = usePendingHires(userId);
  const inviteTechnician = useInviteTechnician();
  const findByPhone = useFindTechnicianByPhone();
  const findByEmail = useFindTechnicianByEmail();
  const respond = useRespondToHire();
  const endEmployment = useEndEmployment();
  const { data: manualEmployees } = useSupabaseQuery('manual_employees', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });
  const addManual = useSupabaseInsert('manual_employees');

  const [showInvite, setShowInvite] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [sending, setSending] = useState(false);

  // Invite form: find someone who already has a technician account.
  const [query, setQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [inviteStart, setInviteStart] = useState('09:00');
  const [inviteEnd, setInviteEnd] = useState('17:00');

  // Manual form: someone with no account at all.
  const [manual, setManual] = useState({ name: '', email: '', phone: '', jobTitle: '', start: '09:00', end: '17:00' });

  const debouncedQuery = useDebounced(query);
  const { data: searchResults, isFetching: searching } = useSearchTechnicians(selected ? '' : debouncedQuery);

  // Already-employed or already-invited technicians shouldn't show up as
  // search results - there's nothing useful to do with them here.
  const takenIds = useMemo(
    () => new Set([...employees.map((e) => e.profile.id), ...invites.map((e) => e.profile.id)]),
    [employees, invites]
  );
  const results = (searchResults ?? []).filter((p) => !takenIds.has(p.id));

  function resetInvite() {
    setQuery('');
    setInviteEmail('');
    setInvitePhone('');
    setSelected(null);
    setInviteStart('09:00');
    setInviteEnd('17:00');
  }

  function handleSelect(technician: Profile) {
    setSelected(technician);
    setQuery(technician.full_name ?? technician.phone ?? '');
  }

  async function handleInvite() {
    if (!userId) return;
    setSending(true);
    try {
      let technician = selected;
      if (!technician && invitePhone.trim()) {
        if (!isValidPhone10(invitePhone.trim())) {
          showAlert('Check the phone number', 'Enter their 10-digit number, or leave it blank and use the email instead.');
          return;
        }
        technician = await findByPhone(invitePhone.trim());
      }
      if (!technician && inviteEmail.trim()) {
        technician = await findByEmail(inviteEmail.trim());
      }
      if (!technician) {
        showAlert(
          'Technician not found',
          'Search by name, or type the exact phone number or email they signed up with. If they have no account yet, use "Add a technician" instead.'
        );
        return;
      }
      if (employees.some((e) => e.profile.id === technician!.id)) {
        showAlert('Already your employee', `${technician.full_name ?? 'This technician'} already works for you.`);
        return;
      }
      await inviteTechnician.invite({
        technicianId: technician.id,
        resellerId: userId,
        workStartTime: inviteStart,
        workEndTime: inviteEnd,
      });
      resetInvite();
      setShowInvite(false);
      showAlert('Invite sent', `${technician.full_name ?? 'The technician'} will see your invite and can accept it.`);
    } catch (err) {
      const message = getErrorMessage(err);
      showAlert(
        'Could not send invite',
        message.includes('one_pending_pair') ? 'You already have an open invite or request with this technician.' : message
      );
    } finally {
      setSending(false);
    }
  }

  async function handleAddManual() {
    if (!userId) return;
    if (!manual.name.trim()) {
      showAlert('Add a name', 'Type the name of the person you are adding to your team.');
      return;
    }
    if (manual.phone.trim() && !isValidPhone10(manual.phone.trim())) {
      showAlert('Check the phone number', 'Enter a 10-digit number, or leave it blank.');
      return;
    }
    try {
      await addManual.mutateAsync({
        owner_id: userId,
        name: manual.name.trim(),
        email: manual.email.trim() || null,
        phone: manual.phone.trim() || null,
        job_title: manual.jobTitle.trim() || null,
        work_start_time: manual.start,
        work_end_time: manual.end,
      });
      setManual({ name: '', email: '', phone: '', jobTitle: '', start: '09:00', end: '17:00' });
      setShowAdd(false);
    } catch (err) {
      showAlert('Could not add', getErrorMessage(err));
    }
  }

  async function handleRespond(id: string, accept: boolean) {
    try {
      await respond.respond(id, accept);
    } catch (err) {
      const message = getErrorMessage(err);
      showAlert('Could not update', message.includes('one_active') ? 'This technician already works for another reseller.' : message);
    }
  }

  async function handleCancelInvite(id: string) {
    try {
      await endEmployment.end(id);
    } catch (err) {
      showAlert('Could not cancel', getErrorMessage(err));
    }
  }

  const manualList = manualEmployees ?? [];

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: wide ? 32 : 16, paddingTop: wide ? 24 : 16, paddingBottom: 48, gap: 20 }}
    >
      <View className="flex-row flex-wrap" style={{ gap: 12 }}>
        <ActionCard
          icon="person-add"
          title="Invite a technician"
          body="They already use Jageer - once they accept you can send them jobs."
          color={BLUE}
          tint="#EFF6FF"
          onPress={() => setShowInvite(true)}
        />
        <ActionCard
          icon="people"
          title="Add a technician"
          body="Staff with no Jageer account - kept here so you can call them."
          color={GREEN}
          tint="#ECFDF5"
          onPress={() => setShowAdd(true)}
        />
      </View>

      <Section title="My technical employees" count={employees.length}>
        {employees.length === 0 ? (
          <Text className="px-4 py-5 text-sm text-gray-500">No employees yet - invite a technician to get started.</Text>
        ) : (
          employees.map(({ employment, profile }, i) => (
            <EmployeeRow key={employment.id} employment={employment} profile={profile} last={i === employees.length - 1} />
          ))
        )}
      </Section>

      {manualList.length > 0 && (
        <Section title="Added by me (no account)" count={manualList.length}>
          {manualList.map((employee, i) => (
            <ManualEmployeeRow key={employee.id} employee={employee} last={i === manualList.length - 1} />
          ))}
        </Section>
      )}

      {applications.length > 0 && (
        <Section title="Asked to join you" count={applications.length}>
          {applications.map(({ employment, profile }, i) => (
            <PersonLine key={employment.id} profile={profile} sub={`Wants to work ${hours(employment)}`} last={i === applications.length - 1}>
              <SmallButton label="Reject" kind="ghost" onPress={() => handleRespond(employment.id, false)} disabled={respond.isPending} />
              <SmallButton label="Accept" onPress={() => handleRespond(employment.id, true)} disabled={respond.isPending} />
            </PersonLine>
          ))}
        </Section>
      )}

      {invites.length > 0 && (
        <Section title="Invites waiting for an answer" count={invites.length}>
          {invites.map(({ employment, profile }, i) => (
            <PersonLine key={employment.id} profile={profile} sub={`Invited · ${hours(employment)}`} last={i === invites.length - 1}>
              <SmallButton label="Cancel" kind="ghost" onPress={() => handleCancelInvite(employment.id)} disabled={endEmployment.isPending} />
            </PersonLine>
          ))}
        </Section>
      )}

      <FormModal
        visible={showInvite}
        title="Invite a technician"
        subtitle="For someone who already has a Jageer technician account."
        color={BLUE}
        submitLabel={sending ? 'Sending…' : 'Send invite'}
        submitting={sending}
        onSubmit={handleInvite}
        onClose={() => {
          setShowInvite(false);
          resetInvite();
        }}
      >
        <Field label="Name" hint="Start typing and pick them from the list.">
          <Input
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              if (selected) setSelected(null);
            }}
            placeholder="Their name"
          />
          {selected ? (
            <View className="mt-2 flex-row items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
              <PersonAvatar name={selected.full_name} photoUrl={selected.avatar_url} size={32} bg="bg-blue-600" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                  {selected.full_name ?? 'Technician'}
                </Text>
                <Text className="text-xs text-gray-500">{selected.phone ?? 'No phone'}</Text>
              </View>
              <Pressable onPress={() => setSelected(null)} hitSlop={6}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </Pressable>
            </View>
          ) : (
            query.trim().length >= 2 && (
              <View className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
                {searching ? (
                  <Text className="px-3 py-2.5 text-xs text-gray-400">Searching…</Text>
                ) : results.length === 0 ? (
                  <Text className="px-3 py-2.5 text-xs text-gray-400">
                    No matching technicians - try their phone number or email below.
                  </Text>
                ) : (
                  results.map((p, i) => (
                    <Pressable
                      key={p.id}
                      onPress={() => handleSelect(p)}
                      className={`flex-row items-center gap-2.5 px-3 py-2.5 ${i === results.length - 1 ? '' : 'border-b border-gray-100'}`}
                    >
                      <PersonAvatar name={p.full_name} photoUrl={p.avatar_url} size={30} bg="bg-gray-400" />
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                          {p.full_name ?? 'Technician'}
                        </Text>
                        <Text className="text-xs text-gray-400">{p.phone ?? p.city ?? ''}</Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            )
          )}
        </Field>

        <Field label="Email" hint="The address they signed up with - used if you don't pick a name above.">
          <Input
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Phone number">
          <Input
            value={invitePhone}
            onChangeText={(v) => setInvitePhone(v.replace(/[^0-9]/g, ''))}
            placeholder="98XXXXXXXX"
            keyboardType="phone-pad"
            maxLength={10}
          />
        </Field>

        <Field label="Work hours" hint="You set these - the technician can't change them.">
          <HoursRow start={inviteStart} end={inviteEnd} setStart={setInviteStart} setEnd={setInviteEnd} />
        </Field>
      </FormModal>

      <FormModal
        visible={showAdd}
        title="Add a technician"
        subtitle="For staff with no Jageer account. Jobs can only be sent in the app to a technician who has one."
        color={GREEN}
        submitLabel={addManual.isPending ? 'Adding…' : 'Add to my team'}
        submitting={addManual.isPending}
        onSubmit={handleAddManual}
        onClose={() => setShowAdd(false)}
      >
        <Field label="Name">
          <Input value={manual.name} onChangeText={(v) => setManual((m) => ({ ...m, name: v }))} placeholder="Full name" />
        </Field>
        <Field label="Email">
          <Input
            value={manual.email}
            onChangeText={(v) => setManual((m) => ({ ...m, email: v }))}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>
        <Field label="Phone number">
          <Input
            value={manual.phone}
            onChangeText={(v) => setManual((m) => ({ ...m, phone: v.replace(/[^0-9]/g, '') }))}
            placeholder="98XXXXXXXX"
            keyboardType="phone-pad"
            maxLength={10}
          />
        </Field>
        <Field label="Job title">
          <Input value={manual.jobTitle} onChangeText={(v) => setManual((m) => ({ ...m, jobTitle: v }))} placeholder="CCTV technician, helper, driver…" />
        </Field>
        <Field label="Work hours">
          <HoursRow
            start={manual.start}
            end={manual.end}
            setStart={(v) => setManual((m) => ({ ...m, start: v }))}
            setEnd={(v) => setManual((m) => ({ ...m, end: v }))}
          />
        </Field>
      </FormModal>
    </ScrollView>
  );
}

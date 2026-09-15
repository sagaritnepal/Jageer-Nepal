// app/(reseller)/employees.tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/hooks/useAuth';
import {
  useMyEmployees,
  usePendingHires,
  useSentInvites,
  useInviteTechnician,
  useFindTechnicianByPhone,
  useSearchTechnicians,
  useRespondToHire,
  useEndEmployment,
  useUpdateWorkHours,
} from '../../lib/hooks/useTechnicianEmployment';
import { PersonAvatar } from '../../lib/components/PersonAvatar';
import { TimeField } from '../../lib/components/DateTimeFields';
import { useWideDetail } from '../../lib/components/detail/DetailLayout';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { isValidPhone10 } from '../../lib/utils/phone';
import type { Profile, TechnicianEmployment } from '../../types/database.types';

const BLUE = '#2563EB';

function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function hours(e: TechnicianEmployment) {
  return `${e.work_start_time?.slice(0, 5) ?? '09:00'} to ${e.work_end_time?.slice(0, 5) ?? '17:00'}`;
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

/** Employee row with editable hours - technicians can't change their own
 * hours any more (the employer sets them), so this is where they're set. */
function EmployeeRow({ employment, profile, last }: { employment: TechnicianEmployment; profile: Profile; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(employment.work_start_time?.slice(0, 5) ?? '09:00');
  const [end, setEnd] = useState(employment.work_end_time?.slice(0, 5) ?? '17:00');
  const updateHours = useUpdateWorkHours();
  const endEmployment = useEndEmployment();

  function handleRemove() {
    showAlert('Remove employee?', `${profile.full_name ?? 'This technician'} will go back to being an outsource technician.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await endEmployment.end(employment.id);
          } catch (err) {
            showAlert('Could not remove', getErrorMessage(err));
          }
        },
      },
    ]);
  }

  async function handleSaveHours() {
    try {
      await updateHours.updateHours(employment.id, start, end);
      setEditing(false);
    } catch (err) {
      showAlert('Could not update hours', getErrorMessage(err));
    }
  }

  return (
    <View className={last ? '' : 'border-b border-gray-100'}>
      <PersonLine profile={profile} sub={`${profile.phone ?? 'No phone'} · On duty ${hours(employment)}`} last>
        {!!profile.phone && (
          <Pressable onPress={() => Linking.openURL(`tel:${profile.phone}`)} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full bg-blue-50">
            <Ionicons name="call-outline" size={17} color={BLUE} />
          </Pressable>
        )}
        <SmallButton label={editing ? 'Close' : 'Hours'} kind="ghost" onPress={() => setEditing((v) => !v)} />
        <SmallButton label="Remove" kind="danger" onPress={handleRemove} />
      </PersonLine>
      {editing && (
        <View className="flex-row items-center gap-2 px-4 pb-4">
          <View className="flex-1">
            <TimeField value={start} onChange={setStart} />
          </View>
          <Text className="text-xs text-gray-400">to</Text>
          <View className="flex-1">
            <TimeField value={end} onChange={setEnd} />
          </View>
          <SmallButton label={updateHours.isPending ? 'Saving…' : 'Save'} onPress={handleSaveHours} disabled={updateHours.isPending} />
        </View>
      )}
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
  const findTechnician = useFindTechnicianByPhone();
  const respond = useRespondToHire();
  const endEmployment = useEndEmployment();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [sending, setSending] = useState(false);

  const debouncedQuery = useDebounced(query);
  const { data: searchResults, isFetching: searching } = useSearchTechnicians(selected ? '' : debouncedQuery);

  // Already-employed or already-invited technicians shouldn't show up as
  // search results - there's nothing useful to do with them here.
  const takenIds = useMemo(
    () => new Set([...employees.map((e) => e.profile.id), ...invites.map((e) => e.profile.id)]),
    [employees, invites]
  );
  const results = (searchResults ?? []).filter((p) => !takenIds.has(p.id));

  function handleSelect(technician: Profile) {
    setSelected(technician);
    setQuery(technician.full_name ?? technician.phone ?? '');
  }

  function handleClearSelection() {
    setSelected(null);
    setQuery('');
  }

  async function handleInvite() {
    if (!userId) return;
    setSending(true);
    try {
      let technician = selected;
      if (!technician) {
        const trimmed = query.trim();
        if (!isValidPhone10(trimmed)) {
          showAlert('Pick a technician', 'Search by name, or enter their 10-digit phone number.');
          return;
        }
        technician = await findTechnician(trimmed);
        if (!technician) {
          showAlert('Not found', 'No technician is registered with that phone number. Ask them to sign up as a technician first.');
          return;
        }
      }
      if (employees.some((e) => e.profile.id === technician!.id)) {
        showAlert('Already your employee', `${technician.full_name ?? 'This technician'} already works for you.`);
        return;
      }
      await inviteTechnician.invite({ technicianId: technician.id, resellerId: userId, workStartTime: workStart, workEndTime: workEnd });
      handleClearSelection();
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

  const inviteCard = (
    <View className="rounded-2xl border border-gray-200 bg-white p-5">
      <View className="mb-1 flex-row items-center gap-2">
        <Ionicons name="person-add" size={18} color={BLUE} />
        <Text className="text-base font-bold text-gray-900">Invite a technician</Text>
      </View>
      <Text className="mb-4 text-xs leading-5 text-gray-500">
        Search by name, or enter the phone number they signed up with. Once they accept, you can send them jobs
        (they ring on their phone to accept), and other resellers can't book them during their work hours. Invite as many as you need.
      </Text>

      <Text className="mb-1.5 text-sm font-medium text-gray-700">Find a technician</Text>
      <TextInput
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          if (selected) setSelected(null);
        }}
        placeholder="Name or 98XXXXXXXX"
        className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
      />

      <View className="mb-3.5">
        {selected ? (
          <View className="mt-2 flex-row items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
            <PersonAvatar name={selected.full_name} photoUrl={selected.avatar_url} size={32} bg="bg-blue-600" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                {selected.full_name ?? 'Technician'}
              </Text>
              <Text className="text-xs text-gray-500">{selected.phone ?? 'No phone'}</Text>
            </View>
            <Pressable onPress={handleClearSelection} hitSlop={6}>
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
                  No matching technicians. Try their exact phone number instead.
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
      </View>

      <Text className="mb-1.5 text-sm font-medium text-gray-700">Work hours</Text>
      <View className="mb-4 flex-row items-center gap-2">
        <View className="flex-1">
          <TimeField value={workStart} onChange={setWorkStart} />
        </View>
        <Text className="text-xs text-gray-400">to</Text>
        <View className="flex-1">
          <TimeField value={workEnd} onChange={setWorkEnd} />
        </View>
      </View>

      <Pressable
        onPress={handleInvite}
        disabled={sending}
        className="h-12 flex-row items-center justify-center gap-2 rounded-lg disabled:opacity-50"
        style={{ backgroundColor: BLUE }}
      >
        <Ionicons name="paper-plane" size={17} color="#fff" />
        <Text className="text-base font-semibold text-white">{sending ? 'Sending…' : 'Send invite'}</Text>
      </Pressable>
    </View>
  );

  const lists = (
    <View style={{ gap: 20 }}>
      <Section title="My technical employees" count={employees.length}>
        {employees.length === 0 ? (
          <Text className="px-4 py-5 text-sm text-gray-500">No employees yet - invite a technician to get started.</Text>
        ) : (
          employees.map(({ employment, profile }, i) => (
            <EmployeeRow key={employment.id} employment={employment} profile={profile} last={i === employees.length - 1} />
          ))
        )}
      </Section>

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
    </View>
  );

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: wide ? 32 : 16, paddingTop: wide ? 24 : 16, paddingBottom: 48 }}
    >
      {wide ? (
        <View className="flex-row items-start" style={{ gap: 20 }}>
          <View style={{ width: 380 }}>{inviteCard}</View>
          <View className="flex-1">{lists}</View>
        </View>
      ) : (
        <View style={{ gap: 20 }}>
          {inviteCard}
          {lists}
        </View>
      )}
    </ScrollView>
  );
}

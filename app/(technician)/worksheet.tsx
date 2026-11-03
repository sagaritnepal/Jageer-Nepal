// app/(technician)/worksheet.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Platform, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { useMyEmployment, staffAddJob } from '../../lib/hooks/useTechnicianEmployment';
import { claimOpenJob, useUnassignedTeamJobs } from '../../lib/hooks/useJobOffers';
import { CategoryBadge } from '../../lib/components/CategoryBadge';
import { SuggestInput } from '../../lib/components/finance/SuggestInput';
import { WEB_SIDEBAR_MIN_WIDTH } from '../../lib/components/web/WebSidebarShell';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import type { ServiceRequest } from '../../types/database.types';

const BLUE = '#2563EB';
const INPUT = 'rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900';

/** `linked`: the job page opens from it. Work nobody has taken yet has no job page of its own to act on, so its row doesn't. */
function WorkRow({ job, action, linked = true }: { job: ServiceRequest; action: React.ReactNode; linked?: boolean }) {
  return (
    <View className="rounded-2xl border border-gray-200 bg-white p-3.5">
      <Pressable disabled={!linked} onPress={() => router.push(`/(technician)/job/${job.id}` as never)} className="flex-row items-start gap-2.5">
        <CategoryBadge category={job.issue_type} size={36} />
        <View className="flex-1">
          <Text className="text-[14px] font-bold text-gray-900" numberOfLines={2}>
            {job.issue_type}
          </Text>
          <Text className="mt-0.5 text-[12px] text-gray-600" numberOfLines={1}>
            {[job.customer_name ?? 'Customer', job.customer_phone].filter(Boolean).join(' · ')}
          </Text>
          <Text className="mt-0.5 text-[11.5px] text-gray-500" numberOfLines={1}>
            {[job.scheduled_date, job.scheduled_time, job.location_data?.address].filter(Boolean).join(' · ') || 'No date or address yet'}
          </Text>
          {!!job.description && (
            <Text className="mt-0.5 text-[11.5px] text-gray-500" numberOfLines={2}>
              {job.description}
            </Text>
          )}
        </View>
      </Pressable>
      <View className="mt-2.5">{action}</View>
    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View>
        <Text className="text-[15px] font-bold text-gray-900">{title}</Text>
        {!!hint && <Text className="mt-0.5 text-[12px] text-gray-500">{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function ButtonRow({ label, icon, onPress, disabled, ghost }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; ghost?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-9 flex-row items-center justify-center gap-1.5 rounded-lg disabled:opacity-50 ${ghost ? 'border border-gray-300 bg-white' : ''}`}
      style={ghost ? undefined : { backgroundColor: BLUE }}
    >
      <Ionicons name={icon} size={15} color={ghost ? '#374151' : '#FFFFFF'} />
      <Text className={`text-[12.5px] font-semibold ${ghost ? 'text-gray-700' : 'text-white'}`}>{label}</Text>
    </Pressable>
  );
}

/** The Add work form: the service (picked from the list, or typed), who it is for and where. The price stays the owner's. */
function AddWork({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: categories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
    enabled: visible,
  });
  const [service, setService] = useState('');
  const [focused, setFocused] = useState(false);
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => {
    const q = service.trim().toLowerCase();
    return (categories ?? [])
      .flatMap((c) => [`${c.label} - Installation`, `${c.label} - Repair`])
      .filter((name) => !q || name.toLowerCase().includes(q))
      .map((name) => ({ key: name, label: name }));
  }, [categories, service]);

  async function save() {
    if (!service.trim() || !customer.trim()) {
      showAlert('Almost there', 'Add the service and the customer\'s name.');
      return;
    }
    setSaving(true);
    try {
      await staffAddJob({ service, customer, phone, address, note });
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      setService('');
      setCustomer('');
      setPhone('');
      setAddress('');
      setNote('');
      onClose();
    } catch (err) {
      showAlert('Could not add the work', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" onPress={onClose}>
        <Pressable onPress={() => {}} className="w-full rounded-2xl bg-white" style={{ maxWidth: 460, maxHeight: '90%' }}>
          <View className="flex-row items-center gap-2.5 rounded-t-2xl px-5 py-4" style={{ backgroundColor: BLUE }}>
            <Text className="flex-1 text-[16px] font-bold text-white">Add work</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
            <View style={{ zIndex: 10 }}>
              <Text className="mb-1 text-xs font-semibold text-gray-600">Service *</Text>
              <SuggestInput
                value={service}
                onChangeText={setService}
                options={focused ? options : []}
                onSelectOption={(o) => setService(o.label)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                showWhenEmpty
                placeholder="Pick or type a service"
                accessibilityLabel="Service"
                accent={BLUE}
                inputClassName={INPUT}
              />
            </View>
            <View>
              <Text className="mb-1 text-xs font-semibold text-gray-600">Customer name *</Text>
              <TextInput value={customer} onChangeText={setCustomer} className={INPUT} accessibilityLabel="Customer name" />
            </View>
            <View>
              <Text className="mb-1 text-xs font-semibold text-gray-600">Phone</Text>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" className={INPUT} accessibilityLabel="Phone" />
            </View>
            <View>
              <Text className="mb-1 text-xs font-semibold text-gray-600">Address</Text>
              <TextInput value={address} onChangeText={setAddress} className={INPUT} accessibilityLabel="Address" />
            </View>
            <View>
              <Text className="mb-1 text-xs font-semibold text-gray-600">Note</Text>
              <TextInput value={note} onChangeText={setNote} multiline className={INPUT} style={{ minHeight: 64 }} accessibilityLabel="Note" />
            </View>
            <Text className="text-[11.5px] text-gray-500">The owner is told, and sets the price. Anyone on the team can then choose this work, you included.</Text>
            <ButtonRow label={saving ? 'Saving…' : 'Add to the worksheet'} icon="add-circle-outline" onPress={save} disabled={saving} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A technician's Worksheet: the job they are on, what has been offered to them, and all their employer's unassigned
 * work to choose from once they are free. Only for someone employed - an outside technician does not see it. */
export default function TechnicianWorksheet() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { current, employer } = useMyEmployment(userId);
  const isStaff = current?.status === 'accepted';
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: mine } = useSupabaseQuery('service_requests', {
    filters: userId ? { technician_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId && isStaff,
  });
  const openJobs = useUnassignedTeamJobs(isStaff ? current?.reseller_id : undefined);

  const working = useMemo(() => (mine ?? []).filter((j) => j.status === 'in_progress' && j.hold_status !== 'on_hold'), [mine]);
  const onHold = useMemo(() => (mine ?? []).filter((j) => j.status === 'in_progress' && j.hold_status === 'on_hold'), [mine]);
  const offered = useMemo(() => (mine ?? []).filter((j) => j.status === 'assigned'), [mine]);
  const busy = working.length > 0;

  async function take(job: ServiceRequest) {
    setBusyId(job.id);
    try {
      await claimOpenJob(job.id);
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      await queryClient.invalidateQueries({ queryKey: ['job_cards'] });
      router.push(`/(technician)/job/${job.id}` as never);
    } catch (err) {
      const message = getErrorMessage(err);
      showAlert(message.includes('already taken') ? 'Too late' : 'Could not take this work', message.includes('already taken') ? 'A teammate got to this one first.' : message);
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
    } finally {
      setBusyId(null);
    }
  }

  if (!isStaff) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Ionicons name="lock-closed-outline" size={30} color="#D1D5DB" />
        <Text className="mt-3 text-center text-[15px] font-semibold text-gray-700">This is for employees</Text>
        <Text className="mt-1 text-center text-[12.5px] text-gray-500">The Worksheet shows your employer's work once you are on their team.</Text>
      </View>
    );
  }

  const open = (job: ServiceRequest) => router.push(`/(technician)/job/${job.id}` as never);

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: wide ? 32 : 16, paddingBottom: 48, gap: 20, maxWidth: wide ? 860 : undefined }}>
      <View className="flex-row flex-wrap items-center justify-between" style={{ gap: 10 }}>
        <Text className="flex-1 text-[12.5px] text-gray-500" style={{ minWidth: 180 }}>
          {employer?.business_name || employer?.full_name || 'Your employer'}'s work
        </Text>
        <Pressable onPress={() => setAdding(true)} className="h-10 flex-row items-center gap-1.5 rounded-lg px-4" style={{ backgroundColor: BLUE }}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text className="text-[13px] font-semibold text-white">Add work</Text>
        </Pressable>
      </View>

      {working.length > 0 && (
        <Section title="Working on now" hint="Finish this job to choose your next work.">
          {working.map((j) => (
            <WorkRow key={j.id} job={j} action={<ButtonRow label="Open job" icon="open-outline" onPress={() => open(j)} />} />
          ))}
        </Section>
      )}

      {offered.length > 0 && (
        <Section title="Offered to you">
          {offered.map((j) => (
            <WorkRow key={j.id} job={j} action={<ButtonRow label="Open to accept" icon="open-outline" onPress={() => open(j)} ghost />} />
          ))}
        </Section>
      )}

      <Section title="Choose your next work" hint={busy ? 'You can take one when your current job is done or on hold.' : 'First to take a job gets it.'}>
        {openJobs.length === 0 ? (
          <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
            <Ionicons name="clipboard-outline" size={26} color="#D1D5DB" />
            <Text className="mt-2 text-sm text-gray-500">No unassigned work right now.</Text>
          </View>
        ) : (
          openJobs.map((j) => (
            <WorkRow
              key={j.id}
              job={j}
              linked={false}
              action={<ButtonRow label={busyId === j.id ? 'Taking…' : 'Take this job'} icon="checkmark-circle-outline" onPress={() => take(j)} disabled={busy || !!busyId} />}
            />
          ))
        )}
      </Section>

      {onHold.length > 0 && (
        <Section title="On hold">
          {onHold.map((j) => (
            <WorkRow key={j.id} job={j} action={<ButtonRow label="Open job" icon="open-outline" onPress={() => open(j)} ghost />} />
          ))}
        </Section>
      )}

      <AddWork visible={adding} onClose={() => setAdding(false)} />
    </ScrollView>
  );
}

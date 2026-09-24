// lib/components/AssignJobToEmployee.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery } from '../hooks/useSupabase';
import { CategoryBadge } from './CategoryBadge';
import { useWideDetail } from './detail/DetailLayout';
import { assignTechnician, showJobSentAlert } from '../utils/assignTechnician';
import { formatScheduledWhen } from '../utils/scheduledTime';
import { showAlert, getErrorMessage } from '../utils/alert';
import type { ServiceRequest } from '../../types/database.types';

const BLUE = '#2563EB';
const ACTIVE: ServiceRequest['status'][] = ['assigned', 'in_progress'];

/** A job is ready for a technician once the customer approved the quote
 * (app request), or straight away for the reseller's own customer - the
 * same two cases app/(reseller)/request/[id].tsx shows a technician picker
 * for. */
function isReadyToAssign(r: ServiceRequest) {
  return r.status === 'approved' || (r.status === 'pending' && r.origin === 'reseller');
}

function slotKey(r: ServiceRequest) {
  return r.scheduled_date ? `${r.scheduled_date} ${r.scheduled_time ?? '99:99'}` : `~${r.created_at}`;
}

/** The reseller's jobs waiting for a technician (soonest visit first), and
 * how many jobs a given technician already has on the go. */
function useAssignableJobs(technicianId: string) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data, isLoading } = useSupabaseQuery('service_requests', {
    filters: userId ? { reseller_id: userId } : {},
    enabled: !!userId,
  });
  return useMemo(() => {
    const all = data ?? [];
    return {
      isLoading,
      ready: all.filter(isReadyToAssign).sort((a, b) => slotKey(a).localeCompare(slotKey(b))),
      activeCount: all.filter((r) => r.technician_id === technicianId && ACTIVE.includes(r.status)).length,
    };
  }, [data, isLoading, technicianId]);
}

function JobRow({
  job,
  last,
  busy,
  disabled,
  onAssign,
  onOpen,
}: {
  job: ServiceRequest;
  last: boolean;
  busy: boolean;
  disabled: boolean;
  onAssign: () => void;
  onOpen: () => void;
}) {
  const when = formatScheduledWhen(job.scheduled_date, job.scheduled_time);
  const who = job.customer_name ?? job.company_name ?? (job.origin === 'app' ? 'App customer' : 'Your customer');
  return (
    <View className={`flex-row items-center gap-3 py-3 ${last ? '' : 'border-b border-gray-100'}`}>
      <CategoryBadge category={job.issue_type} size={40} />
      <Pressable className="flex-1" onPress={onOpen} accessibilityRole="link">
        <Text className="text-[14.5px] font-bold text-gray-900" numberOfLines={1}>
          {job.issue_type}
        </Text>
        <Text className="mt-0.5 text-xs text-gray-600" numberOfLines={1}>
          {who}
          {job.quoted_price != null ? ` · NPR ${Number(job.quoted_price).toLocaleString()}` : ''}
        </Text>
        <View className="mt-1 flex-row items-center gap-1">
          <Ionicons name="calendar-outline" size={12} color="#6B7280" />
          <Text className="flex-1 text-[11.5px] text-gray-500" numberOfLines={1}>
            {when ?? 'No visit time set'}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onAssign}
        disabled={disabled}
        accessibilityLabel={`Assign ${job.issue_type}`}
        className="h-11 flex-row items-center gap-1.5 rounded-xl px-3.5 disabled:opacity-50"
        style={{ backgroundColor: BLUE }}
      >
        <Ionicons name={busy ? 'hourglass-outline' : 'paper-plane'} size={15} color="#FFFFFF" />
        <Text className="text-[13px] font-bold text-white">{busy ? 'Sending…' : 'Assign'}</Text>
      </Pressable>
    </View>
  );
}

/** Every job waiting for a technician, each one tap away from ringing on
 * this employee's phone. Shared by the employee page and the team list's
 * "Assign job" sheet. */
export function AssignJobList({
  technicianId,
  technicianName,
  onDone,
}: {
  technicianId: string;
  technicianName: string;
  /** Called once the list is finished with - a job was sent, or a link
   * led off the page - so a sheet holding it can close. */
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const { ready, activeCount, isLoading } = useAssignableJobs(technicianId);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const firstName = technicianName.split(/\s+/)[0] || technicianName;

  function go(href: string) {
    onDone?.();
    router.push(href as any);
  }

  async function handleAssign(job: ServiceRequest) {
    setAssigningId(job.id);
    try {
      await assignTechnician({ requestId: job.id, technicianId });
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      showJobSentAlert(technicianName);
      onDone?.();
    } catch (err) {
      showAlert('Could not assign', getErrorMessage(err));
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <View>
      <View className="mb-1 flex-row items-center gap-1.5">
        <Ionicons name={activeCount ? 'briefcase' : 'briefcase-outline'} size={13} color={activeCount ? '#B45309' : '#15803D'} />
        <Text className="text-xs font-semibold" style={{ color: activeCount ? '#B45309' : '#15803D' }}>
          {activeCount === 0
            ? `${firstName} has no jobs on the go`
            : `${firstName} already has ${activeCount} job${activeCount === 1 ? '' : 's'} on the go`}
        </Text>
      </View>

      {isLoading ? (
        <Text className="py-4 text-sm text-gray-500">Loading jobs…</Text>
      ) : ready.length === 0 ? (
        <View className="items-center px-2 py-6">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Ionicons name="file-tray-outline" size={22} color="#6B7280" />
          </View>
          <Text className="mt-3 text-[15px] font-bold text-gray-900">No jobs waiting for a technician</Text>
          <Text className="mt-1 text-center text-xs leading-[17px] text-gray-500">
            A job lands here once the customer approves your quote, or as soon as you add a job for your own customer.
          </Text>
          <Pressable onPress={() => go('/(reseller)/requests')} className="mt-3 flex-row items-center gap-1 py-2">
            <Text className="text-sm font-semibold text-blue-700">Open my requests</Text>
            <Ionicons name="chevron-forward" size={15} color="#1D4ED8" />
          </Pressable>
        </View>
      ) : (
        ready.map((job, i) => (
          <JobRow
            key={job.id}
            job={job}
            last={i === ready.length - 1}
            busy={assigningId === job.id}
            disabled={!!assigningId}
            onAssign={() => handleAssign(job)}
            onOpen={() => go(`/(reseller)/request/${job.id}`)}
          />
        ))
      )}
    </View>
  );
}

/** The team list's quick route: pick a job for one employee without leaving
 * the page. A bottom sheet on a phone, a centred panel on a wide screen. */
export function AssignJobSheet({
  visible,
  technicianId,
  technicianName,
  onClose,
}: {
  visible: boolean;
  technicianId: string;
  technicianName: string;
  onClose: () => void;
}) {
  const wide = useWideDetail();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable
        className="flex-1 bg-black/50"
        style={{ justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center', padding: wide ? 16 : 0 }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          className="w-full bg-white"
          style={{
            maxWidth: wide ? 480 : undefined,
            maxHeight: '85%',
            borderRadius: wide ? 20 : 0,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: wide ? 8 : insets.bottom + 8,
          }}
        >
          {!wide && <View className="mt-2.5 h-1 w-10 self-center rounded-full bg-gray-300" />}
          <View className="flex-row items-start gap-3 border-b border-gray-100 px-5 pb-3.5 pt-4">
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-gray-900" numberOfLines={1}>
                Assign a job to {technicianName}
              </Text>
              <Text className="mt-0.5 text-xs text-gray-500">It rings on their phone - they accept or reject it.</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close"
              className="h-9 w-9 items-center justify-center rounded-full bg-gray-100"
            >
              <Ionicons name="close" size={19} color="#374151" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'web' ? 12 : 4 }}>
            {visible && <AssignJobList technicianId={technicianId} technicianName={technicianName} onDone={onClose} />}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

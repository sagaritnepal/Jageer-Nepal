// app/(technician)/employment.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/hooks/useAuth';
import {
  useMyEmployment,
  useApplyToReseller,
  useEndEmployment,
  useUpdateWorkHours,
  useFindResellerByPhone,
} from '../../lib/hooks/useTechnicianEmployment';
import { TimeField } from '../../lib/components/DateTimeFields';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { isValidPhone10 } from '../../lib/utils/phone';

function ApplyForm({ technicianId }: { technicianId: string }) {
  const [phone, setPhone] = useState('');
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [searching, setSearching] = useState(false);
  const findReseller = useFindResellerByPhone();
  const applyToReseller = useApplyToReseller();

  async function handleApply() {
    const trimmed = phone.trim();
    if (!isValidPhone10(trimmed)) {
      showAlert('Check the phone number', "Enter the reseller's 10-digit phone number.");
      return;
    }
    setSearching(true);
    try {
      const reseller = await findReseller(trimmed);
      if (!reseller) {
        showAlert('Not found', 'No reseller is registered with that phone number.');
        return;
      }
      await applyToReseller.apply({
        technicianId,
        resellerId: reseller.id,
        workStartTime: workStart,
        workEndTime: workEnd,
      });
      showAlert('Request sent', `${reseller.full_name ?? 'The reseller'} will review your request.`);
    } catch (err) {
      showAlert('Could not send request', getErrorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  return (
    <View className="rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="mb-1 text-base font-semibold text-gray-900">Work for a reseller</Text>
      <Text className="mb-4 text-xs text-gray-500">
        Send a request to become a reseller's employee technician. Once accepted, they can assign you jobs
        directly with no accept step, and you won't be offered outsource work from other resellers during your
        declared work hours.
      </Text>

      <Text className="mb-1 text-xs font-medium text-gray-600">Reseller's phone number</Text>
      <TextInput
        value={phone}
        onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
        placeholder="98XXXXXXXX"
        keyboardType="phone-pad"
        maxLength={10}
        className="mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
      />

      <Text className="mb-1 text-xs font-medium text-gray-600">Your work hours</Text>
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
        onPress={handleApply}
        disabled={searching}
        className="items-center rounded-xl bg-orange-500 py-3 disabled:opacity-50"
      >
        <Text className="text-sm font-bold text-white">{searching ? 'Sending…' : 'Send request'}</Text>
      </Pressable>
    </View>
  );
}

export default function EmploymentScreen() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { current, employer } = useMyEmployment(userId);
  const endEmployment = useEndEmployment();
  const updateWorkHours = useUpdateWorkHours();
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (current?.work_start_time) setWorkStart(current.work_start_time.slice(0, 5));
    if (current?.work_end_time) setWorkEnd(current.work_end_time.slice(0, 5));
  }, [current?.work_start_time, current?.work_end_time]);

  async function handleCancelOrLeave() {
    if (!current) return;
    try {
      await endEmployment.end(current.id);
    } catch (err) {
      showAlert('Could not update', getErrorMessage(err));
    }
  }

  async function handleSaveHours() {
    if (!current) return;
    setSavingHours(true);
    try {
      await updateWorkHours.updateHours(current.id, workStart, workEnd);
      showAlert('Saved', 'Your work hours are updated.');
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setSavingHours(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      {!current && userId && <ApplyForm technicianId={userId} />}

      {current?.status === 'pending' && (
        <View className="items-center rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-6">
          <Ionicons name="time-outline" size={28} color="#3b82f6" />
          <Text className="mt-2 text-center font-semibold text-gray-900">
            Waiting on {employer?.full_name ?? 'the reseller'}
          </Text>
          <Text className="mt-1 text-center text-xs text-gray-500">
            You'll be notified once they respond to your request.
          </Text>
          <Pressable onPress={handleCancelOrLeave} disabled={endEmployment.isPending} className="mt-4 px-3 py-1.5">
            <Text className="text-sm font-semibold text-gray-500">Cancel request</Text>
          </Pressable>
        </View>
      )}

      {current?.status === 'accepted' && (
        <View className="rounded-2xl border border-gray-200 bg-white p-5">
          <View className="mb-4 flex-row items-center gap-2">
            <Ionicons name="checkmark-circle" size={20} color="#059669" />
            <Text className="text-base font-semibold text-gray-900">
              You work for {employer?.full_name ?? 'this reseller'}
            </Text>
          </View>

          <Text className="mb-1 text-xs font-medium text-gray-600">Your work hours</Text>
          <View className="mb-3 flex-row items-center gap-2">
            <View className="flex-1">
              <TimeField value={workStart} onChange={setWorkStart} />
            </View>
            <Text className="text-xs text-gray-400">to</Text>
            <View className="flex-1">
              <TimeField value={workEnd} onChange={setWorkEnd} />
            </View>
          </View>
          <Text className="mb-4 text-[11px] text-gray-400">
            Outside these hours you're free to take outsource work from other resellers too.
          </Text>

          <Pressable
            onPress={handleSaveHours}
            disabled={savingHours}
            className="mb-3 items-center rounded-xl border border-orange-500 py-2.5 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-orange-600">{savingHours ? 'Saving…' : 'Save work hours'}</Text>
          </Pressable>

          <Pressable
            onPress={handleCancelOrLeave}
            disabled={endEmployment.isPending}
            className="items-center rounded-xl border border-red-200 bg-red-50 py-2.5 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-red-600">{endEmployment.isPending ? 'Leaving…' : 'Leave employer'}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

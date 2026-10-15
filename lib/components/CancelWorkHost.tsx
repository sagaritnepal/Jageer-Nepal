// lib/components/CancelWorkHost.tsx
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseUpdate } from '../hooks/useSupabase';
import { useCancelWorkStore } from '../hooks/useCancelWork';
import { ticketLabel } from '../utils/ticket';
import { showAlert, getErrorMessage } from '../utils/alert';

/** The dialog behind every "Cancel work" button (see useCancelWork): "Are you sure?", with a box to
 * say why the job is being cancelled. The reason is optional; when written it is saved on the job
 * (service_requests.cancel_reason, migration 0100) and shown on the cancelled job. Mounted once, at
 * the root of the app. */
export function CancelWorkHost() {
  const request = useCancelWorkStore((state) => state.request);
  const close = useCancelWorkStore((state) => state.close);
  const setBusy = useCancelWorkStore((state) => state.setBusy);
  const updateRequest = useSupabaseUpdate('service_requests');
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  // A fresh, empty box for each job it is opened for.
  useEffect(() => {
    setReason('');
  }, [request?.id]);

  if (!request) return null;

  const told =
    request.technician_id && (request.status === 'assigned' || request.status === 'in_progress')
      ? 'The technician will be told right away.'
      : null;
  const heading = `${ticketLabel(request.ticket_no) ?? ''} ${request.issue_type}`.trim();

  async function confirm() {
    if (!request || saving) return;
    const target = request;
    const note = reason.trim();
    setSaving(true);
    setBusy(target.id);
    try {
      try {
        await updateRequest.mutateAsync({
          id: target.id,
          values: { status: 'cancelled', ...(note ? { cancel_reason: note } : null) } as never,
        });
      } catch (err) {
        // The job must still be cancellable when the reason column has not been added yet (migration
        // 0100 not run): cancel without it, and say the reason was not kept.
        if (note && /cancel_reason/i.test(getErrorMessage(err))) {
          await updateRequest.mutateAsync({ id: target.id, values: { status: 'cancelled' } });
          showAlert('Cancelled, but the reason was not saved', 'The reason column has not been added to the database yet.');
        } else {
          throw err;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      close();
    } catch (err) {
      showAlert('Could not cancel the work', getErrorMessage(err));
    } finally {
      setSaving(false);
      setBusy(null);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={saving ? undefined : close}>
      <Pressable
        onPress={saving ? undefined : close}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(17,24,39,0.45)' }}
      >
        {/* Swallows presses, so tapping inside the card does not close it. */}
        <Pressable
          onPress={() => {}}
          style={{ width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, gap: 12 }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Cancel this work?</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563' }}>
            {`Are you sure you want to cancel "${heading}"?${told ? ` ${told}` : ''} This cannot be undone.`}
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#6B7280' }}>Why is it being cancelled? (optional)</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Customer changed their mind, wrong address, duplicate request ..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              editable={!saving}
              accessibilityLabel="Reason for cancelling"
              style={{
                minHeight: 92,
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14.5,
                lineHeight: 21,
                color: '#111827',
                backgroundColor: '#FFFFFF',
                textAlignVertical: 'top',
              }}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <Pressable
              onPress={close}
              disabled={saving}
              accessibilityRole="button"
              style={{
                height: 44,
                paddingHorizontal: 18,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#D1D5DB',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: saving ? 0.5 : 1,
              }}
            >
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#374151' }}>No, keep it</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              disabled={saving}
              accessibilityRole="button"
              style={{
                height: 44,
                paddingHorizontal: 20,
                borderRadius: 12,
                backgroundColor: '#DC2626',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' }}>{saving ? 'Cancelling…' : 'Yes, cancel work'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

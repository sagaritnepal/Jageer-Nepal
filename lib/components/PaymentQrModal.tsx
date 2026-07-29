// lib/components/PaymentQrModal.tsx
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../supabase';
import { getErrorMessage } from '../utils/alert';

const POLL_INTERVAL_MS = 4000;

export function PaymentQrModal({
  visible,
  serviceRequestId,
  onClose,
  onPaid,
}: {
  visible: boolean;
  serviceRequestId: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQrMessage(null);
      setAmount(null);
      setError(null);
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase.functions
      .invoke('fonepay-create-qr', { body: { service_request_id: serviceRequestId } })
      .then(({ data, error: fnError }) => {
        if (cancelled) return;
        if (fnError || !data || data.error) {
          setError(data?.error ?? getErrorMessage(fnError, 'Could not start online payment.'));
          setLoading(false);
          return;
        }
        setQrMessage(data.qrMessage);
        setAmount(data.amount);
        setLoading(false);

        pollRef.current = setInterval(async () => {
          const { data: statusData } = await supabase.functions.invoke('fonepay-check-status', {
            body: { service_request_id: serviceRequestId },
          });
          if (statusData?.paymentStatus === 'success') {
            if (pollRef.current) clearInterval(pollRef.current);
            onPaid();
          }
        }, POLL_INTERVAL_MS);
      });

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, serviceRequestId]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-sm items-center rounded-2xl bg-white p-6">
          <Text className="mb-1 text-lg font-bold text-gray-900">Scan to pay</Text>
          {amount != null && (
            <Text className="mb-4 text-2xl font-extrabold text-orange-600">NPR {amount.toLocaleString()}</Text>
          )}

          {loading && (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color="#f97316" />
              <Text className="mt-3 text-sm text-gray-500">Generating QR…</Text>
            </View>
          )}

          {error && !loading && (
            <View className="items-center py-6">
              <Text className="mb-3 text-center text-sm text-red-600">{error}</Text>
              <Text className="text-center text-xs text-gray-400">You can close this and pay by cash instead.</Text>
            </View>
          )}

          {qrMessage && !error && !loading && (
            <>
              <View className="items-center rounded-xl border border-gray-100 p-3">
                <QRCode value={qrMessage} size={220} />
              </View>
              <View className="mt-4 flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#f97316" />
                <Text className="text-xs text-gray-500">Waiting for payment…</Text>
              </View>
              <Text className="mt-1 text-center text-[11px] text-gray-400">
                Scan with any Nepali banking app that supports Fonepay QR. This closes automatically once paid.
              </Text>
            </>
          )}

          <Pressable onPress={onClose} className="mt-5 px-4 py-2">
            <Text className="text-sm font-semibold text-gray-500">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

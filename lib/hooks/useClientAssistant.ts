// lib/hooks/useClientAssistant.ts
import { useState } from 'react';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { supabase } from '../supabase';
import { showAlert, getErrorMessage } from '../utils/alert';

export interface ClientChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ClientChatTurnResult {
  reply: string;
  transcript: string;
  ready: boolean;
  category: string | null;
  action: 'Repair' | 'Installation' | null;
  notes: string | null;
  date: string | null;
  time: string | null;
  address: string | null;
}

/** The customer-facing counterpart to useChatAssistant: a short
 * conversation (type or speak) that helps a client describe their problem
 * and turns it into a service request - same "review before submit" rule,
 * the client still confirms on the real request-details form. `categories`
 * is the current list of real service category labels, sent fresh on every
 * call so the assistant can only ever pick one that actually exists. */
export function useClientAssistant(categories: string[]) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [messages, setMessages] = useState<ClientChatMessage[]>([]);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);

  async function callAssistant(
    input: { type: 'text'; text: string } | { type: 'audio'; audio: string; mimeType: string },
    historySnapshot: ClientChatMessage[]
  ): Promise<ClientChatTurnResult | null> {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-assistant', {
        body: { history: historySnapshot, input, categories },
      });
      if (error || !data || data.error) {
        showAlert('Could not reach the assistant', data?.error ?? getErrorMessage(error, 'Please try again.'));
        return null;
      }
      return data as ClientChatTurnResult;
    } catch (err) {
      showAlert('Could not reach the assistant', getErrorMessage(err));
      return null;
    } finally {
      setSending(false);
    }
  }

  async function sendText(text: string) {
    const historySnapshot = messages;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    const result = await callAssistant({ type: 'text', text }, historySnapshot);
    if (result) setMessages((prev) => [...prev, { role: 'model', text: result.reply }]);
    return result;
  }

  async function startRecording() {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showAlert('Microphone access needed', 'Allow microphone access to talk to the assistant.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (err) {
      setRecording(false);
      showAlert('Could not start recording', getErrorMessage(err));
    }
  }

  async function stopRecordingAndSend() {
    setRecording(false);
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch (err) {
      showAlert('Could not finish that recording', getErrorMessage(err));
      return null;
    }
    if (!uri) {
      showAlert('Could not finish that recording', 'Please try again.');
      return null;
    }

    let base64: string;
    try {
      const file = new File(uri);
      base64 = await file.base64();
    } catch (err) {
      showAlert('Could not process that recording', getErrorMessage(err));
      return null;
    }

    const historySnapshot = messages;
    // One call, not two - see useChatAssistant for why (Gemini's free-tier
    // daily quota is small enough that doubling calls per turn matters).
    const result = await callAssistant({ type: 'audio', audio: base64, mimeType: 'audio/aac' }, historySnapshot);
    if (result) {
      const transcript = result.transcript?.trim();
      setMessages((prev) => [
        ...(transcript ? [...prev, { role: 'user' as const, text: transcript }] : prev),
        { role: 'model' as const, text: result.reply },
      ]);
    }
    return result;
  }

  function reset() {
    setMessages([]);
  }

  // A canned opener spoken/shown the moment the chat is opened - no Gemini
  // call involved (it's not a real turn, just a fixed greeting), and only
  // takes effect on a genuinely fresh conversation so reopening mid-chat
  // doesn't re-greet over what's already been said.
  function greet(text: string) {
    setMessages((prev) => (prev.length === 0 ? [{ role: 'model', text }] : prev));
  }

  return { messages, recording, sending, sendText, startRecording, stopRecordingAndSend, reset, greet };
}

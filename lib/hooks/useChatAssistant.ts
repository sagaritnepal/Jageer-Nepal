// lib/hooks/useChatAssistant.ts
import { useState } from 'react';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { supabase } from '../supabase';
import { showAlert, getErrorMessage } from '../utils/alert';
import type { VoiceAction, VoiceCommandItem } from './useVoiceCommand';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatTurnResult {
  reply: string;
  transcript: string;
  ready: boolean;
  action: VoiceAction | null;
  party_name: string | null;
  amount: number | null;
  date: string | null;
  note: string | null;
  items: VoiceCommandItem[];
}

/** A short back-and-forth conversation with the chat-assistant edge
 * function (same Gemini pipeline as Scan Bill/voice command) - holds the
 * message history client-side and resends the whole thing each turn, since
 * the assistant needs the full conversation to know what's already been
 * said. Never saves anything itself; the caller opens the matching Finance
 * form pre-filled once `ready` comes back true, same "review before save"
 * rule as everywhere else this session. */
export function useChatAssistant() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);

  // Only ever appends the assistant's reply - the caller is responsible for
  // showing the user's own bubble (see sendText/stopRecordingAndSend), since
  // for a typed message that's known instantly and for a spoken one it's
  // shown as soon as the quick transcribe-only call below returns, well
  // before this full understanding call finishes a few seconds later.
  // `historySnapshot` is captured by the caller BEFORE that user bubble is
  // added, since `history` here means "turns prior to this one" - the new
  // turn is passed separately as `input`.
  async function callAssistant(
    input: { type: 'text'; text: string } | { type: 'audio'; audio: string; mimeType: string },
    historySnapshot: ChatMessage[]
  ): Promise<ChatTurnResult | null> {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: { history: historySnapshot, input },
      });
      if (error || !data || data.error) {
        showAlert('Could not reach the assistant', data?.error ?? getErrorMessage(error, 'Please try again.'));
        return null;
      }
      return data as ChatTurnResult;
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

  // expo-audio's recorder can throw on prepare/record/stop (a previous
  // recording not fully torn down, a transient native-session hiccup,
  // etc.) - none of that was ever caught before, so a failure here just
  // left the mic looking stuck with no error and no way to tell what
  // happened. Every path below is now wrapped so a failure always resets
  // the button and says something, instead of going silent.
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

    // One call, not two: Gemini's free tier caps this key at a small number
    // of requests per day, and the earlier "quick transcribe-then-full-call"
    // version spent two of those on every single spoken message - the
    // actual cause behind the intermittent "second time not responding"
    // reports. The transcript shows up slightly later (once this one call
    // returns) instead of instantly, but the feature stays usable within
    // the quota. Never shows a blank bubble - a recording with nothing
    // recognizable in it (too short, silence caught instead of speech)
    // legitimately comes back with an empty transcript.
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

  return { messages, recording, sending, sendText, startRecording, stopRecordingAndSend, reset };
}

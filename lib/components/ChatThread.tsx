// lib/components/ChatThread.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { supabase } from '../supabase';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseInsert, subscribeToTable } from '../hooks/useSupabase';
import type { Message, MessageSubjectType } from '../../types/database.types';

interface ChatThreadProps {
  subjectType: MessageSubjectType;
  subjectId: string;
}

export function ChatThread({ subjectType, subjectId }: ChatThreadProps) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const insertMessage = useSupabaseInsert('messages');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: true });
      if (isMounted) setMessages((data ?? []) as Message[]);
    }
    load();

    const unsubscribe = subscribeToTable('messages', load, `subject_id=eq.${subjectId}`);
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [subjectType, subjectId]);

  async function handleSend() {
    if (!userId || !body.trim()) return;
    const text = body.trim();
    setBody('');
    await insertMessage.mutateAsync({
      subject_type: subjectType,
      subject_id: subjectId,
      sender_id: userId,
      body: text,
    });
  }

  return (
    <View className="rounded-xl bg-white p-5">
      <Text className="mb-3 text-sm uppercase tracking-wide text-gray-400">Messages</Text>

      {messages.length === 0 && <Text className="mb-3 text-sm text-gray-400">No messages yet.</Text>}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View
            className={`mb-2 max-w-[85%] rounded-lg px-3 py-2 ${
              item.sender_id === userId ? 'self-end bg-blue-700' : 'self-start bg-gray-100'
            }`}
          >
            <Text className={item.sender_id === userId ? 'text-sm text-white' : 'text-sm text-gray-800'}>
              {item.body}
            </Text>
          </View>
        )}
      />

      <View className="mt-2 flex-row items-center gap-2">
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <Pressable onPress={handleSend} className="rounded-lg bg-blue-700 px-4 py-2">
          <Text className="text-sm font-semibold text-white">Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

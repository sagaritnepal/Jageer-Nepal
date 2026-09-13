// lib/utils/secureAuthStorage.ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// A Supabase session (access + refresh JWT, user metadata) routinely exceeds
// SecureStore's undocumented, JS-unenforced ~2048-byte ceiling on iOS (it
// throws a native error past that rather than truncating) - so the value is
// split across multiple keys, each under the limit, with a "<key>_chunks"
// marker recording how many parts to reassemble. Comfortably under 2048 to
// leave headroom for the item's own storage overhead.
const MAX_CHUNK_SIZE = 1800;

function chunkKey(key: string, index: number) {
  return `${key}_${index}`;
}

async function getSecureItem(key: string): Promise<string | null> {
  const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
  if (!chunkCountRaw) {
    // Never chunked (small enough to fit in one item) - including sessions
    // written before this adapter existed.
    return SecureStore.getItemAsync(key);
  }

  const chunkCount = Number(chunkCountRaw);
  const parts: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part == null) return null; // a chunk went missing - treat as no session rather than a corrupt partial one
    parts.push(part);
  }
  return parts.join('');
}

async function removeSecureItem(key: string): Promise<void> {
  const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
  if (chunkCountRaw) {
    const chunkCount = Number(chunkCountRaw);
    await Promise.all(Array.from({ length: chunkCount }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))));
    await SecureStore.deleteItemAsync(`${key}_chunks`);
  }
  await SecureStore.deleteItemAsync(key);
}

async function setSecureItem(key: string, value: string): Promise<void> {
  // Clear whatever shape (chunked or not) was previously stored under this
  // key first, so switching between a short and a long session never leaves
  // stale chunks behind for getSecureItem to reassemble incorrectly.
  await removeSecureItem(key);

  if (value.length <= MAX_CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += MAX_CHUNK_SIZE) {
    chunks.push(value.slice(i, i + MAX_CHUNK_SIZE));
  }
  await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length));
  await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
}

// expo-secure-store has no web implementation in this SDK version (throws
// "getValueWithKeyAsync is not a function" - see biometricLogin.ts), so web
// keeps using AsyncStorage; only native gets the OS-keychain-backed,
// encrypted-at-rest storage a long-lived auth/refresh token warrants.
export const SecureAuthStorage =
  Platform.OS === 'web'
    ? AsyncStorage
    : {
        getItem: getSecureItem,
        setItem: setSecureItem,
        removeItem: removeSecureItem,
      };

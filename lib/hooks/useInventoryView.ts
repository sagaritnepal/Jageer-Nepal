// lib/hooks/useInventoryView.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type InventoryView = 'grid' | 'table';

interface InventoryViewState {
  view: InventoryView;
  setView: (view: InventoryView) => void;
}

/** How a reseller reads their Inventory: as a grid (one card per item) or as a table (one row per
 * item). It opens on the grid, and whichever they last picked is remembered across launches. */
export const useInventoryViewStore = create<InventoryViewState>()(
  persist(
    (set) => ({
      view: 'grid',
      setView: (view) => set({ view }),
    }),
    { name: 'inventory-view', storage: createJSONStorage(() => AsyncStorage) }
  )
);

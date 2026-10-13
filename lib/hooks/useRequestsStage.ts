// lib/hooks/useRequestsStage.ts
import { create } from 'zustand';

/** The tab the reseller has open on the Requests page (Customer App Jobs, My Jobs, Completed ...).
 * It lives outside the screen so it survives opening a job and coming back: the screen is torn down
 * and rebuilt on that round trip, and a plain useState would start over at the first tab. */
interface RequestsStageState {
  stage: string | null;
  setStage: (stage: string | null) => void;
}

export const useRequestsStageStore = create<RequestsStageState>((set) => ({
  stage: null,
  setStage: (stage) => set({ stage }),
}));

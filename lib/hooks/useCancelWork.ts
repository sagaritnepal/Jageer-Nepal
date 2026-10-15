// lib/hooks/useCancelWork.ts
import { useCallback } from 'react';
import { create } from 'zustand';
import type { ServiceRequest } from '../../types/database.types';

export type CancellableRequest = Pick<ServiceRequest, 'id' | 'issue_type' | 'status' | 'technician_id' | 'reseller_id'> & {
  ticket_no?: number | string | null;
};

// Every stage before the job is finished. The database allows a reseller to
// cancel their own job from any of these (migration 0077); a finished job has
// been done and is paid for, not cancelled.
const CANCELLABLE: ServiceRequest['status'][] = ['pending', 'quoted', 'approved', 'assigned', 'in_progress'];

/** True for a job its reseller has taken on and that is not finished yet. A
 * request nobody has claimed (no reseller) is not theirs to cancel. */
export function canCancelWork(request: Pick<ServiceRequest, 'status' | 'reseller_id'>): boolean {
  return !!request.reseller_id && CANCELLABLE.includes(request.status);
}

/** The cancel dialog's state, shared by every screen that can cancel work: which job it is asking
 * about (null = closed), and which job is being cancelled right now (to disable its button). The
 * dialog itself is CancelWorkHost, mounted once at the root. */
export const useCancelWorkStore = create<{
  request: CancellableRequest | null;
  busyId: string | null;
  open: (request: CancellableRequest) => void;
  close: () => void;
  setBusy: (id: string | null) => void;
}>((set) => ({
  request: null,
  busyId: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
  setBusy: (id) => set({ busyId: id }),
}));

/** "Cancel work" for a reseller, on any screen: opens a dialog that asks "Are you sure?", with a box
 * for the reason the job is being cancelled (optional), and only then marks the job cancelled. A
 * technician who has been given the job (or started it) is told straight away - the database adds
 * that notification (migration 0082). `busyId` is the job being cancelled, to disable its button. */
export function useCancelWork() {
  const busyId = useCancelWorkStore((state) => state.busyId);
  const open = useCancelWorkStore((state) => state.open);
  const confirmCancelWork = useCallback((request: CancellableRequest) => open(request), [open]);
  return { confirmCancelWork, busyId };
}

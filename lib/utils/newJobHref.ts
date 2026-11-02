// lib/utils/newJobHref.ts

/** The reseller's "new job" form. It opens with no service chosen - the service is picked inside the form (see
 * ServicePickerModal) - so there is no page of services in front of it. A fresh `n` gives each opening a clean form,
 * and `from` is the tab to land back on when the job is saved or cancelled (see returnPathOr). */
export function newJobHref(from = 'requests'): string {
  return `/(reseller)/request-details?n=${Date.now()}&from=${encodeURIComponent(from)}`;
}

/** The same form, opened on a job that already exists: filled in with what it has, and saving writes back to that
 * one job (see request-details). */
export function editJobHref(requestId: string, from = 'requests'): string {
  return `/(reseller)/request-details?edit=${requestId}&n=${Date.now()}&from=${encodeURIComponent(from)}`;
}

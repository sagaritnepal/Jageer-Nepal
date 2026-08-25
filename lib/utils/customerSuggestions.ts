// lib/utils/customerSuggestions.ts
import type { Customer } from '../../types/database.types';
import type { PhoneContactEntry } from '../hooks/usePhoneContacts';

export interface CustomerSuggestion {
  key: string;
  name: string;
  phone: string | null;
  customer: Customer | null;
}

/** Merges saved customers with phone contacts into one ranked, deduped list
 * for a customer-name field's dropdown. With no query, returns everyone
 * (both lists are already name-sorted) so tapping the field shows the full
 * book to browse, not just matches for something already typed. Saved
 * customers rank first (they carry the real customer_id, and possibly a
 * saved address/history) - a phone contact already saved as a customer is
 * matched by phone and never shown twice. */
export function buildCustomerSuggestions(
  customers: Customer[],
  phoneContacts: PhoneContactEntry[],
  query: string,
  limit = 3000
): CustomerSuggestion[] {
  const q = query.trim().toLowerCase();
  const savedByPhone = new Set(customers.filter((c) => c.phone).map((c) => c.phone as string));

  const matchingCustomers = q ? customers.filter((c) => c.name.toLowerCase().includes(q)) : customers;
  const fromCustomers: CustomerSuggestion[] = matchingCustomers.map((c) => ({
    key: c.id,
    name: c.name,
    phone: c.phone,
    customer: c,
  }));

  const matchingContacts = q ? phoneContacts.filter((p) => p.name.toLowerCase().includes(q)) : phoneContacts;
  const fromContacts: CustomerSuggestion[] = matchingContacts
    .filter((p) => !savedByPhone.has(p.phone))
    .map((p) => ({ key: `contact-${p.phone}`, name: p.name, phone: p.phone, customer: null }));

  return [...fromCustomers, ...fromContacts].slice(0, limit);
}

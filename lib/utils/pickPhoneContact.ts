// lib/utils/pickPhoneContact.ts
import * as Contacts from 'expo-contacts';
import { showAlert, getErrorMessage } from './alert';
import { normalizePhone } from './phone';

export interface PickedContact {
  name: string;
  phone: string;
}

/** Opens the native contact picker and returns the picked contact's name +
 * phone (normalized to the bare 10-digit shape every saved customer's phone
 * is stored in - see lib/utils/phone.ts), or null if the user cancelled,
 * denied permission, or the picked contact has no usable number. Shows its
 * own alerts for the permission/no-phone cases so every call site gets the
 * same behavior for free. */
export async function pickPhoneContact(): Promise<PickedContact | null> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Contacts access needed', 'Allow contacts access to pick from your phone.');
      return null;
    }
    const contact = await Contacts.Contact.presentPicker();
    if (!contact) return null;

    const [fullName, phones] = await Promise.all([contact.getFullName(), contact.getPhones()]);
    const rawPhone = phones[0]?.number;
    const phone = rawPhone ? (normalizePhone(rawPhone) ?? '') : '';
    if (!phone) {
      showAlert('No phone number', 'That contact has no phone number saved — add one manually.');
    }
    return { name: fullName ?? '', phone };
  } catch (err) {
    showAlert('Could not read contact', getErrorMessage(err));
    return null;
  }
}

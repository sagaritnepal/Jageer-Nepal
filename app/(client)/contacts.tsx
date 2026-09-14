// app/(client)/contacts.tsx
import { SavedContactsScreen } from '../../lib/components/SavedContactsScreen';

export default function ClientContacts() {
  return <SavedContactsScreen basePath="/(client)" />;
}

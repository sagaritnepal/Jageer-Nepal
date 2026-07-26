// lib/constants/roleColors.ts
import type { UserRole } from '../../types/database.types';

// One shared brand color across every role (Tailwind's orange-500, which is
// overridden to this same indigo in tailwind.config.js), so the whole app
// reads as a single consistent brand.
const BRAND_INDIGO = '#4F46E5';

export const ROLE_ACCENT: Record<UserRole, string> = {
  client: BRAND_INDIGO,
  technician: BRAND_INDIGO,
  reseller: BRAND_INDIGO,
  wholesaler: BRAND_INDIGO,
  admin: BRAND_INDIGO,
};

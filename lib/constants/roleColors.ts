// lib/constants/roleColors.ts
import type { UserRole } from '../../types/database.types';

// One shared brand color across every role (Tailwind's orange-500), replacing
// the old per-role tint so the whole app reads as a single consistent brand.
const BRAND_ORANGE = '#F97316';

export const ROLE_ACCENT: Record<UserRole, string> = {
  client: BRAND_ORANGE,
  technician: BRAND_ORANGE,
  reseller: BRAND_ORANGE,
  wholesaler: BRAND_ORANGE,
  admin: BRAND_ORANGE,
};

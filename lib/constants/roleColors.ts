// lib/constants/roleColors.ts
import type { UserRole } from '../../types/database.types';

export const ROLE_ACCENT: Record<UserRole, string> = {
  client: '#2F5CFF',
  technician: '#0D9488',
  reseller: '#D97706',
  wholesaler: '#7C3AED',
  admin: '#111827',
};

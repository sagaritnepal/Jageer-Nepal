// lib/constants/categoryIcons.ts
import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Known categories get a real vector icon; anything an admin adds later
// without a mapping here just falls back to its emoji from the DB.
export const CATEGORY_ICON_MAP: Record<string, IoniconName> = {
  'Website & App Design': 'code-slash',
  'Digital Marketing': 'megaphone',
  Cybersecurity: 'shield-checkmark',
  'Cloud Solutions': 'cloud',
  'CCTV & Surveillance': 'videocam',
  'Computer Repair': 'desktop',
  'Laptop Repair': 'laptop',
  'Door Lock & Access': 'lock-closed',
  'Intercom Systems': 'call',
  'AC Service & Repair': 'snow',
  'Electrical Work': 'flash',
  'UPS & Inverter': 'battery-charging',
  'Server Maintenance': 'server-outline',
  'Printer Repair': 'print',
  'Scanner Repair': 'scan-outline',
  'Washing Machine Repair': 'sync-circle',
  'Geyser & Water Heater': 'flame',
  'Refrigerator Repair': 'snow',
  'TV Repair': 'tv',
  'Speaker & Sound System': 'volume-high',
  'Attendance & Biometric Systems': 'finger-print',
  'Microwave Oven Repair': 'thermometer',
  'Fan Repair': 'sync-circle',
  'Walkie Talkie Repair': 'radio',
  'WiFi Router Setup': 'wifi',
  'Network Switches & Cabling': 'git-network-outline',
  'Water Purifier & RO Repair': 'water',
  'Vacuum Cleaner Repair': 'construct',
  'Induction Stove Repair': 'flame',
  'Iron Repair': 'construct',
  'Water Pump Repair': 'water',
  'Projector Repair': 'construct',
};

export const CATEGORY_BG_COLORS = [
  'bg-indigo-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-red-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-blue-500',
  'bg-slate-500',
  'bg-teal-500',
  'bg-fuchsia-500',
  'bg-green-500',
  'bg-rose-500',
  'bg-yellow-500',
  'bg-cyan-500',
];

// Stable per-label color + icon, for places (request cards, job cards) that
// show one category badge at a time rather than a whole grid. Accepts either
// a bare category label or a request's `issue_type` (built as
// "{category} - {action}" in request-details.tsx), matching by prefix.
export function getCategoryVisual(rawLabel: string | null | undefined): { bg: string; icon: IoniconName | null } {
  if (!rawLabel) return { bg: 'bg-gray-400', icon: null };
  const matchedLabel = Object.keys(CATEGORY_ICON_MAP).find((label) => rawLabel.startsWith(label));
  const hashSource = matchedLabel ?? rawLabel;
  let hash = 0;
  for (let i = 0; i < hashSource.length; i++) hash = (hash * 31 + hashSource.charCodeAt(i)) >>> 0;
  return {
    bg: CATEGORY_BG_COLORS[hash % CATEGORY_BG_COLORS.length],
    icon: matchedLabel ? CATEGORY_ICON_MAP[matchedLabel] : null,
  };
}

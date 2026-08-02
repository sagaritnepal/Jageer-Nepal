// lib/constants/categoryIcons.ts
import { Ionicons } from '@expo/vector-icons';
import type { ImageSourcePropType } from 'react-native';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Custom illustrated icon set (one PNG per category) - takes priority over
// the vector icon fallback below wherever a category has one.
export const CATEGORY_IMAGE_MAP: Partial<Record<string, ImageSourcePropType>> = {
  'Website & App Design': require('../../assets/categories/website-app-design.png'),
  'Digital Marketing': require('../../assets/categories/digital-marketing.png'),
  Cybersecurity: require('../../assets/categories/cybersecurity.png'),
  'Cloud Solutions': require('../../assets/categories/cloud-solutions.png'),
  'CCTV & Surveillance': require('../../assets/categories/cctv-surveillance.png'),
  'Computer Repair': require('../../assets/categories/computer-repair.png'),
  'Laptop Repair': require('../../assets/categories/laptop-repair.png'),
  'Door Lock & Access': require('../../assets/categories/door-lock-access.png'),
  'Intercom Systems': require('../../assets/categories/intercom-systems.png'),
  'AC Service & Repair': require('../../assets/categories/ac-service-repair.png'),
  'Electrical Work': require('../../assets/categories/electrical-work.png'),
  'UPS & Inverter': require('../../assets/categories/ups-inverter.png'),
  'Server Maintenance': require('../../assets/categories/server-maintenance.png'),
  'Printer Repair': require('../../assets/categories/printer-scanner.png'),
  'Scanner Repair': require('../../assets/categories/printer-scanner.png'),
  'Washing Machine Repair': require('../../assets/categories/washing-machine-repair.png'),
  'Geyser & Water Heater': require('../../assets/categories/geyser-water-heater.png'),
  'Refrigerator Repair': require('../../assets/categories/refrigerator-repair.png'),
  'TV Repair': require('../../assets/categories/tv-repair.png'),
  'Speaker & Sound System': require('../../assets/categories/speaker-sound-system.png'),
  'Attendance & Biometric Systems': require('../../assets/categories/attendance-biometric-systems.png'),
  'Microwave Oven Repair': require('../../assets/categories/microwave-oven-repair.png'),
  'Fan Repair': require('../../assets/categories/fan-repair.png'),
  'Walkie Talkie Repair': require('../../assets/categories/walkie-talkie-repair.png'),
  'WiFi Router Setup': require('../../assets/categories/wifi-router-setup.png'),
  'Network Switches & Cabling': require('../../assets/categories/network-switches-cabling.png'),
  'Water Purifier & RO Repair': require('../../assets/categories/water-purifier-ro-repair.png'),
  'Vacuum Cleaner Repair': require('../../assets/categories/vacuum-cleaner-repair.png'),
  'Induction Stove Repair': require('../../assets/categories/induction-stove-repair.png'),
  'Iron Repair': require('../../assets/categories/iron-repair.png'),
  'Water Pump Repair': require('../../assets/categories/water-pump-repair.png'),
  'Projector Repair': require('../../assets/categories/projector-repair.png'),
  'Data Recovery': require('../../assets/categories/data-recovery.png'),
  'Smart Home Setup': require('../../assets/categories/smart-home-setup.png'),
  'PABX & Telephone': require('../../assets/categories/pabx-telephone.png'),
  'Solar Panel Installation': require('../../assets/categories/solar-panel-installation.png'),
  'Plumbing Services': require('../../assets/categories/plumbing-services.png'),
};

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
  'Data Recovery': 'save',
  'Smart Home Setup': 'home',
  'PABX & Telephone': 'call',
  'Solar Panel Installation': 'sunny',
  'Plumbing Services': 'water',
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
//
// `stableId` is the category's real (immutable) database id, when the
// caller has an actual service_categories row rather than just free text -
// pass it so the color hash is keyed to the category itself instead of its
// current label, so renaming a category in admin doesn't reshuffle its
// color/emoji everywhere it's shown. Callers with only free text (e.g. a
// request's issue_type, which has no live category reference) omit it and
// fall back to hashing the text as before.
export function getCategoryVisual(
  rawLabel: string | null | undefined,
  stableId?: string | null
): {
  bg: string;
  icon: IoniconName | null;
  image: ImageSourcePropType | null;
} {
  if (!rawLabel) return { bg: 'bg-gray-400', icon: null, image: null };
  const matchedLabel = Object.keys(CATEGORY_ICON_MAP).find((label) => rawLabel.startsWith(label));
  const hashSource = matchedLabel ?? stableId ?? rawLabel;
  let hash = 0;
  for (let i = 0; i < hashSource.length; i++) hash = (hash * 31 + hashSource.charCodeAt(i)) >>> 0;
  return {
    bg: CATEGORY_BG_COLORS[hash % CATEGORY_BG_COLORS.length],
    icon: matchedLabel ? CATEGORY_ICON_MAP[matchedLabel] : null,
    image: matchedLabel ? (CATEGORY_IMAGE_MAP[matchedLabel] ?? null) : null,
  };
}

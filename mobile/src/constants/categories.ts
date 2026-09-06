import { Ionicons } from '@expo/vector-icons';

import { categoryPalette, palette, type CategoryName } from '@/design/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

export interface CategoryMeta {
  name: CategoryName;
  label: string;
  icon: IconName;
  color: string;
}

/**
 * The categories the seeder actually writes (see supabase/seed/seed_places.py).
 * Keep this list in sync with it — an unknown category falls back to "Other"
 * rather than rendering an untinted marker.
 */
export const PLACE_CATEGORIES: CategoryMeta[] = [
  { name: 'Shops', label: 'Shops', icon: 'storefront', color: categoryPalette.Shops },
  { name: 'Religious', label: 'Religious', icon: 'moon', color: categoryPalette.Religious },
  { name: 'Tourism', label: 'Tourism', icon: 'camera', color: categoryPalette.Tourism },
  { name: 'Public Parks', label: 'Parks', icon: 'leaf', color: categoryPalette['Public Parks'] },
  {
    name: 'Public Services',
    label: 'Services',
    icon: 'business',
    color: categoryPalette['Public Services'],
  },
  { name: 'Other', label: 'Other', icon: 'ellipsis-horizontal', color: categoryPalette.Other },
];

const byName = new Map<string, CategoryMeta>(PLACE_CATEGORIES.map((c) => [c.name, c]));

export function categoryMeta(name: string | null | undefined): CategoryMeta {
  return (name && byName.get(name)) || byName.get('Other')!;
}

/** Civic issue types accepted by problem_reports.category. */
export interface ReportCategoryMeta {
  name: string;
  icon: IconName;
  color: string;
}

export const REPORT_CATEGORIES: ReportCategoryMeta[] = [
  { name: 'Pothole', icon: 'warning', color: '#E0562F' },
  { name: 'Garbage', icon: 'trash', color: '#7A6A50' },
  { name: 'Street Light', icon: 'bulb', color: '#F2A61B' },
  { name: 'Water Leakage', icon: 'water', color: '#1F86D6' },
  { name: 'Damaged Road', icon: 'construct', color: '#8B5E3C' },
  { name: 'Other', icon: 'ellipsis-horizontal', color: '#6B7280' },
];

const reportByName = new Map(REPORT_CATEGORIES.map((c) => [c.name, c]));

export function reportCategoryMeta(name: string | null | undefined): ReportCategoryMeta {
  return (name && reportByName.get(name)) || reportByName.get('Other')!;
}

export const REPORT_STATUS_META = {
  reported: { label: 'Reported', color: palette.warning, icon: 'alert-circle' as IconName },
  in_progress: { label: 'In progress', color: palette.accent, icon: 'time' as IconName },
  fixed: { label: 'Fixed', color: palette.success, icon: 'checkmark-circle' as IconName },
} as const;

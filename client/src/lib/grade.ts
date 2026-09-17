import type { GradeLevel } from '../types';

export const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 10, label: 'X' },
  { value: 11, label: 'XI' },
  { value: 12, label: 'XII' },
];

export function gradeLabel(gradeLevel: GradeLevel | null): string {
  return GRADE_OPTIONS.find((option) => option.value === gradeLevel)?.label ?? 'Lainnya';
}

/** Sama dengan server: "XII IPA 1" → 12, "XI-2" → 11, "X 3" → 10, "12 MIPA" → 12. */
export function detectGradeLevel(className: string): GradeLevel | null {
  const name = className.trim().toUpperCase();
  if (/^(XII|12)([^0-9A-Z]|$)/.test(name)) return 12;
  if (/^(XI|11)([^0-9A-Z]|$)/.test(name)) return 11;
  if (/^(X|10)([^0-9A-Z]|$)/.test(name)) return 10;
  return null;
}

import { gradeLabel, GRADE_OPTIONS } from '../../lib/grade';
import type { GradeLevel, SchoolClass } from '../../types';

export type GradeFilter = '' | '10' | '11' | '12' | 'none';

export const GRADE_FILTER_OPTIONS: Array<{ value: GradeFilter; label: string }> = [
  { value: '', label: 'Semua tingkat' },
  ...GRADE_OPTIONS.map((option) => ({ value: String(option.value) as GradeFilter, label: `Kelas ${option.label}` })),
  { value: 'none', label: 'Lainnya' },
];

export function matchesGrade(gradeLevel: GradeLevel | null, filter: GradeFilter): boolean {
  if (filter === '') return true;
  if (filter === 'none') return gradeLevel === null;
  return gradeLevel === Number(filter);
}

interface ClassSelectProps {
  id: string;
  classes: SchoolClass[] | undefined;
  value: number | '';
  onChange: (classId: number | '') => void;
  /** Teks opsi kosong, mis. "Semua kelas" atau "Pilih kelas". */
  placeholder: string;
  gradeFilter?: GradeFilter;
  className?: string;
  invalid?: boolean;
  describedBy?: string;
}

/** Dropdown kelas yang dikelompokkan per tingkat (X / XI / XII / Lainnya). */
export function ClassSelect({ id, classes, value, onChange, placeholder, gradeFilter = '', className, invalid, describedBy }: ClassSelectProps) {
  const visible = (classes ?? []).filter((c) => matchesGrade(c.gradeLevel, gradeFilter));
  const groups = [...GRADE_OPTIONS.map((g) => g.value), null].map((grade) => ({
    label: grade === null ? 'Lainnya' : `Kelas ${gradeLabel(grade)}`,
    items: visible.filter((c) => c.gradeLevel === grade),
  }));

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      disabled={!classes}
      className={className}
    >
      <option value="">{classes ? placeholder : 'Memuat kelas…'}</option>
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
    </select>
  );
}

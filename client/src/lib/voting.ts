import type { Category, Role, VoterRole, VoterScope } from '../types';

/** Label singkat (badge/kolom tabel). Peran ditulis kapital karena berdiri sendiri. */
export const VOTER_SCOPE_LABEL: Record<VoterScope, string> = {
  all: 'Siswa & Guru',
  student: 'Khusus Siswa',
  teacher: 'Khusus Guru',
};

/** Bentuk untuk di dalam kalimat: "Kategori X hanya untuk siswa." */
export const VOTER_SCOPE_SENTENCE: Record<VoterScope, string> = {
  all: 'siswa dan guru',
  student: 'siswa',
  teacher: 'guru',
};

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Siswa',
  teacher: 'Guru',
  admin: 'Panitia',
};

/** Sama dengan aturan server: panitia tidak memilih; kategori bisa dibatasi untuk siswa atau guru. */
export function canVoteIn(role: Role, scope: VoterScope): boolean {
  return role !== 'admin' && (scope === 'all' || scope === role);
}

/** Keterangan di bawah nama kandidat: kelas untuk siswa, "Guru" untuk guru. */
export function personMeta(person: { role: VoterRole; className: string }): string {
  return person.role === 'teacher' ? 'Guru' : person.className;
}

export function eligibleCategories(categories: Category[], role: Role): Category[] {
  return categories.filter((category) => canVoteIn(role, category.voterScope));
}

import type { Category, Role, VoterRole, VoterScope } from '../types';

export const VOTER_SCOPE_LABEL: Record<VoterScope, string> = {
  all: 'Siswa & guru',
  student: 'Khusus siswa',
  teacher: 'Khusus guru',
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

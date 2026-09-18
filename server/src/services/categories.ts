import type { Category, Role, VoterScope } from '../generated/prisma/client.js';

export const categoryOrderBy = [{ sortOrder: 'asc' }, { id: 'asc' }] as const;

/** Apakah pengguna dengan peran ini boleh memilih di kategori tersebut. */
export function canVoteInCategory(role: Role, scope: VoterScope): boolean {
  if (role === 'admin') return false;
  return scope === 'all' || scope === role;
}

export const VOTER_SCOPE_LABEL: Record<VoterScope, string> = {
  all: 'siswa dan guru',
  student: 'siswa',
  teacher: 'guru',
};

export function serializeCategory(category: Category) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    voterScope: category.voterScope,
    sortOrder: category.sortOrder,
  };
}

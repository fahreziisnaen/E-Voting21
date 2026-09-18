import type { Prisma } from '../generated/prisma/client.js';

/** Nama, peran & kelas kandidat selalu diambil dari data siswa/guru yang terhubung. */
export const candidateInclude = {
  category: { select: { id: true, name: true } },
  user: {
    select: {
      id: true,
      nis: true,
      name: true,
      role: true,
      schoolClass: { select: { id: true, name: true } },
    },
  },
} as const;

type CandidateWithPerson = Prisma.CandidateGetPayload<{ include: typeof candidateInclude }>;

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Bentuk publik (halaman siswa) — tanpa NIS/username. */
export function serializeCandidate(candidate: CandidateWithPerson) {
  return {
    id: candidate.id,
    categoryId: candidate.category.id,
    categoryName: candidate.category.name,
    candidateNumber: candidate.candidateNumber,
    name: candidate.user.name,
    role: candidate.user.role,
    /** Kosong untuk guru. */
    className: candidate.user.schoolClass?.name ?? '',
    photoUrl: candidate.photoUrl,
    vision: candidate.vision,
    mission: asStringArray(candidate.mission),
    programs: asStringArray(candidate.programs),
    organizationHistory: asStringArray(candidate.organizationHistory),
  };
}

export function serializeAdminCandidate(candidate: CandidateWithPerson) {
  return {
    ...serializeCandidate(candidate),
    userId: candidate.user.id,
    nis: candidate.user.nis,
    classId: candidate.user.schoolClass?.id ?? null,
  };
}

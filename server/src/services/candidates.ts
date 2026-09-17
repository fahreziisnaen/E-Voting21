import type { Prisma } from '../generated/prisma/client.js';

/** Nama & kelas kandidat selalu diambil dari data siswa yang terhubung. */
export const candidateInclude = {
  user: {
    select: {
      id: true,
      nis: true,
      name: true,
      schoolClass: { select: { id: true, name: true } },
    },
  },
} as const;

type CandidateWithStudent = Prisma.CandidateGetPayload<{ include: typeof candidateInclude }>;

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Bentuk publik (halaman siswa) — tanpa NIS. */
export function serializeCandidate(candidate: CandidateWithStudent) {
  return {
    id: candidate.id,
    candidateNumber: candidate.candidateNumber,
    name: candidate.user.name,
    className: candidate.user.schoolClass?.name ?? '',
    photoUrl: candidate.photoUrl,
    vision: candidate.vision,
    mission: asStringArray(candidate.mission),
    programs: asStringArray(candidate.programs),
    organizationHistory: asStringArray(candidate.organizationHistory),
  };
}

export function serializeAdminCandidate(candidate: CandidateWithStudent) {
  return {
    ...serializeCandidate(candidate),
    studentId: candidate.user.id,
    nis: candidate.user.nis,
    classId: candidate.user.schoolClass?.id ?? null,
  };
}

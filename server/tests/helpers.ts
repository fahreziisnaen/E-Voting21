import request from 'supertest';
import { createApp } from '../src/app.js';
import type { ElectionStatus } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();
export const PASSWORD = 'kode-akses-uji';

let passwordHash: string | undefined;

export async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.schoolClass.deleteMany();
  await prisma.electionSettings.deleteMany();
}

export async function createClass(name = 'XII IPA 1', gradeLevel: number | null = 12) {
  return prisma.schoolClass.upsert({ where: { name }, create: { name, gradeLevel }, update: {} });
}

export async function createUser(nis: string, role: 'student' | 'admin' = 'student', name = `Pengguna ${nis}`, className = 'XII IPA 1') {
  passwordHash ??= await hashPassword(PASSWORD);
  const classId = role === 'student' ? (await createClass(className)).id : null;
  return prisma.user.create({ data: { nis, name, classId, role, passwordHash } });
}

/** Dua kandidat, masing-masing terhubung ke akun siswa. */
export async function createCandidates() {
  const make = async (candidateNumber: number, name: string) => {
    const student = await createUser(`K00${candidateNumber}`, 'student', name);
    return prisma.candidate.create({
      data: {
        candidateNumber,
        userId: student.id,
        vision: 'Visi kandidat uji.',
        mission: ['Misi pertama'],
        programs: ['Program'],
        organizationHistory: [],
      },
    });
  };
  return [await make(1, 'Kandidat Satu'), await make(2, 'Kandidat Dua')];
}

const HOUR = 60 * 60 * 1000;

/**
 * Default: jadwal yang sedang berlangsung. Jam mulai = jam selesai sehingga dianggap
 * kontinu dan tidak bergantung pada jam berapa test dijalankan.
 */
export async function setElection(
  overrides: Partial<{ startDate: Date; endDate: Date; status: ElectionStatus }> = {},
) {
  const now = Date.now();
  const data = {
    electionName: 'Pemilihan Uji',
    startDate: new Date(now - 48 * HOUR),
    endDate: new Date(now + 48 * HOUR),
    status: 'open' as ElectionStatus,
    ...overrides,
  };
  return prisma.electionSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}

/** Agent dengan cookie jar + token CSRF, sudah login. */
export async function loginAs(nis: string, password = PASSWORD) {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf');
  const token = csrf.body.csrfToken as string;
  const login = await agent.post('/api/auth/login').set('x-csrf-token', token).send({ nis, password });
  return { agent, token, login };
}
